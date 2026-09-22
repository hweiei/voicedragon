/**
 * 语音端口（VoicePort）与基础适配器。
 *
 * 端口优先：GameUI 只依赖 VoiceAdapter 接口，不关心识别实现。
 * 适配器链（降级矩阵，见 REDESIGN-PLAN §8）：
 *   1. SenseVoice（sherpa-onnx WASM，P1 落地）
 *   2. Web Speech API zh-HK（本文件的 BrowserVoiceAdapter，零下载保底）
 *   3. 无声 QTE 模式（UI 侧策略替换，P1）
 */

import { scorePronunciation } from "../core/scoring";
import type { PronunciationScore } from "../core/scoring";
import type { PitchFrame, ToneScoreDetail } from "../core/tone";

export type VoiceAdapterState = "idle" | "listening" | "processing";

export interface VoiceScoreResult extends PronunciationScore {
  source: string;
  rawConfidence?: number;
  /** P3 声调层：调准分（无 F0 通道/浊音不足时为 null，评分已自动回退纯字准）。 */
  toneScore?: number | null;
  /** P3 声调层：调准明细（音节级分数与轮廓曲线，练习场叠图用）。 */
  toneDetail?: ToneScoreDetail | null;
}

export interface VoiceStartOptions {
  targets: string[];
  jyutping?: string;
  onInterim?: (transcript: string) => void;
  onResult: (result: VoiceScoreResult) => void;
  onError?: (error: Error) => void;
  onState?: (state: VoiceAdapterState) => void;
  /** P3 练习场：实时 F0 帧回调（仅支持 F0 通道的适配器会触发）。 */
  onPitchFrame?: (frame: PitchFrame) => void;
  /** P6-F2 语音光环：实时音量 RMS 回调（麦克风通道适配器触发）。 */
  onVolume?: (rms: number) => void;
}

export interface VoiceAdapter {
  readonly id: string;
  /** 运行时环境是否支持（wasm/能力探测）。 */
  readonly supported: boolean;
  /** 是否立即可用（模型已缓存且引擎可拉起）。 */
  readonly ready: boolean;
  /**
   * 移动端：在「开始收音」的用户手势同步段调用，预热音频上下文（iOS 解锁要求）。
   * 非麦克风通道的适配器可不实现。
   */
  unlockCapture?(): void;
  start(options: VoiceStartOptions): void;
  stop(): void;
  cancel(): void;
}

interface SpeechRecognitionResultItem {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultItem };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export class BrowserVoiceAdapter implements VoiceAdapter {
  private Recognition: SpeechRecognitionCtor | null;
  private recognition: SpeechRecognitionInstance | null = null;
  private active = false;

  constructor() {
    const g = globalThis as unknown as Record<string, unknown>;
    this.Recognition = (g.SpeechRecognition ||
      g.webkitSpeechRecognition ||
      null) as SpeechRecognitionCtor | null;
  }

  get id(): string {
    return "web-speech";
  }

  get supported(): boolean {
    return Boolean(this.Recognition);
  }

  get ready(): boolean {
    return this.supported;
  }

  start({ targets, onInterim, onResult, onError, onState }: VoiceStartOptions): void {
    if (!this.supported || !this.Recognition) {
      onError?.(new Error("当前浏览器不支持 Web Speech API"));
      return;
    }
    this.cancel();
    const recognition = new this.Recognition();
    let delivered = false;
    let failed = false;
    this.recognition = recognition;
    recognition.lang = "zh-HK";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 4;

    recognition.onstart = () => {
      this.active = true;
      onState?.("listening");
    };

    recognition.onspeechend = () => {
      onState?.("processing");
      recognition.stop();
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      const candidates: VoiceScoreResult[] = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) {
          interim += result[0]?.transcript || "";
          continue;
        }
        for (let j = 0; j < result.length; j += 1) {
          const alternative = result[j];
          const confidence =
            Number.isFinite(alternative.confidence) && alternative.confidence > 0
              ? alternative.confidence
              : 0.72;
          const scored = scorePronunciation(targets, alternative.transcript, confidence);
          candidates.push({ ...scored, rawConfidence: confidence, source: this.id });
        }
      }
      if (interim) onInterim?.(interim);
      if (candidates.length) {
        candidates.sort((a, b) => b.score - a.score);
        delivered = true;
        onResult(candidates[0]);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      this.active = false;
      failed = true;
      const error = new Error(
        event.error === "not-allowed" ? "麦克风权限未开启" : `语音识别失败：${event.error}`
      );
      onError?.(error);
    };

    recognition.onend = () => {
      this.active = false;
      onState?.("idle");
      if (!delivered && !failed) onError?.(new Error("没有识别到清晰语音"));
    };

    try {
      recognition.start();
    } catch (error) {
      this.active = false;
      onError?.(error as Error);
    }
  }

  stop(): void {
    if (this.recognition && this.active) this.recognition.stop();
  }

  cancel(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // 识别器可能已空闲
      }
    }
    this.active = false;
    this.recognition = null;
  }
}

export type VoiceMode = "auto" | "sensevoice" | "webspeech";

/**
 * 语音引擎选择策略（纯函数，可单测）。
 * - "auto"：端侧模型已缓存 → 端侧（离线高精度）；否则 Web Speech（零下载保底）
 * - "sensevoice"：强制端侧（未下载则 start 报错，UI 引导下载/回落）
 * - "webspeech"：强制在线兜底
 */
export function selectAdapterKind(
  mode: VoiceMode,
  probe: { modelCached: boolean }
): Exclude<VoiceMode, "auto"> {
  if (mode === "auto") return probe.modelCached ? "sensevoice" : "webspeech";
  return mode;
}

/** 工厂：按模式构造适配器（异步：SenseVoice 适配器动态加载以免拖慢首包）。 */
export async function createVoiceAdapter(
  mode: VoiceMode,
  probe: { modelCached: boolean } = { modelCached: false },
  deps: { toneWeight?: () => number; autoCapture?: () => boolean } = {}
): Promise<VoiceAdapter> {
  const kind = selectAdapterKind(mode, probe);
  if (kind === "sensevoice") {
    const { SenseVoiceAdapter } = await import("./voice/sensevoice/adapter");
    return new SenseVoiceAdapter({ toneWeight: deps.toneWeight, autoCapture: deps.autoCapture });
  }
  return new BrowserVoiceAdapter();
}
