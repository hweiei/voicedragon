/**
 * P13 词林力量化独立平衡门（与 P11/P12 门分报）：
 * 1. 三档掌握度 × 三角色 × 三幕全部落 45–65%、零超时；
 * 2. 「掌握关」行与 P11/P12 基线**逐位一致**（练度不足 = 零影响）；
 * 3. 保底真实救场（机制在运转）且不越正音线。
 * 报告：docs/P13-BALANCE-REPORT.md（`npm run sim:p13` 复现）。
 */

import { describe, expect, test } from "vitest";
import { CHARACTERS } from "../../src/core/content/roster";
import { MASTERY_FLOOR, MASTERY_MASTER_THRESHOLD } from "../../src/core/mastery";
import { simulateAct } from "../../src/core/sim";

const base = {
  bot: "greedy" as const,
  runs: 300,
  ruleset: "p7" as const,
  buildVersion: 1 as const,
  encounterVersion: 1 as const,
  counterVersion: 1 as const,
  rosterVersion: 1 as const,
  ultimateVersion: 1 as const,
  masteryPowerVersion: 1 as const
};

const PROFILES = [
  ["掌握关（无练习数据）", undefined],
  ["起始牌组全掌握", { score: 95, attempts: 4, deckOnly: true }],
  ["全卡池全掌握（理论最坏上界）", { score: 95, attempts: 4 }]
] as const;

/** P11/P12 基线（同种子同配置，逐位对照）。 */
const BASELINE_WINS: Record<string, number[]> = {
  "man-mou-saang": [189, 177, 169],
  "faa-daan": [193, 181, 177],
  "cau-saang": [185, 175, 156]
};

describe("P13 词林力量化独立平衡门", () => {
  test.each(
    CHARACTERS.flatMap((character) =>
      PROFILES.map(([label, profile]) => [character.id, label, profile] as const)
    )
  )(
    "%s · %s：三幕 45–65%、零超时",
    (character, _label, profile) => {
      for (const act of [1, 2, 3]) {
        const result = simulateAct({
          ...base,
          act,
          character,
          qteSource: character === "cau-saang",
          ...(profile ? { masteryProfile: { ...profile } } : {})
        });
        expect(result.winRate).toBeGreaterThanOrEqual(0.45);
        expect(result.winRate).toBeLessThanOrEqual(0.65);
        expect(result.timeouts).toBe(0);
      }
    },
    180_000
  );

  test.each(CHARACTERS.map((character) => [character.id, character.name] as const))(
    "%s 掌握关行与基线逐位一致，且保底零生效",
    (character, _name) => {
      for (const act of [1, 2, 3]) {
        const result = simulateAct({
          ...base,
          act,
          character,
          qteSource: character === "cau-saang"
        });
        expect(result.wins).toBe(BASELINE_WINS[character][act - 1]);
        expect(result.masterySaves).toBe(0);
      }
    },
    180_000
  );

  test("保底真实救场（不是空转），且保底线严格低于正音线", () => {
    expect(MASTERY_FLOOR).toBeLessThan(MASTERY_MASTER_THRESHOLD);
    const deck = simulateAct({
      ...base,
      act: 1,
      character: "faa-daan",
      masteryProfile: { score: 95, attempts: 4, deckOnly: true }
    });
    expect(deck.masterySaves ?? 0).toBeGreaterThan(0);
    // 同一配置可复现（确定性）
    const repeat = simulateAct({
      ...base,
      act: 1,
      character: "faa-daan",
      masteryProfile: { score: 95, attempts: 4, deckOnly: true }
    });
    expect(repeat).toEqual(deck);
    // 未开启门控时不产生保底统计（旧局零接触）
    const legacy = simulateAct({
      ...base,
      act: 1,
      character: "faa-daan",
      masteryPowerVersion: undefined
    });
    expect(legacy.masterySaves).toBeUndefined();
  }, 180_000);
});
