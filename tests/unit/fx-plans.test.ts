/**
 * P6-F1 演出计划纯函数测试：effect → FxPlan 映射、震屏振幅分级、暴击/重击阈值。
 * （导演与 DOM 播放属浏览器域——由 E2E fx.spec.ts 覆盖。）
 */

import { describe, expect, test } from "vitest";
import {
  CRIT_SCORE,
  HITSTOP_HEAVY_MS,
  HITSTOP_NORMAL_MS,
  SHAKE_MAX_AMP,
  SHAKE_MIN_AMP,
  ampFor,
  planFor
} from "../../src/ui/fx/plans";

describe("ampFor 震屏振幅分级", () => {
  test("随伤害/敌方上限比例线性增长，两端夹取", () => {
    expect(ampFor(0, 100)).toBe(SHAKE_MIN_AMP);
    expect(ampFor(-3, 100)).toBe(SHAKE_MIN_AMP);
    expect(ampFor(30, 100)).toBe(3.8); // 2 + 6 × 0.3
    expect(ampFor(100, 100)).toBe(SHAKE_MAX_AMP);
    expect(ampFor(999, 100)).toBe(SHAKE_MAX_AMP); // 夹取上限
  });

  test("敌方上限缺失/非法时用温和默认占比，不给出满幅", () => {
    expect(ampFor(10, 0)).toBe(4.4); // 2 + 6 × 0.4
    expect(ampFor(10, -5)).toBe(4.4);
  });
});

describe("planFor: hit（我方命中）", () => {
  test("常规命中：伤害浮字 + 敌人抖动/闪光 + 常规 hit-stop", () => {
    const plan = planFor("hit", { damage: 12, enemyMaxHp: 100, score: 70 });
    expect(plan).not.toBeNull();
    expect(plan?.id).toBe("hit");
    expect(plan?.crit).toBe(false);
    expect(plan?.hitstopMs).toBe(HITSTOP_NORMAL_MS);
    expect(plan?.floaters?.[0]).toMatchObject({
      text: "-12",
      kind: "damage",
      target: "enemy-stage",
      crit: false
    });
    expect(plan?.shakes).toEqual([{ target: "enemy", amp: ampFor(12, 100), ms: 320 }]);
    expect(plan?.flashes).toEqual([{ target: "enemy", ms: 90 }]);
  });

  test("重击（≥30% 敌方上限）延长 hit-stop", () => {
    expect(planFor("hit", { damage: 30, enemyMaxHp: 100 })?.hitstopMs).toBe(HITSTOP_HEAVY_MS);
    expect(planFor("hit", { damage: 29, enemyMaxHp: 100 })?.hitstopMs).toBe(HITSTOP_NORMAL_MS);
  });

  test("rawScore ≥ 90 判暴击：计划与浮字都带 crit 标记", () => {
    const crit = planFor("hit", { damage: 10, enemyMaxHp: 100, score: CRIT_SCORE });
    expect(crit?.id).toBe("hit.crit");
    expect(crit?.crit).toBe(true);
    expect(crit?.floaters?.[0]?.crit).toBe(true);
    expect(planFor("hit", { damage: 10, enemyMaxHp: 100, score: CRIT_SCORE - 1 })?.crit).toBe(
      false
    );
  });

  test("护甲/治疗随命中一起进浮字队列（玩家侧）", () => {
    const plan = planFor("hit", { damage: 5, armor: 3, healing: 2, enemyMaxHp: 50 });
    expect(plan?.floaters).toHaveLength(3);
    expect(plan?.floaters?.[1]).toMatchObject({
      text: "+3",
      kind: "armor",
      target: "player-status"
    });
    expect(plan?.floaters?.[2]).toMatchObject({
      text: "+2",
      kind: "heal",
      target: "player-status"
    });
  });

  test("无伤害的 hit 兜底为纯增益计划；完全无动作则无计划", () => {
    const buff = planFor("hit", { damage: 0, armor: 4 });
    expect(buff?.shakes).toBeUndefined();
    expect(buff?.hitstopMs).toBeUndefined();
    expect(buff?.floaters?.[0]).toMatchObject({ kind: "armor" });
    expect(planFor("hit", {})).toBeNull();
  });
});

describe("planFor: skill / enemy / 胜负 / 奇遇", () => {
  test("skill 只出增益浮字、永不带 hit-stop", () => {
    const plan = planFor("skill", { armor: 6 });
    expect(plan?.id).toBe("skill");
    expect(plan?.hitstopMs).toBeUndefined();
    expect(plan?.shakes).toBeUndefined();
    expect(plan?.floaters?.[0]).toMatchObject({ text: "+6", kind: "armor" });
    expect(planFor("skill", {})).toBeNull();
  });

  test("敌方攻击：全屏轻震 + 我方红闪，优先级 1", () => {
    const plan = planFor("enemy");
    expect(plan?.priority).toBe(1);
    expect(plan?.shakes?.[0]).toMatchObject({ target: "screen", amp: 5, ms: 280 });
    expect(plan?.flashes?.[0]).toMatchObject({ target: "player-row", ms: 340 });
  });

  test("victory/star/defeat/treasure 的签名演出", () => {
    const victory = planFor("victory");
    expect(victory?.priority).toBe(2);
    expect(victory?.starMarks).toEqual(["★", "声", "震"]);
    expect(planFor("star")?.starMarks).toEqual(["★"]);
    expect(planFor("defeat")).toMatchObject({ priority: 2, dim: true });
    expect(planFor("treasure")?.floaters?.[0]).toMatchObject({ text: "✦", kind: "star" });
  });

  test("未知 effect 一律无计划（含 undefined/空串）", () => {
    expect(planFor("save")).toBeNull();
    expect(planFor("item")).toBeNull();
    expect(planFor(undefined)).toBeNull();
    expect(planFor("")).toBeNull();
  });
});
