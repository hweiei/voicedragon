/**
 * P4 无尽塔与自适应难度契约测试：
 * 无尽局永不出现 Boss / 永不胜利，5 的倍数层必是强敌关，第 11 层起楼层名「深塔回廊」；
 * 自适应系数在 ±15% 内缩放敌人生攻，默认 provider=0 时与原曲线完全一致。
 */

import { describe, expect, test } from "vitest";
import { DIFFICULTY_CURVE } from "../../src/core/config/balance";
import { ENEMIES, MAX_FLOOR, clone } from "../../src/core/data";
import { GameEngine } from "../../src/core/engine";

describe("endless tower contract", () => {
  test("startEndless sets endless flag, unbounded maxFloor and options for floor 1", () => {
    const engine = new GameEngine();
    engine.startEndless(42);
    expect(engine.state.endless).toBe(true);
    expect(engine.state.maxFloor).toBe(Number.MAX_SAFE_INTEGER);
    expect(engine.state.floorOptions.every((option) => option.floor === 1)).toBe(true);
    expect(engine.state.floorOptions.length).toBeGreaterThan(0);
  });

  test("floors beyond the classic cap still generate options and never contain boss", () => {
    const engine = new GameEngine();
    engine.startEndless(7);
    for (const floor of [10, 11, 12, 14, 15, 21, 30]) {
      engine.state.floor = floor;
      engine.prepareFloorOptions();
      const types = engine.state.floorOptions.map((option) => option.type);
      expect(types).not.toContain("boss");
      expect(types.length).toBeGreaterThan(0);
    }
  });

  test("every 5th floor is exactly an elite gate in endless mode", () => {
    const engine = new GameEngine();
    engine.startEndless(99);
    for (const floor of [4, 9, 14, 24]) {
      engine.state.floor = floor;
      engine.prepareFloorOptions();
      expect(engine.state.floorOptions.map((option) => option.type)).toEqual(["elite"]);
    }
    // 经典规则不变：非 5 倍数层不会出现裸强敌关
    engine.state.floor = 12;
    engine.prepareFloorOptions();
    expect(engine.state.floorOptions.map((option) => option.type)).not.toContain("elite");
  });

  test("deep floors use the endless corridor name", () => {
    const engine = new GameEngine();
    engine.startEndless(5);
    engine.state.floor = MAX_FLOOR;
    expect(engine.getFloorName(MAX_FLOOR + 1)).toBe("深塔回廊");
    expect(engine.getFloorName(MAX_FLOOR + 50)).toBe("深塔回廊");
    // 经典模式楼层名不受无尽分支影响
    const classic = new GameEngine();
    classic.startNew(5);
    expect(classic.getFloorName(1)).not.toBe("深塔回廊");
  });

  test("endless never reaches the victory branch of prepareFloorOptions", () => {
    const engine = new GameEngine();
    engine.startEndless(3);
    engine.state.floor = Number.MAX_SAFE_INTEGER - 2; // 极端层数也要出得了门
    engine.prepareFloorOptions();
    expect(engine.state.floorOptions.length).toBeGreaterThan(0);
    expect(engine.state.phase).not.toBe("victory");
  });
});

describe("adaptive difficulty contract", () => {
  const baseEnemy = () => clone(ENEMIES[0]);

  test("default provider (0) keeps the golden curve untouched", () => {
    const engine = new GameEngine();
    engine.startEndless(13);
    engine.state.floor = 8;
    const enemy = engine.scaledEnemy(baseEnemy(), "battle");
    const expectedHp = Math.round(ENEMIES[0].hp * (1 + 7 * DIFFICULTY_CURVE.enemyHpPerFloor));
    const expectedAtk = Math.max(
      1,
      Math.round(ENEMIES[0].attack * (1 + 7 * DIFFICULTY_CURVE.attackPerFloor))
    );
    expect(enemy.maxHp).toBe(expectedHp);
    expect(enemy.baseAttack).toBe(expectedAtk);
  });

  test("positive boost scales hp and attack up, negative scales down", () => {
    const up = new GameEngine();
    up.adaptiveProvider = () => 0.05;
    up.startEndless(13);
    up.state.floor = 8;
    const boosted = up.scaledEnemy(baseEnemy(), "battle");

    const flat = new GameEngine();
    flat.startEndless(13);
    flat.state.floor = 8;
    const plain = flat.scaledEnemy(baseEnemy(), "battle");

    const down = new GameEngine();
    down.adaptiveProvider = () => -0.08;
    down.startEndless(13);
    down.state.floor = 8;
    const eased = down.scaledEnemy(baseEnemy(), "battle");

    expect(boosted.maxHp).toBeGreaterThan(plain.maxHp);
    expect(boosted.baseAttack).toBeGreaterThanOrEqual(plain.baseAttack);
    expect(eased.maxHp).toBeLessThan(plain.maxHp);
    // 极端值也被 clamp 在 ±15% 内
    const wild = new GameEngine();
    wild.adaptiveProvider = () => 9;
    wild.startEndless(13);
    wild.state.floor = 8;
    const clamped = wild.scaledEnemy(baseEnemy(), "battle");
    const capHp = Math.round(plain.maxHp * 1.15);
    expect(clamped.maxHp).toBeLessThanOrEqual(capHp + 1);
  });

  test("adaptiveBoost is sampled into the run state at run creation", () => {
    const engine = new GameEngine();
    engine.adaptiveProvider = () => 0.05;
    engine.startEndless(21);
    expect(engine.state.adaptiveBoost).toBeCloseTo(0.05);
    engine.adaptiveProvider = () => 0;
    // 已开局的存档不被后续 provider 改动影响（读档自恢复）
    expect(engine.state.adaptiveBoost).toBeCloseTo(0.05);
  });
});
