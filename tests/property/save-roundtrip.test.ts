/**
 * P15 铸剑炉 · 属性测试：存档往返（JSON 序列化恒等）。
 *
 * 不变量（GROWTH-PLAN §7.1）：任意推进深度的引擎状态经
 * `JSON.parse(JSON.stringify(state))` 后与原状态深等价——存档即序列化，
 * 状态树必须全是纯数据（无函数、无循环引用、无 undefined 语义差异）。
 * 采样点走 `simulateCampaign` 的 observe 钩子：每 25 步抽一帧，覆盖
 * 塔面/战斗/事件/商店/问答/结算各相位的中间态，而不只是终局。
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { simulateCampaign } from "../../src/core/sim";

describe("属性：存档往返（任意阶段 JSON 往返深等价）", () => {
  test("战役推进途中每 25 步抽帧：序列化往返无损", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 1, max: 3 }),
        fc.boolean(),
        (seed, act, p7) => {
          let steps = 0;
          let checked = 0;
          simulateCampaign({
            act,
            seed,
            bot: "random",
            ...(p7
              ? {
                  ruleset: "p7" as const,
                  buildVersion: 1 as const,
                  encounterVersion: 1 as const,
                  counterVersion: 1 as const,
                  rosterVersion: 1 as const,
                  ultimateVersion: 1 as const
                }
              : {}),
            observe: (state) => {
              steps += 1;
              // 首步必查 + 每 25 步抽帧（短局也有样本，防钩子静默失效假绿）
              if (steps !== 1 && steps % 25 !== 0) return;
              checked += 1;
              const serialized = JSON.stringify(state);
              expect(serialized).toBeTruthy();
              const revived = JSON.parse(serialized);
              expect(JSON.stringify(revived)).toBe(serialized);
              expect(revived).toEqual(state);
            }
          });
          // 一局战役至少应抽到一帧（防钩子静默失效造成假绿）
          expect(checked).toBeGreaterThan(0);
        }
      ),
      { numRuns: 16 }
    );
  });

  test("终局状态往返后仍可被引擎读取的字段形状不变（版本/相位/种子在场）", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const { finalState } = simulateCampaign({
          act: 1,
          seed,
          bot: "random",
          ruleset: "p7",
          captureFinalState: true
        });
        expect(finalState).toBeDefined();
        const revived = JSON.parse(JSON.stringify(finalState));
        expect(revived.version).toBe(finalState!.version);
        expect(revived.phase).toBe(finalState!.phase);
        expect(revived.seed).toBe(finalState!.seed);
        expect(revived.rngState).toBe(finalState!.rngState);
      }),
      { numRuns: 12 }
    );
  });
});
