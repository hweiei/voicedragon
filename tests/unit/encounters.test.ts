import { describe, expect, test } from "vitest";
import { BOSS_EVOLUTIONS, EVOLVED_ELITES } from "../../src/core/content/encounters";
import {
  forecastEnemyAction,
  intentAt,
  resolveEnemyAction,
  resolveIncomingHit,
  shouldQueuePhase
} from "../../src/core/encounters";

describe("P8-B 行动与受击公式", () => {
  test("吞音用固定值、先逐段取整再虚弱，不乘基础攻击", () => {
    expect(resolveEnemyAction({ type: "silence", amount: 8, label: "吞" }, 99, 0)).toMatchObject({
      damage: 8,
      hits: 1,
      voicePenalty: 10
    });
    expect(resolveEnemyAction({ type: "silence", amount: 8, label: "吞" }, 99, 1).damage).toBe(5);
    expect(
      resolveEnemyAction({ type: "attack", amount: 0.65, hits: 3, label: "连" }, 13, 1)
    ).toMatchObject({ damage: 5, hits: 3 });
  });
  test("护甲逐段扣减、龙鳞逐段触发；穿甲不消耗护甲也不触发龙鳞", () => {
    const action = resolveEnemyAction({ type: "attack", amount: 0.5, hits: 3, label: "连" }, 10, 0);
    expect(
      forecastEnemyAction(action, { armor: 6, hp: 72, vulnerable: false, dragonScale: false })
    ).toMatchObject({ hpLoss: 9, blocked: 6 });
    expect(
      forecastEnemyAction(action, { armor: 6, hp: 72, vulnerable: false, dragonScale: true })
    ).toMatchObject({ hpLoss: 6, blocked: 9 });
    expect(
      resolveIncomingHit(5, { armor: 10, vulnerable: false, dragonScale: true }, true)
    ).toEqual({ actual: 5, blocked: 0, armorAfter: 10 });
    expect(resolveIncomingHit(5, { armor: 0, vulnerable: false, dragonScale: true }, true)).toEqual(
      { actual: 5, blocked: 0, armorAfter: 0 }
    );
  });
  test("玩家易伤按每段取整，预计生命损失不超过当前HP", () => {
    const action = resolveEnemyAction({ type: "attack", amount: 1, hits: 2, label: "连" }, 5, 0);
    expect(
      forecastEnemyAction(action, { armor: 0, hp: 72, vulnerable: true, dragonScale: false }).hpLoss
    ).toBe(12);
    expect(
      forecastEnemyAction(action, { armor: 0, hp: 3, vulnerable: true, dragonScale: false }).hpLoss
    ).toBe(3);
  });
  test("纯蓄势/加甲/干扰不产生隐藏伤害，文案列明附加效果", () => {
    const charge = resolveEnemyAction({ type: "charge", selfVulnerable: 1, label: "蓄" }, 99, 0);
    const preview = forecastEnemyAction(charge, {
      armor: 0,
      hp: 72,
      vulnerable: false,
      dragonScale: false
    });
    expect(preview.hpLoss).toBe(0);
    expect(preview.detail).toContain("露隙 1");
    const debuff = resolveEnemyAction({ type: "debuff", amount: 2, label: "扰" }, 99, 0);
    expect(debuff).toMatchObject({ damage: 0, hits: 0, voicePenalty: 14 });
    expect(resolveEnemyAction({ type: "guard", guard: 12, label: "守" }, 99, 0)).toMatchObject({
      damage: 0,
      hits: 0,
      guard: 12
    });
  });
});

describe("阶段纯状态约束与数据", () => {
  test("50%边界、已排队/二阶段/死亡/未知Boss均不重复排队", () => {
    const p = { phase: 1 as const, pending: false, startTurn: 1 };
    expect(shouldQueuePhase("nine-tone-dragon", 50, 100, p)).toBe(true);
    expect(shouldQueuePhase("nine-tone-dragon", 51, 100, p)).toBe(false);
    expect(shouldQueuePhase("nine-tone-dragon", 0, 100, p)).toBe(false);
    expect(shouldQueuePhase("nine-tone-dragon", 40, 100, { ...p, pending: true })).toBe(false);
    expect(shouldQueuePhase("nine-tone-dragon", 40, 100, { ...p, phase: 2 })).toBe(false);
    expect(shouldQueuePhase("unknown", 40, 100, p)).toBe(false);
  });
  test("阶段内索引从切换回合开始，循环正确", () => {
    const pattern = BOSS_EVOLUTIONS["nine-dragon-true"].pattern;
    const phase = { phase: 2 as const, pending: false, startTurn: 4 };
    expect(intentAt(pattern, 4, phase).type).toBe("charge");
    expect(intentAt(pattern, 5, phase).pierce).toBe(true);
    expect(intentAt(pattern, 8, phase).type).toBe("charge");
  });
  test("三Boss/三精英数据合法，每个第二阶段以无伤蓄势开场", () => {
    expect(Object.keys(BOSS_EVOLUTIONS)).toHaveLength(3);
    expect(new Set(Object.values(EVOLVED_ELITES).map((e) => e.id)).size).toBe(3);
    for (const def of Object.values(BOSS_EVOLUTIONS)) {
      expect(def.threshold).toBe(0.5);
      expect(def.pattern[0].type).toBe("charge");
      expect(def.counterplay.length).toBeGreaterThan(10);
    }
    for (const pattern of [
      ...Object.values(BOSS_EVOLUTIONS).map((p) => p.pattern),
      ...Object.values(EVOLVED_ELITES).map((e) => e.pattern)
    ]) {
      for (const intent of pattern) {
        const action = resolveEnemyAction(intent, 15, 0);
        expect(Number.isFinite(action.damage)).toBe(true);
        expect(action.damage).toBeGreaterThanOrEqual(0);
        if (intent.pierce) expect(intent.type).toBe("attack");
        if (intent.selfVulnerable) expect(intent.selfVulnerable).toBe(1);
      }
    }
  });
});
