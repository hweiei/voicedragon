import { describe, expect, test } from "vitest";
import { simulateAct, simulateCampaign } from "../../src/core/sim";

describe("P9 守势反击独立平衡门", () => {
  test.each([1, 2, 3])("幕%i参考Bot300局45–65%、零超时，反击真实触发", (act) => {
    const result = simulateAct({
      act,
      bot: "greedy",
      runs: 300,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1,
      counterVersion: 1
    });
    expect(result.winRate).toBeGreaterThanOrEqual(0.45);
    expect(result.winRate).toBeLessThanOrEqual(0.65);
    expect(result.timeouts).toBe(0);
    expect(result.counterHits).toBeGreaterThan(0);
  });
  test("同版本同种子可复现；不开 counterVersion 不产生反击统计与行为偏移", () => {
    const config = {
      act: 2,
      seed: 991,
      bot: "greedy" as const,
      ruleset: "p7" as const,
      buildVersion: 1 as const,
      encounterVersion: 1 as const,
      counterVersion: 1 as const
    };
    expect(simulateCampaign(config)).toEqual(simulateCampaign(config));
    const old = simulateCampaign({ ...config, counterVersion: undefined });
    expect(old.counterHits).toBeUndefined();
    // 同种子下，P8-B 基线与 P9 仅差反击内容（旧路径不被静默改动）
    const base = simulateCampaign({ ...config, counterVersion: undefined });
    expect(base).toEqual(simulateCampaign({ ...config, counterVersion: undefined }));
  });
  test("保留发音水平梯度；反击不改变难度下限（随机 Bot 仍近 0%）", () => {
    const config = {
      act: 1,
      bot: "greedy" as const,
      runs: 120,
      ruleset: "p7" as const,
      buildVersion: 1 as const,
      encounterVersion: 1 as const,
      counterVersion: 1 as const
    };
    const high = simulateAct({ ...config, profile: { voiceMean: 92, voiceSd: 8 } });
    const low = simulateAct({ ...config, profile: { voiceMean: 60, voiceSd: 10 } });
    expect(high.winRate).toBeGreaterThan(low.winRate);
    const random = simulateAct({
      act: 1,
      bot: "random",
      runs: 120,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1,
      counterVersion: 1
    });
    expect(random.winRate).toBeLessThanOrEqual(0.05);
  });
});
