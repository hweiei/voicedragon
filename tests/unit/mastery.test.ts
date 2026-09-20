/**
 * P13 判定保底（纯规则层）：三档边界、保底语义、门控。
 * 「词林不制造正音」是硬约束：保底线必须严格低于正音线（本文件守卫）。
 */

import { describe, expect, test } from "vitest";
import {
  MASTERY_FLOOR,
  MASTERY_MASTER_THRESHOLD,
  MASTERY_TIER1_ATTEMPTS,
  MASTERY_TIER1_SCORE,
  MASTERY_TIER2_ATTEMPTS,
  MASTERY_TIER2_SCORE,
  masteryEnabled,
  masteryFloorFor,
  masteryJudgeScore,
  masteryTierDistribution,
  skillMasteryView,
  syntheticMasteryStore
} from "../../src/core/mastery";
import { emptySrsStore } from "../../src/core/srs";

const TONES = [1, 4, 6];

describe("P13 掌握判定三档", () => {
  test("tier 边界：次数与均分双达标才算掌握；缺一个音节即整句不达标", () => {
    const store = syntheticMasteryStore([{ id: "s", tones: TONES }], MASTERY_TIER1_SCORE, 99);
    expect(skillMasteryView(store, "s", TONES).tier).toBe(1); // 次数够、均分刚好 80
    const higher = syntheticMasteryStore([{ id: "s", tones: TONES }], MASTERY_TIER2_SCORE, 99);
    expect(skillMasteryView(higher, "s", TONES).tier).toBe(2);
    const notEnoughAttempts = syntheticMasteryStore(
      [{ id: "s", tones: TONES }],
      MASTERY_TIER1_SCORE,
      MASTERY_TIER1_ATTEMPTS - 1
    );
    expect(skillMasteryView(notEnoughAttempts, "s", TONES).tier).toBe(0);
    const belowTier1 = syntheticMasteryStore(
      [{ id: "s", tones: TONES }],
      MASTERY_TIER1_SCORE - 1,
      5
    );
    expect(skillMasteryView(belowTier1, "s", TONES).tier).toBe(0);
    const tier2Attempts = syntheticMasteryStore(
      [{ id: "s", tones: TONES }],
      MASTERY_TIER2_SCORE,
      MASTERY_TIER2_ATTEMPTS - 1
    );
    expect(skillMasteryView(tier2Attempts, "s", TONES).tier).toBe(1);
  });

  test("缺音节不参与外推：三个音节里差一个就是 tier 0", () => {
    const full = syntheticMasteryStore([{ id: "s", tones: TONES }], 95, 4);
    const partial = { ...full, syllables: { s: full.syllables!.s.slice(0, 2) } };
    expect(skillMasteryView(full, "s", TONES).tier).toBe(2);
    expect(skillMasteryView(partial, "s", TONES).tier).toBe(0);
    expect(skillMasteryView(partial, "s", TONES).graded).toBe(2);
    expect(skillMasteryView(null, "s", TONES).tier).toBe(0);
    expect(masteryTierDistribution(full, [{ id: "s", tones: TONES }])).toEqual({
      tier0: 0,
      tier1: 0,
      tier2: 1,
      gradedSyllables: 3,
      totalSyllables: 3
    });
  });

  test("空 store 与未知技能一律零保底（练度不够就没有力量）", () => {
    expect(masteryFloorFor(emptySrsStore(), "s", TONES)).toBe(0);
    expect(
      masteryFloorFor(syntheticMasteryStore([{ id: "s", tones: TONES }], 95, 4), "s", TONES)
    ).toBe(MASTERY_FLOOR);
  });
});

describe("P13 判定保底落地", () => {
  test("保底只抬档位下限，绝不制造正音", () => {
    // 硬约束：保底线 < 正音线
    expect(MASTERY_FLOOR).toBeLessThan(MASTERY_MASTER_THRESHOLD);
    const low = masteryJudgeScore(41, MASTERY_FLOOR, (value) =>
      value >= 65 ? "clear" : "learning"
    );
    expect(low.judged).toBe(MASTERY_FLOOR);
    expect(low.applied).toBe(MASTERY_FLOOR - 41);
    expect(low.rescued).toBe(true);
    // 已经很清晰的分数：保底不生效（不额外加分）
    const high = masteryJudgeScore(92, MASTERY_FLOOR, (value) =>
      value >= 85 ? "master" : "clear"
    );
    expect(high.judged).toBe(92);
    expect(high.applied).toBe(0);
    expect(high.rescued).toBe(false);
    // 抬了分但档位没变（同档内）不算救场
    const sameTier = masteryJudgeScore(70, MASTERY_FLOOR, () => "clear");
    expect(sameTier.applied).toBe(0);
    expect(sameTier.rescued).toBe(false);
    // 无保底（未掌握）时逐位不变
    const none = masteryJudgeScore(41, 0, (value) => (value >= 65 ? "clear" : "learning"));
    expect(none).toEqual({ judged: 41, applied: 0, rescued: false });
  });

  test("门控：只有显式开启的 p7 新局才有保底（旧局连读档都不发生）", () => {
    expect(masteryEnabled({ masteryPowerVersion: 1, ruleset: "p7" })).toBe(true);
    expect(masteryEnabled({ masteryPowerVersion: 1, ruleset: "legacy" })).toBe(false);
    expect(masteryEnabled({ ruleset: "p7" })).toBe(false);
    expect(masteryEnabled(null)).toBe(false);
  });
});
