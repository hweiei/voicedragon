/**
 * P17 词海独立平衡门（与旧门分报）：
 * 1. 基线（不带 lexicon）与 P16 报表逐位一致——扩容零漂移的直接证据；
 * 2. 词海局（全版本 + lexicon）三角色 × 三幕落 55–85%、零超时；
 * 3. 技能梯度仍在（声即法力不因池扩大而失效）。
 * 报告：docs/P17-LEXICON-PLAN.md §4（复现：npx vitest run tests/sim/p17-balance.test.ts）。
 */

import { describe, expect, test } from "vitest";
import { CHARACTERS } from "../../src/core/content/roster";
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
  forgeVersion: 1 as const
};

describe("P17 词海独立平衡门", () => {
  test("基线（不带 lexicon）与 P16 快照逐位一致（扩容零漂移）", () => {
    const wins = [1, 2, 3].map((act) => simulateAct({ act, bot: "greedy", runs: 300 }).wins);
    expect(wins).toEqual([191, 202, 215]);
  });

  test.each(CHARACTERS.map((character) => [character.id, character.name] as const))(
    "%s 词海局：三幕 55–85%、零超时",
    (character) => {
      for (const act of [1, 2, 3]) {
        const result = simulateAct({
          ...base,
          act,
          character,
          lexiconVersion: 1,
          qteSource: character === "cau-saang"
        });
        expect(result.timeouts).toBe(0);
        expect(result.winRate).toBeGreaterThanOrEqual(0.55);
        expect(result.winRate).toBeLessThanOrEqual(0.85);
      }
    },
    180_000
  );

  test("技能梯度仍在（词海局发音更好胜率更高）", () => {
    const strong = simulateAct({
      ...base,
      act: 1,
      lexiconVersion: 1,
      runs: 120,
      profile: { voiceMean: 92, voiceSd: 8 }
    });
    const weak = simulateAct({
      ...base,
      act: 1,
      lexiconVersion: 1,
      runs: 120,
      profile: { voiceMean: 60, voiceSd: 10 }
    });
    expect(strong.winRate).toBeGreaterThan(weak.winRate);
  });
});
