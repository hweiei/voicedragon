import { SpeechTts } from "../adapters/tts";

/** User-selected Cantonese synthetic voice, bundled with the first chapter. */
export const AUDIO_FILES: Record<string, string> = {
  你好: "greeting",
  唔该: "please",
  唔該: "please",
  我要一杯冻奶茶: "order",
  我要一杯凍奶茶: "order",
  几多钱: "price",
  幾多錢: "price",
  多谢: "thanks",
  多謝: "thanks",
  唔该我要一杯冻奶茶: "boss",
  唔該我要一杯凍奶茶: "boss",
  我要: "want",
  一杯: "cup",
  冻奶茶: "milk-tea",
  凍奶茶: "milk-tea",
  奶茶到喇慢慢饮: "served",
  奶茶到喇慢慢飲: "served"
};
export function audioFileFor(text: string): string | null {
  const key = text.replace(/[，。！？、,.!?\s]/g, "");
  return AUDIO_FILES[key] ? `audio/yue/${AUDIO_FILES[key]}.mp3` : null;
}
export class LessonAudio {
  private fallback = new SpeechTts();
  private audio: HTMLAudioElement | null = null;
  private generation = 0;
  constructor(private report: (message: string) => void) {}
  /** Every current beginner phrase has a bundled sample, independent of OS voices. */
  get cantoneseAvailable(): boolean {
    return true;
  }
  stop(): void {
    this.generation++;
    this.fallback.stop();
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio = null;
    }
  }
  async speak(text: string, options: { rate?: number } = {}): Promise<void> {
    this.stop();
    const file = audioFileFor(text);
    if (!file) {
      if (this.fallback.cantoneseAvailable) this.fallback.speak(text, options);
      else this.report("这句尚无内置音频，设备也没有粤语音色；不会用普通话声音替代。");
      return;
    }
    const generation = this.generation;
    const audio = new Audio(`${import.meta.env.BASE_URL}${file}`);
    this.audio = audio;
    audio.playbackRate = Math.max(0.5, Math.min(1.2, options.rate ?? 1));
    audio.preservesPitch = true;
    const fail = () => {
      if (generation === this.generation)
        this.report(
          "示范音频暂时无法播放。请联网重新加载后重试；仍可阅读和录音，不会播放非粤语替代声音。"
        );
    };
    audio.onerror = fail;
    audio.onended = () => {
      if (generation === this.generation) this.report("示范播放结束。现在试着自己说一遍。");
    };
    try {
      await audio.play();
      if (generation === this.generation)
        this.report("正在播放内置粤语合成示范；语速调整保留音高。");
    } catch {
      fail();
    }
  }
}
