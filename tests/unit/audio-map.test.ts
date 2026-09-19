/**
 * P5 音效映射纯函数测试：引擎 effect → SFX、游戏相位 → BGM 情绪。
 * （合成器本身依赖 Web Audio，属浏览器域——由 E2E 冒烟覆盖。）
 */

import { describe, expect, test } from "vitest";
import { bgmMoodForPhase, sfxForEffect } from "../../src/adapters/audio";

describe("sfxForEffect", () => {
  test("maps every engine effect to a sound", () => {
    expect(sfxForEffect("hit")).toBe("hit");
    expect(sfxForEffect("skill")).toBe("skill");
    expect(sfxForEffect("enemy")).toBe("enemy");
    expect(sfxForEffect("item")).toBe("item");
    expect(sfxForEffect("defeat")).toBe("defeat");
    expect(sfxForEffect("victory")).toBe("victory");
    expect(sfxForEffect("treasure")).toBe("treasure");
    expect(sfxForEffect("star")).toBe("star");
  });

  test("unknown or missing effects stay silent", () => {
    expect(sfxForEffect(undefined)).toBeNull();
    expect(sfxForEffect("save")).toBeNull();
    expect(sfxForEffect("")).toBeNull();
  });
});

describe("bgmMoodForPhase", () => {
  test("battle gets the tense mood, tower phases get explore", () => {
    expect(bgmMoodForPhase("battle")).toBe("battle");
    expect(bgmMoodForPhase("tower")).toBe("explore");
    expect(bgmMoodForPhase("shop")).toBe("explore");
    expect(bgmMoodForPhase("rest")).toBe("explore");
    expect(bgmMoodForPhase("quiz")).toBe("explore");
    expect(bgmMoodForPhase("reward")).toBe("explore");
  });

  test("title has its own mood; endings go silent for the sting", () => {
    expect(bgmMoodForPhase("title")).toBe("title");
    expect(bgmMoodForPhase("victory")).toBe("none");
    expect(bgmMoodForPhase("defeat")).toBe("none");
  });
});
