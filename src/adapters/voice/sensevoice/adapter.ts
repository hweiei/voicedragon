/**
 * SenseVoiceAdapter：端侧粤语识别的 VoiceAdapter 实现。
 * - 懒初始化：首次施法时才拉起 Worker + 加载 238MB 模型（或读 IndexedDB 缓存）
 * - 评分：识别文本 → scorePronunciation（置信度用引擎常量代理，见 NOTE-confidence）
 * - 失败自愈：任何环节错误都上抛 onError，UI 侧回落 QTE/Web Speech
 */

import { VOICE_CAPTURE_MAX_MS } from "../../../core/config/balance";
import { scorePronunciation } from "../../../core/scoring";
import type {
  VoiceAdapter,
  VoiceAdapterState,
  VoiceScoreResult,
  VoiceStartOptions
} from "../../voice";
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
    this.recorder = new MicRecorder();
    void this.recorder.start({
      onFrame: (samples, sampleRate) => {
        if (!this.worker || !this.wasmReady) return;
        const msg: UpstreamMessage = { type: "audio", samples, sampleRate };
        this.worker.postMessage(msg, [samples.buffer]);
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
      const result: VoiceScoreResult = { ...scored, source: this.id };
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
