/**
 * P15 铸剑炉 · 属性测试：战役地图形状不变量。
 *
 * 契约层（tests/contract/map.test.ts）用 20 个手工种子做示例；这里把同一组
 * 约束升级为属性（GROWTH-PLAN §7.1）：**任意 32 位种子**生成的地图都满足
 * `validateActMap` 全集（≥2 起点、Boss 唯一顶点、相邻行连边、无交叉、全图可达、
 * 节点类型配额）。顺带锁定同种子同图的确定性。
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { ACT_MAP } from "../../src/core/config/balance";
import { generateActMap, nodeById, validateActMap } from "../../src/core/levelgen";

describe("属性：任意种子生成的战役地图全约束成立", () => {
  test("validateActMap 零违规（300 个任意种子）", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const map = generateActMap(seed);
        expect(validateActMap(map)).toEqual([]);
        // 结构常数不漂移：15 行、顶点是 Boss
        expect(map.rows).toBe(ACT_MAP.rows);
        expect(map.startIds.length).toBeGreaterThanOrEqual(ACT_MAP.minStarts);
        expect(nodeById(map, map.bossId)?.type).toBe("boss");
      }),
      { numRuns: 300 }
    );
  });

  test("同种子必同图（节点/边/起点逐位一致）", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const a = generateActMap(seed);
        const b = generateActMap(seed);
        expect(b.nodes).toEqual(a.nodes);
        expect(b.edges).toEqual(a.edges);
        expect(b.startIds).toEqual(a.startIds);
        expect(b.bossId).toBe(a.bossId);
      }),
      { numRuns: 100 }
    );
  });
});
