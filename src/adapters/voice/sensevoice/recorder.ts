/**
 * 麦克风采集器：getUserMedia → AudioWorklet → Int16 PCM 帧回调。
 * 采样率取设备原生（Worker 内统一重采样至 16kHz），并给出音量（RMS）用于 UI 动效。
 */

/**
 * 移动端修复：共享 AudioContext 的"手势内解锁"。
 * iOS/部分 Android 要求 AudioContext 的首次创建/恢复发生在用户手势同步段；
 * 而录音管线要等模型就绪（异步）才启动，等到那时才建上下文必然处于 `suspended`，
 * AudioWorklet 一帧不出 → VAD 收不到音频 → 自动收音永不触发、兜底 flush 也无料可判。
 * 解法：点击「开始收音」的同步段先调用本函数预热，真正录音时复用同一上下文。
 */
let sharedContext: AudioContext | null = null;

export function unlockAudioContext(): void {
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContext();
  }
  if (sharedContext.state === "suspended") {
    void sharedContext.resume().catch(() => undefined);
  }
}

export interface RecorderCallbacks {
  onFrame(samples: Int16Array, sampleRate: number): void;
  /** P3：原始 Float32 帧（F0 提取用；Int16 量化损失对基频检测不友好）。 */
  onFloat?(samples: Float32Array, sampleRate: number): void;
  onVolume?(rms: number): void;
  onError(error: Error): void;
}

/** AudioWorklet 处理器源码（Blob 形式注入，避免额外文件与 CSP 扩张）。 */
const CAPTURE_WORKLET = `
class VdCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(new Float32Array(channel));
    return true;
  }
}
registerProcessor("vd-pcm-capture", VdCaptureProcessor);
`;

export class MicRecorder {
  private context: AudioContext | null = null;
  /** 上下文是否为本实例自建（自建才允许 teardown 时关闭；共享上下文留作复用）。 */
  private ownsContext = false;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private active = false;

  get isActive(): boolean {
    return this.active;
  }

  async start(callbacks: RecorderCallbacks): Promise<void> {
    if (this.active) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (error) {
      const err = error as Error;
      callbacks.onError(
        new Error(
          err.name === "NotAllowedError" ? "麦克风权限未开启" : `录音启动失败：${err.message}`
        )
      );
      return;
    }

    try {
      // 优先复用手势内解锁的共享上下文（移动端必需；见 unlockAudioContext 注释）
      const reusable = sharedContext && sharedContext.state !== "closed" ? sharedContext : null;
      this.context = reusable ?? new AudioContext();
      this.ownsContext = reusable === null;
      if (this.context.state === "suspended") {
        await this.context.resume().catch(() => undefined);
      }
      if (this.context.state !== "running") {
        this.teardown();
        callbacks.onError(new Error("音频管线被系统锁定：请再点一次「开始收音」（勿锁屏/切后台）"));
        return;
      }
      const workletUrl = URL.createObjectURL(
        new Blob([CAPTURE_WORKLET], { type: "application/javascript" })
      );
      await this.context.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const source = this.context.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(this.context, "vd-pcm-capture");
      this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const float = event.data;
        const sampleRate = this.context?.sampleRate ?? 48000;
        if (callbacks.onFloat) callbacks.onFloat(float, sampleRate);
        // Int16 量化 + RMS
        const int16 = new Int16Array(float.length);
        let sum = 0;
        for (let i = 0; i < float.length; i += 1) {
          const s = Math.max(-1, Math.min(1, float[i]));
          int16[i] = s < 0 ? s * 32768 : s * 32767;
          sum += s * s;
        }
        callbacks.onFrame(int16, sampleRate);
        callbacks.onVolume?.(Math.sqrt(sum / Math.max(1, float.length)));
      };
      source.connect(this.node);
      this.node.connect(this.context.destination);
      this.active = true;
    } catch (error) {
      this.teardown();
      callbacks.onError(new Error(`音频管线初始化失败：${(error as Error).message}`));
    }
  }

  stop(): void {
    this.teardown();
  }

  private teardown(): void {
    this.active = false;
    this.node?.disconnect();
    this.node = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    const ctx = this.context;
    this.context = null;
    if (!ctx) return;
    if (this.ownsContext) {
      if (ctx.state !== "closed") void ctx.close().catch(() => undefined);
    } else if (ctx === sharedContext && ctx.state === "closed") {
      sharedContext = null; // 共享上下文被外部关闭时清引用，下次解锁重建
    }
  }
}
