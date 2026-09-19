import { describe, expect, test } from "vitest";
import { BRAVO_MAX, bravoTransition, ultimateEnabled, ultimateResolve } from "../../src/core/bravo";

describe("P11 满堂彩纯规则", () => {
  test("门控：仅 p7 + ultimateVersion=1 + 战役同时满足才启用", () => {
    expect(ultimateEnabled({ ultimateVersion: 1, ruleset: "p7", campaign: {} })).toBe(true);
    expect(ultimateEnabled({ ultimateVersion: 1, ruleset: "p7", campaign: null })).toBe(false);
    expect(ultimateEnabled({ ultimateVersion: 1, ruleset: "legacy", campaign: {} })).toBe(false);
    expect(ultimateEnabled({ ruleset: "p7", campaign: {} })).toBe(false);
    expect(ultimateEnabled({})).toBe(false);
  });

  test("彩转移：裸分 ≥85 蓄彩封顶 3；<65 断彩；其间保持；非法 prev 钳制", () => {
    expect(bravoTransition(0, 85)).toBe(1);
    expect(bravoTransition(2, 85)).toBe(3);
    expect(bravoTransition(3, 100)).toBe(BRAVO_MAX);
    expect(bravoTransition(3, 64)).toBe(0);
    expect(bravoTransition(2, 65)).toBe(2); // 中段保持
    expect(bravoTransition(2, 84)).toBe(2);
    expect(bravoTransition(-5, 90)).toBe(1); // 负值钳制
    expect(bravoTransition(99, 70)).toBe(BRAVO_MAX); // 超值钳制
  });

  test("文武生绝技：15×档位；正音无视护甲", () => {
    const plan = ultimateResolve("man-mou-saang", 1.32, 90, null);
    expect(plan.damage).toBe(20); // round(15×1.32)
    expect(plan.bypassArmor).toBe(true);
    const clear = ultimateResolve("man-mou-saang", 1.0, 80, null);
    expect(clear.bypassArmor).toBe(false);
    expect(clear.damage).toBe(15);
  });

  test("花旦绝技：5×档位回复与护甲；调准 ≥80 再 +2（无调准通道不触发）", () => {
    const plan = ultimateResolve("faa-daan", 1.32, 90, 85);
    expect(plan.heal).toBe(9); // round(5×1.32)=7 + 2
    expect(plan.armor).toBe(7);
    expect(plan.clearInterference).toBe(true);
    const noTone = ultimateResolve("faa-daan", 1.32, 90, null);
    expect(noTone.heal).toBe(7);
    const lowTone = ultimateResolve("faa-daan", 1.32, 90, 79);
    expect(lowTone.heal).toBe(7);
  });

  test("丑生绝技：5×档位伤害 + 虚弱 3 + 夺全甲 + 换手", () => {
    const plan = ultimateResolve("cau-saang", 1.0, 74, null);
    expect(plan).toMatchObject({
      damage: 5,
      weaknessTurns: 3,
      stealAllArmor: true,
      redraw: true
    });
  });

  test("未知角色：空计划（零副作用）", () => {
    const plan = ultimateResolve("unknown" as "faa-daan", 1.32, 90, 90);
    expect(plan.damage).toBe(0);
    expect(plan.heal).toBe(0);
  });
});
