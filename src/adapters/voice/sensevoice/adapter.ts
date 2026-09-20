/**
 * SenseVoiceAdapter：端侧粤语识别的 VoiceAdapter 实现。
 * - 懒初始化：首次施法时才拉起 Worker + 加载 238MB 模型（或读 IndexedDB 缓存）
 * - 评分：识别文本 → scorePronunciation（置信度用引擎常量代理，见 NOTE-confidence）
 * - 失败自愈：任何环节错误都上抛 onError，UI 侧回落 QTE/Web Speech
 */

import { VOICE_CAPTURE_MAX_MS } from "../../../core/config/balance";
import { SCORING_WEIGHTS_V2 } from "../../../core/config/balance";
import { composeFinalScore, scorePronunciation } from "../../../core/scoring";
import { scoreToneContour } from "../../../core/tone";
import type {
  VoiceAdapter,
  VoiceAdapterState,
  VoiceScoreResult,
  VoiceStartOptions
} from "../../voice";
import { PitchTracker } from "../pitch-tracker";
import { SENSEVOICE_MANIFEST, runtimeBaseUrl } from "./manifest";
import { getModelHandles, isModelReady } from "./model-store";
import { MicRecorder } from "./recorder";
import type { DownstreamMessage, UpstreamMessage } from "./sensevoice.worker";

/** NOTE-confidence：SenseVoice 的 wasm JS API 不输出词级置信度，用中等偏上常量代理；
 *  评分大头由文本相似度层（76% 权重）承担，与 REDESIGN-PLAN §8 一致。 */
const ENGINE_CONFIDENCE_PROXY = 0.8;

/** 轻量 SIMD 探测：sherpa-onnx-wasm-simd 构建要求浏览器支持 WASM SIMD。 */
export function isWasmSimdSupported(): boolean {
  try {
    if (typeof WebAssembly === "undefined") return false;
    // 标准 SIMD 探测字节串（v128.const 指令）
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
        253, 15, 253, 98, 11
      ])
    );
  } catch {
    return false;
  }
}

interface PeekWord {
  kind: "idle" | "listening" | "processing";
}

export class SenseVoiceAdapter implements VoiceAdapter {
  get id(): string {
    return "sensevoice";
  }

  get supported(): boolean {
    return isWasmSimdSupported();
  }

  private wasmReady = false;
  private modelReady = false;

  /** P3 声调权重提供者（设置页滑杆，组合根注入，逐次施法实时读取）。 */
  private toneWeightProvider: () => number;
  /**
   * P14 自动收音：设置页开关（组合根注入，逐次施法实时读取）。
   * 缺省 `false` = 保持旧行为（松手判定 / 6 秒上限），因为构造方必须显式选择开启。
   */
  private autoCaptureProvider: () => boolean;
  private pitchTracker: PitchTracker | null = null;

  constructor(options: { toneWeight?: () => number; autoCapture?: () => boolean } = {}) {
    this.toneWeightProvider = options.toneWeight ?? (() => SCORING_WEIGHTS_V2.tone);
    this.autoCaptureProvider = options.autoCapture ?? (() => false);
  }

  /** P14：当前是否开启自动收音（设置页与 E2E 调试口读取）。 */
  get autoCapture(): boolean {
    return this.autoCaptureProvider();
  }

  get ready(): boolean {
    return this.supported && this.wasmReady && this.modelReady;
  }

  private worker: Worker | null = null;
  private recorder: MicRecorder | null = null;
  private pending: VoiceStartOptions | null = null;
  private preparing: Promise<boolean> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;

  /** 模型是否已在 IndexedDB（设置页与施法预检共用）。 */
  async hasCachedModel(): Promise<boolean> {
    this.modelReady = await isModelReady(SENSEVOICE_MANIFEST).catch(() => false);
    return this.modelReady;
  }

  /** 升级缓存标记（下载器完成后由外部调用以便与 UI 联动）。 */
  markModelReady(): void {
    this.modelReady = true;
  }

  /** 引擎预热：确保 Worker 已创建且 wasm 初始化完成。幂等。 */
  prepare(): Promise<boolean> {
    if (!this.supported) return Promise.resolve(false);
    if (this.wasmReady) return Promise.resolve(true);
    if (this.preparing) return this.preparing;
    this.preparing = this.doPrepare().finally(() => {
      this.preparing = null;
    });
    return this.preparing;
  }

  private async doPrepare(): Promise<boolean> {
    this.modelReady = await this.hasCachedModel();
    if (!this.modelReady) return false;
    const handles = await getModelHandles(SENSEVOICE_MANIFEST);
    if (!handles) return false;

    return new Promise<boolean>((resolve) => {
      try {
        this.worker = new Worker(new URL("./sensevoice.worker.ts", import.meta.url));
        const init: UpstreamMessage = {
          type: "init",
          fileUrls: {
            [SENSEVOICE_MANIFEST.emscriptenDataName]: handles.dataBlobUrl
          },
          runtimeBaseUrl: runtimeBaseUrl(),
          dataPackageMetadata: handles.dataPackageMetadata
        };
        const timeout = setTimeout(() => resolve(false), 60000);
        this.worker.onmessage = (event: MessageEvent<DownstreamMessage>) => {
          const msg = event.data;
          if (msg.type === "ready") {
            this.wasmReady = true;
            clearTimeout(timeout);
            resolve(true);
          } else if (msg.type === "error" && !this.wasmReady) {
            clearTimeout(timeout);
            resolve(false);
          } else {
            this.handleWorkerMessage(msg);
          }
        };
        this.worker.postMessage(init);
      } catch {
        resolve(false);
      }
    });
  }

  start(options: VoiceStartOptions): void {
    if (!this.supported) {
      options.onError?.(new Error("当前浏览器不支持 WASM SIMD，无法使用端侧识别"));
      return;
    }
    this.cancel();
    this.pending = options;
    options.onState?.("processing");
    void this.prepare().then((ok) => {
      if (!this.pending) return;
      if (!ok) {
        const pending = this.pending;
        this.pending = null;
        pending.onError?.(new Error("模型未就绪：请在设置中下载端侧粤语模型"));
        return;
      }
      this.beginCapture(options);
    });
  }

  private beginCapture(options: VoiceStartOptions): void {
    const state: PeekWord = { kind: "idle" };
    void state;
    // P14：端点配置逐次下发（设置可随时改；关闭时 worker 完全不跑端点策略）
    if (this.worker && this.wasmReady) {
      const endpointMsg: UpstreamMessage = { type: "endpoint", autoCapture: this.autoCapture };
      this.worker.postMessage(endpointMsg);
    }
    this.recorder = new MicRecorder();
    this.pitchTracker = new PitchTracker();
    const tracker = this.pitchTracker;
    void this.recorder.start({
      onFrame: (samples, sampleRate) => {
        if (!this.worker || !this.wasmReady) return;
        const msg: UpstreamMessage = { type: "audio", samples, sampleRate };
        this.worker.postMessage(msg, [samples.buffer]);
      },
      onFloat: (float, sampleRate) => {
        tracker.push(float, sampleRate, options.onPitchFrame);
      },
      onVolume: (rms) => {
        tracker.noteVolume(rms);
        options.onVolume?.(rms);
      },
      onError: (error) => {
        this.finishWithError(error);
      }
    });
    this.maxTimer = setTimeout(() => this.stop(), VOICE_CAPTURE_MAX_MS);
  }

  private handleWorkerMessage(msg: DownstreamMessage): void {
    if (!this.pending) return;
    if (msg.type === "speech_start") {
      this.pending.onState?.("listening" as VoiceAdapterState);
    } else if (msg.type === "result") {
      const pending = this.pending;
      this.pending = null;
      this.stopQuietly();
      const scored = scorePronunciation(pending.targets, msg.text, ENGINE_CONFIDENCE_PROXY);
      // P3 双通道：声调层可空回退——无 F0 数据时评分与 V1 完全一致
      const toneDetail = pending.jyutping
        ? scoreToneContour(this.pitchTracker?.frames ?? [], pending.jyutping)
        : null;
      const finalScore = composeFinalScore(
        scored.score,
        toneDetail?.score ?? null,
        this.toneWeightProvider()
      );
      const result: VoiceScoreResult = {
        ...scored,
        score: finalScore,
        toneScore: toneDetail?.score ?? null,
        toneDetail,
        source: this.id
      };
      this.pitchTracker = null;
      pending.onResult(result);
    } else if (msg.type === "error") {
      this.finishWithError(new Error(msg.error));
    }
  }

  private finishWithError(error: Error): void {
    const pending = this.pending;
    this.pending = null;
    this.stopQuietly();
    pending?.onError?.(error);
  }

  private stopQuietly(): void {
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.maxTimer = null;
    this.recorder?.stop();
    this.recorder = null;
    // 注意：pitchTracker 的 frames 在 result 合成后由 handleWorkerMessage 清空；
    // 提前取消时 tracker 随下次 beginCapture 重建。
  }

  /** 主动停止收音并触发判定（等价 PTT 松开）。 */
  stop(): void {
    if (this.worker && this.wasmReady && this.pending) {
      const msg: UpstreamMessage = { type: "flush" };
      this.worker.postMessage(msg);
      this.pending.onState?.("processing");
    }
    this.stopQuietly();
  }

  cancel(): void {
    this.pending = null;
    this.stopQuietly();
    // flush 中途置空后不再等待结果；Worker 保持常驻以便下次直接使用
  }

  dispose(): void {
    this.cancel();
    if (this.worker) {
      const msg: UpstreamMessage = { type: "dispose" };
      this.worker.postMessage(msg);
      this.worker.terminate();
      this.worker = null;
    }
    this.wasmReady = false;
  }
}
