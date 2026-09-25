import { describe, expect, test, vi } from "vitest";
import { SpeechTts, hasCantoneseVoice, pickCantoneseVoice } from "../../src/adapters/tts";
import { LESSONS, canAdvance, routeFor } from "../../src/beginner/curriculum";
describe("beginner tower", () => {
  test("six lessons with valid scenario answers", () => {
    expect(LESSONS).toHaveLength(6);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(6);
    for (const l of LESSONS) {
      expect(l.answers[l.correct]).toBeTruthy();
      expect(l.jyutping).toMatch(/[1-6]/);
    }
  });
  test("reading and recording both require scenario completion", () => {
    expect(canAdvance(false, true, false)).toBe(false);
    expect(canAdvance(true, false, false)).toBe(false);
    expect(canAdvance(true, false, true)).toBe(true);
    expect(canAdvance(true, true, false)).toBe(true);
  });
  test("route is stable by seed and keeps six teaching steps", () => {
    expect(routeFor(42)).toEqual(routeFor(42));
    expect(routeFor(42)).toHaveLength(6);
    expect(routeFor(43)).not.toEqual(routeFor(42));
  });
  test("recognizes yue language tags even with unnamed voices", () => {
    const voices = [
      { name: "Mandarin", lang: "zh-CN" },
      { name: "Local voice", lang: "yue-HK" }
    ];
    expect(hasCantoneseVoice(voices)).toBe(true);
    expect(pickCantoneseVoice(voices)?.lang).toBe("yue-HK");
  });
  test("never speaks with a non-Cantonese fallback", () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [{ name: "Mandarin", lang: "zh-CN" }],
      addEventListener: vi.fn(),
      speak,
      cancel: vi.fn()
    });
    const tts = new SpeechTts();
    tts.speak("唔该");
    expect(speak).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
