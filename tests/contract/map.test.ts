/**
 * P2 契约：战役地图形状约束集（REDESIGN-PLAN §6.1 / §9 测试金字塔契约层）。
 * 锁定：确定性、≥2 起点、Boss 唯一顶点、相邻行连边、无交叉、全图可达、
 * 类型分布规则（前 4 行无强敌 / 倒数 3 行无纯收益 / 各类节点最低配额）、
 * 前线推进与★评价纯函数。
 */

import { describe, expect, test } from "vitest";
import { ACT_MAP, STAR_THRESHOLDS } from "../../src/core/config/balance";
import {
  availableNodeIds,
  childrenIds,
  evaluateCombatStars,
  generateActMap,
  nodeById,
  parentIds,
  starsForQuiz,
  validateActMap
} from "../../src/core/levelgen";

const SEEDS = [
  20260918, 1, 42, 1337, 987654321, 555, 8080, 314159, 271828, 20200707, 88, 909, 123456, 7, 21,
  63001, 4444, 900913, 24680, 13579
];

describe("act map shape constraints", () => {
  test.each(SEEDS)("seed %i generates a fully valid map", (seed) => {
    const map = generateActMap(seed);
    expect(validateActMap(map)).toEqual([]);
  });

  test("same seed yields identical maps; different seeds yield different maps", () => {
    const a = generateActMap(424242);
    const b = generateActMap(424242);
    const c = generateActMap(424243);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.edges).toEqual(b.edges);
    expect(a.startIds).toEqual(b.startIds);
    expect(a.nodes).not.toEqual(c.nodes);
  });

  test("every generated map has ≥2 starts, a unique apex boss and 15 rows", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const map = generateActMap(seed);
      expect(map.rows).toBe(ACT_MAP.rows);
      expect(map.cols).toBe(ACT_MAP.cols);
      expect(map.startIds.length).toBeGreaterThanOrEqual(ACT_MAP.minStarts);
      const boss = nodeById(map, map.bossId)!;
      expect(boss.type).toBe("boss");
      expect(boss.row).toBe(map.rows - 1);
      expect(map.nodes.filter((node) => node.type === "boss")).toHaveLength(1);
    }
  });

  test("elites never appear in the first four rows; prizes never in the last three", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const map = generateActMap(seed);
      for (const node of map.nodes) {
        if (node.type === "elite") expect(node.row).toBeGreaterThanOrEqual(ACT_MAP.noEliteRows);
        if (node.type === "treasure" || node.type === "quiz") {
          expect(node.row).toBeLessThanOrEqual(map.rows - 1 - ACT_MAP.prizeFreeRows);
        }
      }
    }
  });

  test("node ids stay coherent with rows/cols and edges only connect adjacent rows", () => {
    const map = generateActMap(777);
    for (const node of map.nodes) {
      expect(node.id).toBe(`r${node.row}c${node.col}`);
      expect(node.col).toBeGreaterThanOrEqual(0);
      expect(node.col).toBeLessThan(map.cols);
    }
    for (const edge of map.edges) {
      const from = nodeById(map, edge.from)!;
      const to = nodeById(map, edge.to)!;
      expect(to.row).toBe(from.row + 1);
    }
  });
});

describe("frontier progression", () => {
  test("fresh campaign offers exactly the start nodes", () => {
    const map = generateActMap(2024);
    const frontier = availableNodeIds(map, []);
    expect(new Set(frontier)).toEqual(new Set(map.startIds));
  });

  test("clearing a start opens its children and only its children (plus leftovers)", () => {
    const map = generateActMap(5150);
    const [start] = map.startIds;
    const frontier = availableNodeIds(map, new Set([start]));
    const expected = childrenIds(map, start);
    for (const child of expected) expect(frontier).toContain(child);
    // 可选节点全部满足「父节点已清理」
    for (const id of frontier) {
      expect(parentIds(map, id)).toContain(start);
    }
  });

  test("a monotone climb from some start can always reach the boss", () => {
    const map = generateActMap(31337);
    const cleared = new Set<string>();
    // 贪心：每轮清理前线中列最靠中的节点，直至 Boss 可达
    for (let step = 0; step < map.nodes.length && !cleared.has(map.bossId); step += 1) {
      const frontier = availableNodeIds(map, cleared);
      expect(frontier.length).toBeGreaterThan(0);
      const center = (map.cols - 1) / 2;
      const next = frontier
        .map((id) => nodeById(map, id)!)
        .sort((a, b) => Math.abs(a.col - center) - Math.abs(b.col - center))[0];
      cleared.add(next.id);
    }
    expect(cleared.has(map.bossId)).toBe(true);
  });
});

describe("node star evaluation", () => {
  test("perfect combat earns all three stars", () => {
    const stars = evaluateCombatStars({
      victory: true,
      kind: "battle",
      turns: 5,
      damageTaken: 0,
      averageScore: 92
    });
    expect(stars.total).toBe(3);
    expect(stars.noHit && stars.voice && stars.swift).toBe(true);
  });

  test("each star criterion is independent", () => {
    const hit = evaluateCombatStars({
      victory: true,
      kind: "battle",
      turns: 5,
      damageTaken: 6,
      averageScore: 92
    });
    expect(hit.total).toBe(2);
    const weak = evaluateCombatStars({
      victory: true,
      kind: "elite",
      turns: 10,
      damageTaken: 0,
      averageScore: STAR_THRESHOLDS.voiceAvg - 1
    });
    expect(weak.total).toBe(2); // 无伤+限时，声韵差 1 分
    const slow = evaluateCombatStars({
      victory: true,
      kind: "boss",
      turns: STAR_THRESHOLDS.turnLimits.boss + 1,
      damageTaken: 0,
      averageScore: 90
    });
    expect(slow.total).toBe(2);
  });

  test("defeat always scores zero stars", () => {
    expect(
      evaluateCombatStars({
        victory: false,
        kind: "battle",
        turns: 3,
        damageTaken: 0,
        averageScore: 100
      }).total
    ).toBe(0);
  });

  test("quiz stars equal correct answers, clamped to 0..3", () => {
    expect(starsForQuiz(0)).toBe(0);
    expect(starsForQuiz(2)).toBe(2);
    expect(starsForQuiz(99)).toBe(3);
  });
});
