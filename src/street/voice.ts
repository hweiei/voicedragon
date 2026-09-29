/** 开口出牌：麦克风 → PitchTracker → scoreToneContour（录音只在内存，不上传）。 */
import { PitchTracker } from "../adapters/voice/pitch-tracker";
import { type ToneScoreDetail, scoreToneContour } from "../core/tone";

export interface VoiceTake {
  detail: ToneScoreDetail | null;
  durationMs: number;
}

export class MicSession {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private tracker = new PitchTracker();
  private started = 0;
  onLevel?: (rms: number) => void;

  static get supported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      window.isSecureContext
    );
  }

  async start(): Promise<void> {
    this.tracker = new PitchTracker();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(2048, 1, 1);
    const rate = this.ctx.sampleRate;
    this.node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      this.tracker.noteVolume(rms);
      this.onLevel?.(rms);
      this.tracker.push(new Float32Array(data), rate);
    };
    src.connect(this.node);
    this.node.connect(this.ctx.destination);
    this.started = performance.now();
  }

  async stop(jyutping: string): Promise<VoiceTake> {
    const durationMs = performance.now() - this.started;
    this.node?.disconnect();
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    await this.ctx?.close().catch(() => undefined);
    this.node = null;
    this.stream = null;
    this.ctx = null;
    return { detail: scoreToneContour(this.tracker.frames, jyutping), durationMs };
  }
}

/** 系统粤语语音朗读（有粤语音色才读）。 */
export function speakCantonese(text: string, rate = 0.9): boolean {
  if (typeof speechSynthesis === "undefined") return false;
  const voices = speechSynthesis.getVoices();
  const v =
    voices.find((x) => /zh[-_]HK/i.test(x.lang)) ??
    voices.find((x) => /yue|cantonese/i.test(`${x.lang} ${x.name}`));
  if (!v) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = rate;
  speechSynthesis.speak(u);
  return true;
}
