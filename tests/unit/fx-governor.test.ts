/**
 * P6-F3 帧率治理器状态机测试：升降档迟滞 / 手动覆盖 / 档位预算。
 * 时钟与阈值全部可注入，断言确定性。
 */

import { describe, expect, test } from "vitest";
import { FpsGovernor, TIER_BUDGETS } from "../../src/ui/fx/governor";

function makeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    }
  };
}

function fastGovernor(clock: ReturnType<typeof makeClock>): FpsGovernor {
  return new FpsGovernor({
    warmupFrames: 5,
    sustainMs: 100,
    slowMs: 24,
    fastMs: 18,
    now: clock.now
  });
}

/** 按固定帧间隔采样 n 帧。 */
function drive(
  governor: FpsGovernor,
  clock: ReturnType<typeof makeClock>,
  frames: number,
  intervalMs: number
): void {
  for (let i = 0; i < frames; i += 1) {
    clock.advance(intervalMs);
    governor.sample();
  }
}

describe("自动降档", () => {
  test("持续慢帧逐档降到告警档（0 → 1 → 2，不跳级）", () => {
    const clock = makeClock();
    const governor = fastGovernor(clock);
    const seen: number[] = [];
    governor.onTierChange = (tier) => seen.push(tier);

    drive(governor, clock, 10, 16); // 预热期
    expect(governor.tier).toBe(0);

    drive(governor, clock, 80, 30); // ~33fps，EMA 越过 24ms 并持续
    expect(seen).toEqual([1, 2]); // 逐档迁移，无跳级
    expect(governor.tier).toBe(2);
  });

  test("迟滞窗口内不迁移（短暂卡顿不掉档）", () => {
    const clock = makeClock();
    const governor = fastGovernor(clock);
    drive(governor, clock, 10, 16);
    drive(governor, clock, 3, 40); // 三帧卡顿，不足 100ms 迟滞
    expect(governor.tier).toBe(0);
  });
});

describe("自动升档", () => {
  test("帧率恢复后逐档回升", () => {
    const clock = makeClock();
    const governor = fastGovernor(clock);
    drive(governor, clock, 10, 16);
    drive(governor, clock, 100, 30);
    expect(governor.tier).toBe(2);

    drive(governor, clock, 80, 12); // ~83fps
    expect(governor.tier).toBeLessThan(2);
    drive(governor, clock, 80, 12);
    expect(governor.tier).toBe(0);
  });

  test("EMA 落在快慢阈值之间时档位冻结", () => {
    const clock = makeClock();
    const governor = fastGovernor(clock);
    drive(governor, clock, 10, 16);
    drive(governor, clock, 80, 30); // 先降到某档
    const stuck = governor.tier;
    expect(stuck).toBeGreaterThan(0);
    drive(governor, clock, 120, 21); // 21ms ∈ (18, 24)
    expect(governor.tier).toBe(stuck);
  });
});

describe("手动特效强度覆盖", () => {
  test("手动档固定覆盖自动档；auto 恢复自治", () => {
    const clock = makeClock();
    const governor = fastGovernor(clock);
    drive(governor, clock, 10, 16);
    drive(governor, clock, 100, 30); // 自动已降到档 2
    expect(governor.observedAutoTier).toBe(2);

    governor.setManualIntensity("full");
    expect(governor.tier).toBe(0);
    expect(governor.observedAutoTier).toBe(2); // 自动观测不受影响

    governor.setManualIntensity("balanced");
    expect(governor.tier).toBe(1);

    governor.setManualIntensity("eco");
    expect(governor.tier).toBe(2);

    governor.setManualIntensity("auto");
    expect(governor.tier).toBe(governor.observedAutoTier);
  });
});

describe("档位预算", () => {
  test("三档预算递减，告警档关汉字演出", () => {
    expect(TIER_BUDGETS[0]).toEqual({ burstRatio: 1, moteRatio: 1, kanjiEnabled: true });
    expect(TIER_BUDGETS[1].burstRatio).toBeLessThan(TIER_BUDGETS[0].burstRatio);
    expect(TIER_BUDGETS[2].burstRatio).toBeLessThan(TIER_BUDGETS[1].burstRatio);
    expect(TIER_BUDGETS[2].kanjiEnabled).toBe(false);
  });

  test("governor.budget 随档位切换", () => {
    const governor = new FpsGovernor();
    expect(governor.budget).toBe(TIER_BUDGETS[0]);
    governor.setManualIntensity("eco");
    expect(governor.budget).toBe(TIER_BUDGETS[2]);
  });
});
