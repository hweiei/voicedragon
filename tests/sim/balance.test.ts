/**
 * P5 平衡仿真 CI 守卫（REDESIGN-PLAN §7.7 / §10 验收）：
 * - 确定性：同种子必同结果（战役可复现的基石）；
 * - 难度带：贪心参考 Bot（声韵均值 74）三幕胜率均须落在 55%–75%
 *   （P16 乐学快打：学习工具定位，"赢得顺、说得多"优先，旧带 45–65 见 P16 方案 §1）；
 * - 技能梯度：发音更好的玩家胜率必须更高（声即法力）；
 * - 超时保护：正常不应触发（90 回合未分胜负 = 死锁，判负局须为 0；真实游戏无回合上限）。
 *
 * 与 docs/BALANCE-REPORT.md 同源（同种子基 / 同局数），报表与 CI 数字一致。
 */

import { describe, expect, test } from "vitest";
import { ACT_PACKS } from "../../src/core/content";
import { simulateAct, simulateCampaign } from "../../src/core/sim";

const RUNS = 300;

describe("simulation determinism", () => {
  test("same act + seed produces the identical run", () => {
    const first = simulateCampaign({ act: 1, seed: 424242, bot: "greedy" });
    const second = simulateCampaign({ act: 1, seed: 424242, bot: "greedy" });
    expect(first).toEqual(second);
  });

  test("aggregates are stable across calls (fixed seed stream)", () => {
    const first = simulateAct({ act: 2, bot: "greedy", runs: 60 });
    const second = simulateAct({ act: 2, bot: "greedy", runs: 60 });
    expect(second.wins).toBe(first.wins);
    expect(second.avgFloor).toBe(first.avgFloor);
  });
});

describe("balance band: greedy reference bot within 55%–75% per act (P16)", () => {
  for (const pack of ACT_PACKS) {
    test(`act ${pack.act} (${pack.theme})`, () => {
      const summary = simulateAct({ act: pack.act, bot: "greedy", runs: RUNS });
      expect(summary.timeouts).toBe(0);
      expect(summary.winRate).toBeGreaterThanOrEqual(0.55);
      expect(summary.winRate).toBeLessThanOrEqual(0.75);
    });
  }

  test("random (floor) bot stays far below the reference bot", () => {
    const reference = simulateAct({ act: 1, bot: "greedy", runs: 120 });
    const floor = simulateAct({ act: 1, bot: "random", runs: 120 });
    expect(floor.winRate).toBeLessThan(reference.winRate);
  });
});

describe("skill gradient (声即法力)", () => {
  test("better pronunciation wins more often", () => {
    const strong = simulateAct({
      act: 1,
      bot: "greedy",
      runs: 120,
      profile: { voiceMean: 92, voiceSd: 8 }
    });
    const weak = simulateAct({
      act: 1,
      bot: "greedy",
      runs: 120,
      profile: { voiceMean: 60, voiceSd: 10 }
    });
    expect(strong.winRate).toBeGreaterThan(weak.winRate);
  });
});
