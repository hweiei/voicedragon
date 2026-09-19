/**
 * P5 音效映射纯函数测试：引擎 effect → SFX、游戏相位 → BGM 情绪。
 * （合成器本身依赖 Web Audio，属浏览器域——由 E2E 冒烟覆盖。）
 */

import { describe, expect, test } from "vitest";
import { bgmLayersFor, bgmMoodForPhase, sfxForEffect } from "../../src/adapters/audio";

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

describe("P11 bgmLayersFor（纵向分层纯函数）", () => {
  test("非战斗相位两层全关", () => {
    expect(bgmLayersFor({ phase: "title" })).toEqual({ rhythm: false, sparkle: false });
    expect(bgmLayersFor({ phase: "tower", combat: { bravo: 3 } })).toEqual({
      rhythm: false,
      sparkle: false
    });
  });
  test("节奏层：Boss 二阶段或生命 <40%", () => {
    expect(
      bgmLayersFor({
        phase: "battle",
        combat: { bossPhase: { phase: 2 } },
        player: { hp: 100, maxHp: 100 }
      })
    ).toEqual({ rhythm: true, sparkle: false });
    expect(bgmLayersFor({ phase: "battle", combat: {}, player: { hp: 39, maxHp: 100 } })).toEqual({
      rhythm: true,
      sparkle: false
    });
    expect(
      bgmLayersFor({
        phase: "battle",
        combat: { bossPhase: { phase: 1 } },
        player: { hp: 80, maxHp: 100 }
      })
    ).toEqual({ rhythm: false, sparkle: false });
  });
  test("彩层：彩 ≥2", () => {
    expect(
      bgmLayersFor({ phase: "battle", combat: { bravo: 2 }, player: { hp: 100, maxHp: 100 } })
    ).toEqual({ rhythm: false, sparkle: true });
    expect(
      bgmLayersFor({ phase: "battle", combat: { bravo: 1 }, player: { hp: 100, maxHp: 100 } })
    ).toEqual({ rhythm: false, sparkle: false });
  });
});
