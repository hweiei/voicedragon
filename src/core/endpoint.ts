/**
 * P14 端侧自动断句（纯策略层）：把「VAD 每窗有没有人声」变成「该开口了 / 该收口了」。
 *
 * 为什么要有这一层：Silero VAD 已经跑在 sensevoice worker 里（sherpa 的 `sherpa-onnx-vad.js`），
 * 但端点策略埋在 wasm 内部——参数不可配、行为不可单测、时延不可量。P14 把策略抽到核心层：
 * worker 只负责「把每窗 VAD 结果喂进来」与「按事件 flush」，判定逻辑 100% 可测。
 *
 * 三条纪律：
 * 1) 纯函数式语义：零随机、零 IO、零时钟依赖（`nowMs` 由调用方给）——同输入必得同事件序列；
 * 2) **关闭即等价旧行为**：`autoCapture=false` 时调用方根本不喂策略（见 worker），不是「策略内部装作没有」；
 * 3) 时延如实可测：`lastLatencyMs` 报告的是「最后一帧人声 → 收口判定」的真实毫秒差，不是估计值。
 */

/** VAD 窗长：sherpa silero 的 windowSize 512 @ 16kHz。 */
export const ENDPOINT_WINDOW_MS = 32;
/** 开口线：累计人声 ≥ 400ms 才算「真的在说」（避免咳嗽/翻页触发）。 */
export const MIN_SPEECH_MS = 400;
/** 收口线：句尾静默 ≥ 300ms 即截断送识别（替代「等满 6 秒」）。 */
export const MIN_SILENCE_MS = 300;

export type EndpointEvent = "none" | "speech-start" | "auto-stop";

export interface EndpointOptions {
  windowMs?: number;
  minSpeechMs?: number;
  minSilenceMs?: number;
}

/**
 * 单段端点判定器。
 *
 * 生命周期：idle →（人声累计 ≥ minSpeechMs）→ speaking →（静默累计 ≥ minSilenceMs）→ auto-stop → idle。
 * 事件是**边沿触发**：`speech-start` 与 `auto-stop` 每段各只发一次。
 */
export class EndpointPolicy {
  private readonly minSpeechMs: number;
  private readonly minSilenceMs: number;
  private speechMs = 0;
  private silenceMs = 0;
  private speaking = false;
  private lastVoiceAtMs: number | null = null;
  private latencyMs: number | null = null;
  private segments = 0;

  constructor(options: EndpointOptions = {}) {
    this.minSpeechMs = Math.max(1, options.minSpeechMs ?? MIN_SPEECH_MS);
    this.minSilenceMs = Math.max(1, options.minSilenceMs ?? MIN_SILENCE_MS);
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  /** 已完成的自动收口段数（每段 = 一次自动判定）。 */
  get segmentCount(): number {
    return this.segments;
  }

  /** 上一次 auto-stop 的收口时延（毫秒）：最后一帧人声 → 判定。 */
  get lastLatencyMs(): number | null {
    return this.latencyMs;
  }

  /**
   * 喂一窗 VAD 结果。`nowMs` 是这一窗**结束**的时刻（单调时钟，调用方给）。
   * 返回本窗产生的事件（大多数窗是 "none"）。
   */
  push(voiceDetected: boolean, nowMs: number): EndpointEvent {
    if (voiceDetected) {
      this.silenceMs = 0;
      this.lastVoiceAtMs = nowMs;
      if (!this.speaking) {
        this.speechMs += ENDPOINT_WINDOW_MS;
        if (this.speechMs >= this.minSpeechMs) {
          this.speaking = true;
          this.speechMs = 0;
          return "speech-start";
        }
        return "none";
      }
      return "none";
    }

    // 静默窗
    this.speechMs = 0;
    if (!this.speaking) return "none";
    this.silenceMs += ENDPOINT_WINDOW_MS;
    if (this.silenceMs < this.minSilenceMs) return "none";
    this.speaking = false;
    this.silenceMs = 0;
    this.segments += 1;
    this.latencyMs = this.lastVoiceAtMs == null ? null : Math.max(0, nowMs - this.lastVoiceAtMs);
    return "auto-stop";
  }

  /** 重置到空闲（下一次 start/cancel 用；不清段计数与时延历史）。 */
  reset(): void {
    this.speechMs = 0;
    this.silenceMs = 0;
    this.speaking = false;
  }
}
