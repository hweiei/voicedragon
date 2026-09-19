import { describe, expect, test } from "vitest";
import { counterEnabled, resolveCounterDamage } from "../../src/core/counter";

describe("P9 反击纯规则", () => {
  test("门控：仅 p7 + counterVersion=1 + 战役同时满足才启用", () => {
    expect(counterEnabled({ counterVersion: 1, ruleset: "p7", campaign: {} })).toBe(true);
    expect(counterEnabled({ counterVersion: 1, ruleset: "p7", campaign: null })).toBe(false);
    expect(counterEnabled({ counterVersion: 1, ruleset: "legacy", campaign: {} })).toBe(false);
    expect(counterEnabled({ ruleset: "p7", campaign: {} })).toBe(false);
    expect(counterEnabled({ counterVersion: 2, ruleset: "p7", campaign: {} })).toBe(false);
    expect(counterEnabled({})).toBe(false);
  });

  test("无被挡伤害不还击；有被挡伤害下限 1 且按比率取整", () => {
    expect(
      resolveCounterDamage({ blocked: 0, ratio: 50, enemyArmor: 0, enemyVulnerable: false })
    ).toEqual({ damage: 0, armorAfter: 0 });
    // 3 × 50% = 1.5 → floor 1
    expect(
      resolveCounterDamage({ blocked: 3, ratio: 50, enemyArmor: 0, enemyVulnerable: false }).damage
    ).toBe(1);
    // 15 × 50% = 7.5 → 7
    expect(
      resolveCounterDamage({ blocked: 15, ratio: 50, enemyArmor: 0, enemyVulnerable: false }).damage
    ).toBe(7);
    // 16 × 50% = 8；露隙 ×1.25 → 10
    expect(
      resolveCounterDamage({ blocked: 16, ratio: 50, enemyArmor: 0, enemyVulnerable: true }).damage
    ).toBe(10);
  });

  test("还击先被敌方护甲吸收，不穿甲", () => {
    const result = resolveCounterDamage({
      blocked: 20,
      ratio: 50,
      enemyArmor: 5,
      enemyVulnerable: false
    });
    expect(result).toEqual({ damage: 5, armorAfter: 0 });
    const partial = resolveCounterDamage({
      blocked: 6,
      ratio: 50,
      enemyArmor: 4,
      enemyVulnerable: false
    });
    expect(partial).toEqual({ damage: 0, armorAfter: 1 });
  });

  test("露隙加成在护甲吸收前结算", () => {
    // 12 × 50% = 6 → 露隙 ×1.25 = 8（round）；敌方护甲 3 → 实际 5，护甲剩 0
    expect(
      resolveCounterDamage({ blocked: 12, ratio: 50, enemyArmor: 3, enemyVulnerable: true })
    ).toEqual({ damage: 5, armorAfter: 0 });
  });
});
