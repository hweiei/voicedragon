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
  rosterVersion: 1 as const,
  ultimateVersion: 1 as const
};

describe("P11 满堂彩独立平衡门", () => {
  test.each(CHARACTERS.map((c) => [c.id, c.id === "cau-saang"]) as [string, boolean][])(
    "%s 三幕 55–85%、零超时（默认声韵下绝技罕见，参考 Bot 回归角色基线）",
    (character, qteSource) => {
      for (const act of [1, 2, 3]) {
        const result = simulateAct({ ...base, act, character: character as "faa-daan", qteSource });
        expect(result.winRate).toBeGreaterThanOrEqual(0.55);
        expect(result.winRate).toBeLessThanOrEqual(0.85);
        expect(result.timeouts).toBe(0);
      }
    },
    180_000
  );
  test("高声韵行绝技真实触发且不失控（每场一次封顶）；发音梯度保持", () => {
    const high = simulateAct({
      ...base,
      act: 1,
      character: "man-mou-saang",
      profile: { voiceMean: 92, voiceSd: 8 }
    });
    expect(high.ultimateCasts).toBeGreaterThan(0);
    const low = simulateAct({
      ...base,
      act: 1,
      character: "man-mou-saang",
      profile: { voiceMean: 60, voiceSd: 10 }
    });
    expect(high.winRate).toBeGreaterThan(low.winRate);
    expect(low.ultimateCasts ?? 0).toBe(0);
  });
  test("同配置可复现；不开 ultimateVersion 不产生绝技统计与彩字段", () => {
    const config = { ...base, act: 2, seed: 991, character: "faa-daan" as const };
    expect(simulateCampaign(config)).toEqual(simulateCampaign(config));
    const old = simulateCampaign({ ...config, ultimateVersion: undefined });
    expect(old.ultimateCasts).toBeUndefined();
  });
});
