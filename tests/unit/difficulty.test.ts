/**
 * P14 自适应难度 2.0（纯规则层）：在线更新公式、钳制、键归一、纯函数与旧档归一。
 * 「每日/切磋钉 0」属引擎契约，见 ../contract/p14-refine.test.ts。
 */

import { describe, expect, test } from "vitest";
import {
  DIFFICULTY_BOOST_CAP,
  DIFFICULTY_K,
  DIFFICULTY_POINTS_PER_BOOST,
  DIFFICULTY_TARGET,
  boostFor,
  boostForRating,
  difficultyKeyFor,
  difficultySummary,
  emptyDifficultyStore,
  expectedWinRate,
  normalizeDifficultyStore,
  ratingFor,
  ratingUpdate,
  recordDifficultyResult
} from "../../src/core/difficulty";

describe("P14 难度评级：更新公式", () => {
  test("目标分处势均力敌：赢 +K/2、输 −K/2", () => {
    expect(expectedWinRate(DIFFICULTY_TARGET)).toBeCloseTo(0.5, 6);
    expect(ratingUpdate(DIFFICULTY_TARGET, true)).toBe(DIFFICULTY_TARGET + DIFFICULTY_K / 2);
    expect(ratingUpdate(DIFFICULTY_TARGET, false)).toBe(DIFFICULTY_TARGET - DIFFICULTY_K / 2);
  });

  test("单调且收敛：赢局分升、输局分降；高分赢局加得少（期望胜率高）", () => {
    expect(ratingUpdate(1600, true)).toBeGreaterThan(1600);
    expect(ratingUpdate(1600, false)).toBeLessThan(1600);
    const highGain = ratingUpdate(1600, true) - 1600;
    const lowGain = ratingUpdate(1300, true) - 1300;
    expect(lowGain).toBeGreaterThan(highGain);
    // 连赢逼近上界但每步递减；连败同理，且永不为负
    let rating = DIFFICULTY_TARGET;
    const gains: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const next = ratingUpdate(rating, true);
      gains.push(next - rating);
      rating = next;
    }
    for (let index = 1; index < gains.length; index += 1) {
      expect(gains[index]).toBeLessThanOrEqual(gains[index - 1]);
    }
    let low = DIFFICULTY_TARGET;
    for (let index = 0; index < 200; index += 1) low = ratingUpdate(low, false);
    expect(low).toBeGreaterThanOrEqual(0);
  });

  test("确定性：同输入同输出（整数化，无浮点漂移）", () => {
    for (const rating of [0, 900, 1500, 1800, 3000]) {
      expect(ratingUpdate(rating, true)).toBe(ratingUpdate(rating, true));
      expect(Number.isInteger(ratingUpdate(rating, false))).toBe(true);
    }
  });

  test("换算与钳制：2000 分差 = 100%，但一律钳在 ±15%", () => {
    expect(DIFFICULTY_POINTS_PER_BOOST).toBe(2000);
    expect(boostForRating(DIFFICULTY_TARGET)).toBe(0);
    expect(boostForRating(DIFFICULTY_TARGET + 200)).toBeCloseTo(0.1, 4);
    expect(boostForRating(DIFFICULTY_TARGET - 200)).toBeCloseTo(-0.1, 4);
    expect(boostForRating(DIFFICULTY_TARGET + 9999)).toBe(DIFFICULTY_BOOST_CAP);
    expect(boostForRating(DIFFICULTY_TARGET - 9999)).toBe(-DIFFICULTY_BOOST_CAP);
  });
});

describe("P14 难度评级：记账键与存档", () => {
  test("键归一如实：无尽 / 战役按幕 / 其余经典；未知幕归一幕", () => {
    expect(difficultyKeyFor(undefined)).toBe("classic");
    expect(difficultyKeyFor({})).toBe("classic");
    expect(difficultyKeyFor({ endless: true })).toBe("endless");
    expect(difficultyKeyFor({ campaign: true, act: 2 })).toBe("act2");
    expect(difficultyKeyFor({ campaign: true, act: 3 })).toBe("act3");
    expect(difficultyKeyFor({ campaign: true, act: 1 })).toBe("act1");
    expect(difficultyKeyFor({ campaign: true, act: 9 })).toBe("act1");
    // 无尽优先于战役标记（互斥场景下的确定性优先级）
    expect(difficultyKeyFor({ endless: true, campaign: true, act: 3 })).toBe("endless");
  });

  test("纯函数：recordDifficultyResult 不改入参，按键各自记账", () => {
    const store = emptyDifficultyStore();
    const afterWin = recordDifficultyResult(store, "act2", true);
    const afterLoss = recordDifficultyResult(afterWin, "classic", false);
    expect(store.ratings).toEqual({});
    expect(store.wins).toBe(0);
    expect(afterWin.wins).toBe(1);
    expect(afterLoss.losses).toBe(1);
    expect(afterLoss.ratings.act2).toBeGreaterThan(DIFFICULTY_TARGET);
    expect(afterLoss.ratings.classic).toBeLessThan(DIFFICULTY_TARGET);
  });

  test("未开局 = 零缩放（练度不够就没有力量；与 P13 之前逐位一致）", () => {
    expect(boostFor(emptyDifficultyStore(), "classic")).toBe(0);
    expect(boostFor(emptyDifficultyStore(), "act3")).toBe(0);
    expect(ratingFor(emptyDifficultyStore(), "classic")).toBe(DIFFICULTY_TARGET);
  });

  test("归一：未知键丢弃、脏数字归零、计数钳制", () => {
    const normalized = normalizeDifficultyStore({
      ratings: { classic: 1613.7, nonsense: 5000, act2: Number.POSITIVE_INFINITY },
      wins: -3,
      losses: 12.9
    });
    expect(normalized.ratings).toEqual({ classic: 1614 });
    expect(normalized.wins).toBe(0);
    expect(normalized.losses).toBe(12);
    expect(normalizeDifficultyStore("nope")).toEqual(emptyDifficultyStore());
    expect(normalizeDifficultyStore(null).ratings).toEqual({});
  });

  test("摘要如实：没数据就直说，有数据才报各模式缩放", () => {
    expect(difficultySummary(emptyDifficultyStore())).toContain("还没有足够的对局");
    let store = emptyDifficultyStore();
    for (let index = 0; index < 6; index += 1) store = recordDifficultyResult(store, "act1", true);
    const summary = difficultySummary(store);
    expect(summary).toContain("本地启发式评级");
    expect(summary).toContain("第1幕 +");
    expect(summary).not.toContain("无尽");
  });
});
