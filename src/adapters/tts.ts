/**
 * TTS 示范发音（TTSPort 的 speechSynthesis 实现）。
 * 系统粤语声（iOS/macOS 原生 zh-HK / 桌面浏览器 yue 声）零成本可用；
 * 离线 sherpa TTS 列为 P5 可选项（见 REDESIGN-PLAN §4.3）。
 */

export interface VoiceLike {
  name: string;
  lang: string;
  default?: boolean;
}

/**
 * 粤语声挑选策略（纯函数，可单测）：
 * zh-HK > 名称含 Cantonese/yue > zh-Hant-HK > 任一 zh-*（兜底）> 系统默认
 */
export function pickCantoneseVoice(voices: VoiceLike[]): VoiceLike | null {
  if (!voices.length) return null;
  const norm = (lang: string) => lang.toLowerCase().replace("_", "-");
  const byName = (kw: string) =>
    voices.find((voice) => voice.name.toLowerCase().includes(kw.toLowerCase()));
  return (
    voices.find((voice) => norm(voice.lang) === "zh-hk") ??
    byName("cantonese") ??
    byName("yue") ??
    voices.find((voice) => norm(voice.lang).includes("hant-hk")) ??
    voices.find((voice) => norm(voice.lang).startsWith("zh")) ??
    voices.find((voice) => voice.default) ??
    voices[0]
  );
}

export class SpeechTts {
  private synth: SpeechSynthesis | null =
    typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.refreshVoices();
    this.synth?.addEventListener?.("voiceschanged", () => this.refreshVoices());
  }

  private refreshVoices(): void {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (voices.length) this.voice = pickCantoneseVoice(voices) as SpeechSynthesisVoice | null;
  }

  get supported(): boolean {
    return Boolean(this.synth);
  }

  /** 朗读短语（默认 0.9 倍速，跟读更清晰）。重复调用会先掐断上一条。 */
  speak(text: string, options: { rate?: number; pitch?: number } = {}): void {
    if (!this.synth || !text) return;
    this.synth.cancel();
    if (!this.voice) this.refreshVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
      utterance.lang = this.voice.lang;
    } else {
      utterance.lang = "zh-HK";
    }
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1;
    this.synth.speak(utterance);
  }

  stop(): void {
    this.synth?.cancel();
  }
}
