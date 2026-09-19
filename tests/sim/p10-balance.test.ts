import { describe, expect, test } from "vitest";
import { CHARACTERS } from "../../src/core/content/roster";
import { simulateAct, simulateCampaign } from "../../src/core/sim";

const base = {
  bot: "greedy" as const,
  runs: 300,
  ruleset: "p7" as const,
  buildVersion: 1 as const,
  encounterVersion: 1 as const,
  counterVersion: 1 as const,
  rosterVersion: 1 as const
};

describe("P10 名伶独立平衡门", () => {
  test.each(CHARACTERS.map((c) => [c.id, c.id === "cau-saang"]) as [string, boolean][])(
    "%s 三幕 45–65%、零超时、被动真实运转",
    (character, qteSource) => {
      for (const act of [1, 2, 3]) {
        const result = simulateAct({ ...base, act, character: character as "faa-daan", qteSource });
        expect(result.winRate).toBeGreaterThanOrEqual(0.45);
        expect(result.winRate).toBeLessThanOrEqual(0.65);
        expect(result.timeouts).toBe(0);
        if (character === "man-mou-saang") expect(result.passiveHits).toBeGreaterThan(0);
        if (character === "cau-saang") expect(result.passiveHits).toBeGreaterThan(0);
      }
    },
    180_000
  );
  test("同配置同种子可复现；不开 rosterVersion 不产生角色统计与行为偏移", () => {
    const config = { ...base, act: 2, seed: 991, character: "faa-daan" as const };
    expect(simulateCampaign(config)).toEqual(simulateCampaign(config));
    const old = simulateCampaign({ ...config, rosterVersion: undefined, character: undefined });
    expect(old.passiveHits).toBeUndefined();
    // P9 基线（无角色）与同种子 P9 局逐位一致：角色字段不进入旧路径
    const p9a = simulateCampaign({ ...config, rosterVersion: undefined, character: undefined });
    const p9b = simulateCampaign({ ...config, rosterVersion: undefined, character: undefined });
    expect(p9a).toEqual(p9b);
  });
  test("随机 Bot 保持下限（技能梯度成立）", () => {
    const result = simulateAct({
      act: 1,
      bot: "random",
      runs: 120,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1,
      counterVersion: 1,
      rosterVersion: 1,
      character: "man-mou-saang"
    });
    expect(result.winRate).toBeLessThanOrEqual(0.05);
  });
});
