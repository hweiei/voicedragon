import { describe, expect, test } from "vitest";
import { simulateAct, simulateCampaign } from "../../src/core/sim";

describe("P8-A 构筑独立平衡门", () => {
  test.each([1, 2, 3])("幕 %i 300局55–85%，真升级/删牌且零超时", (act) => {
    const result = simulateAct({ act, bot: "greedy", runs: 300, ruleset: "p7", buildVersion: 1 });
    expect(result.winRate).toBeGreaterThanOrEqual(0.55);
    expect(result.winRate).toBeLessThanOrEqual(0.85);
    expect(result.timeouts).toBe(0);
    expect(result.upgrades).toBeGreaterThan(0);
    expect(result.removals).toBeGreaterThan(0);
  });
  test("同版本种子与策略可重复，旧P7没有构筑操作计数", () => {
    const config = {
      act: 2,
      seed: 991,
      bot: "greedy" as const,
      ruleset: "p7" as const,
      buildVersion: 1 as const
    };
    expect(simulateCampaign(config)).toEqual(simulateCampaign(config));
    expect(simulateCampaign({ ...config, buildVersion: undefined }).upgrades).toBeUndefined();
  });
  test("保留发音水平梯度", () => {
    const config = {
      act: 1,
      bot: "greedy" as const,
      runs: 120,
      ruleset: "p7" as const,
      buildVersion: 1 as const
    };
    const high = simulateAct({ ...config, profile: { voiceMean: 92, voiceSd: 8 } });
    const low = simulateAct({ ...config, profile: { voiceMean: 60, voiceSd: 10 } });
    expect(high.winRate).toBeGreaterThan(low.winRate);
  });
});
