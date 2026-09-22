import { describe, expect, test } from "vitest";
import { simulateAct, simulateCampaign } from "../../src/core/sim";

describe("P8-B 对手进化独立平衡门", () => {
  test.each([1, 2, 3])("幕%i参考Bot300局55–85%、零超时，真实经历二阶段及新精英", (act) => {
    const result = simulateAct({
      act,
      bot: "greedy",
      runs: 300,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1
    });
    expect(result.winRate).toBeGreaterThanOrEqual(0.55);
    expect(result.winRate).toBeLessThanOrEqual(0.85);
    expect(result.timeouts).toBe(0);
    expect(result.bossPhases).toBeGreaterThan(0);
    expect(result.newElites).toBeGreaterThan(0);
  });
  test("同版本同种子可复现；旧P8-A不添加对手进化统计字段", () => {
    const config = {
      act: 2,
      seed: 991,
      bot: "greedy" as const,
      ruleset: "p7" as const,
      buildVersion: 1 as const,
      encounterVersion: 1 as const
    };
    expect(simulateCampaign(config)).toEqual(simulateCampaign(config));
    const old = simulateCampaign({ ...config, encounterVersion: undefined });
    expect(old.bossPhases).toBeUndefined();
    expect(old.newElites).toBeUndefined();
  });
  test("保留发音水平梯度", () => {
    const config = {
      act: 1,
      bot: "greedy" as const,
      runs: 120,
      ruleset: "p7" as const,
      buildVersion: 1 as const,
      encounterVersion: 1 as const
    };
    const high = simulateAct({ ...config, profile: { voiceMean: 92, voiceSd: 8 } });
    const low = simulateAct({ ...config, profile: { voiceMean: 60, voiceSd: 10 } });
    expect(high.winRate).toBeGreaterThan(low.winRate);
  });
});
