/**
 * P15 铸剑炉 · 属性测试：P14 自适应难度 2.0（`src/core/difficulty.ts`）。
 *
 * 不变量（任意胜负序列 × 任意记账键）：
 * 1) 评级有下界——任意连败不跌破 0（`ratingUpdate` 钳制）；
 * 2) 缩放恒在 ±15% 带内、保留 4 位小数（与引擎 `scaledEnemy` 钳制同源）；
 * 3) 纯函数无副作用——`recordDifficultyResult` 不修改入参（深冻结对比）；
 * 4) 无数据 = 基线——空档 `boostFor` 恒 0；
 * 5) 键归一——未知/缺省上下文一律归 classic，绝不抛异常。
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  DIFFICULTY_BOOST_CAP,
  type DifficultyKey,
  type DifficultyStore,
  boostFor,
  boostForRating,
  difficultyKeyFor,
  emptyDifficultyStore,
  ratingUpdate,
  recordDifficultyResult
} from "../../src/core/difficulty";

const KEYS: DifficultyKey[] = ["classic", "endless", "act1", "act2", "act3"];
const keyArb = fc.constantFrom(...KEYS);
const resultsArb = fc.array(fc.record({ key: keyArb, won: fc.boolean() }), { maxLength: 60 });

describe("属性：难度评级任意序列下有界且纯净", () => {
  test("任意胜负序列：评级 ≥ 0、缩放 ∈ [-15%, +15%]、计数守恒", () => {
    fc.assert(
      fc.property(resultsArb, (results) => {
        let store = emptyDifficultyStore();
        for (const { key, won } of results) {
          store = recordDifficultyResult(store, key, won);
        }
        for (const key of KEYS) {
          const boost = boostFor(store, key);
          expect(boost).toBeGreaterThanOrEqual(-DIFFICULTY_BOOST_CAP);
          expect(boost).toBeLessThanOrEqual(DIFFICULTY_BOOST_CAP);
          const rating = store.ratings[key];
          if (rating !== undefined) expect(rating).toBeGreaterThanOrEqual(0);
        }
        const wins = results.filter((entry) => entry.won).length;
        expect(store.wins).toBe(wins);
        expect(store.losses).toBe(results.length - wins);
      }),
      { numRuns: 200 }
    );
  });

  test("recordDifficultyResult 不修改入参（纯函数）", () => {
    fc.assert(
      fc.property(keyArb, fc.boolean(), (key, won) => {
        const before: DifficultyStore = {
          ratings: { classic: 1400, act2: 1620 },
          wins: 3,
          losses: 5
        };
        const snapshot = JSON.stringify(before);
        recordDifficultyResult(before, key, won);
        expect(JSON.stringify(before)).toBe(snapshot);
      }),
      { numRuns: 60 }
    );
  });

  test("boostForRating 全域钳制且 4 位小数内；空档恒 0", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }), (rating) => {
        const boost = boostForRating(rating);
        expect(boost).toBeGreaterThanOrEqual(-DIFFICULTY_BOOST_CAP);
        expect(boost).toBeLessThanOrEqual(DIFFICULTY_BOOST_CAP);
        // 4 位小数量化：不能用 `boost*10000` 恒等断言——二进制浮点下约 13% 的
        // n/10000 值乘回后差一个 ulp（如 0.0003*10000=2.9999999999999996），
        // 会让本属性测试随 fast-check 随机种子偶发红。toFixed 语义等价且稳定。
        expect(Number(boost.toFixed(4))).toBe(boost);
      }),
      { numRuns: 300 }
    );
    fc.assert(
      fc.property(keyArb, (key) => {
        expect(boostFor(emptyDifficultyStore(), key)).toBe(0);
      }),
      { numRuns: 20 }
    );
  });

  test("ratingUpdate 单调于结果：赢不降、输不升（同评级比较）", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (rating) => {
        expect(ratingUpdate(rating, true)).toBeGreaterThanOrEqual(rating);
        expect(ratingUpdate(rating, false)).toBeLessThanOrEqual(rating);
        expect(ratingUpdate(rating, false)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 }
    );
  });

  test("difficultyKeyFor：未知/缺省上下文归 classic，绝不抛异常", () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.record({
            endless: fc.boolean(),
            campaign: fc.boolean(),
            act: fc.option(fc.integer({ min: -10, max: 10 }), { nil: undefined })
          }),
          { nil: undefined }
        ),
        (context) => {
          const key = difficultyKeyFor(context);
          expect(KEYS).toContain(key);
          if (!context) expect(key).toBe("classic");
          if (context?.endless) expect(key).toBe("endless");
          else if (context?.campaign) expect(key.startsWith("act")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
