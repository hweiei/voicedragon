/**
 * P15 铸剑炉 · 属性测试：评分/判定的单调与钳制不变量。
 *
 * 不变量（GROWTH-PLAN §7.1）：任意分数经档位判定/合成/钳制后**单调不降**——
 * 说得更好（分数更高）绝不能得到更差的结果。覆盖三处判定面：
 * 1) `composeFinalScore` 对字准分单调、输出恒在 [0,100]；
 * 2) `scoreLabel` 档位排序（未稳 < 入门 < 清晰 < 正音）随分数单调；
 * 3) `masteryJudgeScore` 保底判定：抬升后的判定分不低于原分、不越过正音线，
 *    且保底幅度随原分不增（原分越高越不需要保底）。
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { MASTERY_FLOOR, MASTERY_MASTER_THRESHOLD, masteryJudgeScore } from "../../src/core/mastery";
import { composeFinalScore, scoreLabel } from "../../src/core/scoring";

const scoreArb = fc.double({ min: 0, max: 100, noNaN: true });
const LABEL_RANK: Record<string, number> = { 未稳: 0, 入门: 1, 清晰: 2, 正音: 3 };
/** 与引擎档位表同源的最小读数函数（仅用于判定 tier 变化，不复制阈值）。 */
const tierKeyOf = (value: number): string => scoreLabel(value);

describe("属性：合成评分单调且有界", () => {
  test("字准分升高 ⟹ 最终分不降（任意调准分与权重），输出恒在 [0,100]", () => {
    fc.assert(
      fc.property(
        scoreArb,
        scoreArb,
        fc.option(scoreArb, { nil: null }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (x, y, tone, weight) => {
          const lo = Math.min(x, y);
          const hi = Math.max(x, y);
          const a = composeFinalScore(lo, tone, weight);
          const b = composeFinalScore(hi, tone, weight);
          expect(b).toBeGreaterThanOrEqual(a);
          expect(a).toBeGreaterThanOrEqual(0);
          expect(b).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 400 }
    );
  });

  test("调准分升高 ⟹ 最终分不降（字准分与权重固定）", () => {
    fc.assert(
      fc.property(
        scoreArb,
        scoreArb,
        scoreArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (text, x, y, weight) => {
          const a = composeFinalScore(text, Math.min(x, y), weight);
          const b = composeFinalScore(text, Math.max(x, y), weight);
          expect(b).toBeGreaterThanOrEqual(a);
        }
      ),
      { numRuns: 300 }
    );
  });
});

describe("属性：档位标签随分数单调", () => {
  test("x ≤ y ⟹ rank(label(x)) ≤ rank(label(y))", () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (x, y) => {
        const lo = Math.min(x, y);
        const hi = Math.max(x, y);
        expect(LABEL_RANK[scoreLabel(hi)]).toBeGreaterThanOrEqual(LABEL_RANK[scoreLabel(lo)]);
      }),
      { numRuns: 400 }
    );
  });
});

describe("属性：词林判定保底单调且不越线", () => {
  test("判定分 ≥ 原分、< 正音线；原分越高所需保底越少（applied 不增）", () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (x, y) => {
        const judgeAt = (score: number) => ({
          score,
          ...masteryJudgeScore(score, MASTERY_FLOOR, tierKeyOf)
        });
        const lo = judgeAt(Math.min(x, y));
        const hi = judgeAt(Math.max(x, y));
        // 保底只抬不压：判定分 ≥ 原分；且原分不到正音线时，保底绝不越过正音线
        expect(lo.judged).toBeGreaterThanOrEqual(lo.score);
        expect(hi.judged).toBeGreaterThanOrEqual(hi.score);
        if (lo.score < MASTERY_MASTER_THRESHOLD)
          expect(lo.judged).toBeLessThan(MASTERY_MASTER_THRESHOLD);
        if (hi.score < MASTERY_MASTER_THRESHOLD)
          expect(hi.judged).toBeLessThan(MASTERY_MASTER_THRESHOLD);
        expect(hi.applied).toBeLessThanOrEqual(lo.applied);
      }),
      { numRuns: 400 }
    );
  });

  test("保底值固定为词林底线（不随局况漂移）", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 64 }), (score) => {
        const judge = masteryJudgeScore(score, MASTERY_FLOOR, tierKeyOf);
        expect(judge.judged).toBe(MASTERY_FLOOR);
        expect(judge.applied).toBe(MASTERY_FLOOR - score);
      }),
      { numRuns: 100 }
    );
  });
});
