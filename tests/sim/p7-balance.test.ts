import { describe, expect, test } from "vitest";
import { simulateAct, simulateCampaign } from "../../src/core/sim";

describe("P7 扩展版独立平衡门（不替代基础版）", () => {
  test.each([1, 2, 3])("幕 %i 参考 Bot 300局胜率45–65%，零超时", (act) => {
    const summary = simulateAct({ act, bot: "greedy", runs: 300, ruleset: "p7" });
    expect(summary.timeouts).toBe(0);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.45);
    expect(summary.winRate).toBeLessThanOrEqual(0.65);
  });
  test("同种子同规则同结果", () => {
    const options = { act: 2, seed: 42, bot: "greedy" as const, ruleset: "p7" as const };
    expect(simulateCampaign(options)).toEqual(simulateCampaign(options));
  });
  test("P7 保留发音水平梯度", () => {
    const strong = simulateAct({
      act: 1,
      bot: "greedy",
      runs: 120,
      ruleset: "p7",
      profile: { voiceMean: 92, voiceSd: 8 }
    });
    const weak = simulateAct({
      act: 1,
      bot: "greedy",
      runs: 120,
      ruleset: "p7",
      profile: { voiceMean: 60, voiceSd: 10 }
    });
    expect(strong.winRate).toBeGreaterThan(weak.winRate);
  });
});
