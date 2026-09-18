import { describe, expect, test } from "vitest";
import { pickCantoneseVoice } from "../../src/adapters/tts";

describe("TTS 粤语声挑选", () => {
  test("zh-HK 优先级最高", () => {
    const voice = pickCantoneseVoice([
      { name: "Sinji", lang: "zh-HK" },
      { name: "Ting-Ting", lang: "zh-CN" }
    ]);
    expect(voice?.name).toBe("Sinji");
  });

  test("无 zh-HK 时按名称 Cantonese/yue 兜底", () => {
    const voice = pickCantoneseVoice([
      { name: "Microsoft Cantonese (Tracy)", lang: "zh-CN" },
      { name: "Xiaoxiao", lang: "zh-CN" }
    ]);
    expect(voice?.name).toContain("Cantonese");
    const yue = pickCantoneseVoice([{ name: "YueVoice", lang: "en-US" }]);
    expect(yue?.name).toBe("YueVoice");
  });

  test("zh-Hant-HK 优于其他中文声", () => {
    const voice = pickCantoneseVoice([
      { name: "Putonghua", lang: "zh-CN" },
      { name: "Hant HK Voice", lang: "zh-Hant-HK" }
    ]);
    expect(voice?.lang).toBe("zh-Hant-HK");
  });

  test("无序兜底：任一 zh-*，再系统默认，再第一位", () => {
    const zh = pickCantoneseVoice([
      { name: "A", lang: "en-US" },
      { name: "B", lang: "zh-TW", default: false }
    ]);
    expect(zh?.name).toBe("B");
    const dft = pickCantoneseVoice([
      { name: "A", lang: "en-US", default: true },
      { name: "B", lang: "fr-FR" }
    ]);
    expect(dft?.name).toBe("A");
    expect(pickCantoneseVoice([])).toBeNull();
  });
});
