import { describe, expect, test } from "vitest";
import type { ToneScoreDetail } from "../../src/core/tone";
import { buildVoiceCoach, parseJyutpingSyllables } from "../../src/core/voice-coach";

function detail(
  expectedTones: number[],
  perSyllable: number[],
  detectedTones = expectedTones
): ToneScoreDetail {
  return {
    score: Math.round(perSyllable.reduce((sum, value) => sum + value, 0) / perSyllable.length),
    perSyllable,
    expectedTones,
    detectedTones,
    userCurve: [0, 1],
    template: [0, 1]
  };
}

describe("P8-C voice coach", () => {
  test("parses tone-numbered jyutping tokens in order", () => {
    expect(parseJyutpingSyllables("ding2 ngaang6 soeng6")).toEqual([
      { text: "ding2", tone: 2 },
      { text: "ngaang6", tone: 6 },
      { text: "soeng6", tone: 6 }
    ]);
    expect(parseJyutpingSyllables("无调号 hello")).toEqual([]);
  });

  test("chooses the first lowest syllable deterministically", () => {
    const coach = buildVoiceCoach("ding2 ngaang6 soeng6", detail([2, 6, 6], [88, 52, 52]), 90);
    expect(coach.focus?.index).toBe(1);
    expect(coach.focus?.levelLabel).toBe("重点练");
    expect(coach.syllables.map((part) => part.isFocus)).toEqual([false, true, false]);
  });

  test("explains a conservative detected-tone mismatch", () => {
    const coach = buildVoiceCoach("gaa1 jau4", detail([1, 4], [90, 42], [1, 2]), 91);
    expect(coach.headline).toContain("第 2 音节");
    expect(coach.advice).toContain("更接近 2 调");
    expect(coach.advice).toContain("目标是 4 调");
  });

  test("low word accuracy takes coaching priority without discarding tone focus", () => {
    const coach = buildVoiceCoach("gaa1 jau4", detail([1, 4], [92, 50], [1, 2]), 44);
    expect(coach.hasToneData).toBe(true);
    expect(coach.headline).toContain("先说清");
    expect(coach.advice).toContain("字准 44 分");
    expect(coach.focus?.tone).toBe(4);
  });

  test("missing or malformed F0 detail falls back honestly", () => {
    const absent = buildVoiceCoach("gaa1 jau4", null, 88);
    expect(absent.hasToneData).toBe(false);
    expect(absent.advice).toContain("没有基频通道");

    const malformed = buildVoiceCoach("gaa1 jau4", detail([1], [80]), 50);
    expect(malformed.hasToneData).toBe(false);
    expect(malformed.headline).toContain("说清");
  });

  test("all stable syllables get reinforcement rather than a false error", () => {
    const coach = buildVoiceCoach("gaa1 jau4", detail([1, 4], [91, 87]), 93);
    expect(coach.headline).toContain("都已稳定");
    expect(coach.advice).toContain("最低音节也有 87 分");
  });
});
