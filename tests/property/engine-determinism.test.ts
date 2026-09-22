/**
 * P15 铸剑炉 · 属性测试（fast-check，dev-only）：引擎确定性。
 *
 * 不变量（GROWTH-PLAN §7.1）：任意种子 × 任意版本束组合 × 合法命令序列，
 * 完整重放两次的终局状态**逐位相同**（JSON 序列化恒等），胜负/层数等摘要亦同。
 * 命令流复用 `simulateCampaign`（Bot 只走引擎公开指令，与真人同构）；
 * 「随机」Bot 的决策带也来自种子派生流，故两次重放连决策都一致。
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { CharacterId } from "../../src/core/content/roster";
import type { GameState } from "../../src/core/engine";
import { type SimOptions, simulateCampaign } from "../../src/core/sim";

/**
 * 归一化序列化：唯一排除 `stats.startedAt`——它是开局时刻的**墙钟时间戳**
 * （展示用，不参与任何判定/随机/结算），两次重放天然相差几毫秒；
 * 除此之外状态树必须逐位一致。
 */
function normalize(state: GameState | undefined): string {
  if (!state) return "";
  const copy = JSON.parse(JSON.stringify(state)) as GameState;
  if (copy.stats) copy.stats.startedAt = "<wall-clock>";
  return JSON.stringify(copy);
}

/** 版本束组合谱：从 legacy 到全开（含角色），覆盖既有各期门控。 */
const VARIANTS: Array<Pick<SimOptions, "ruleset" | "character"> & Partial<SimOptions>> = [
  {},
  { ruleset: "p7" },
  { ruleset: "p7", buildVersion: 1, encounterVersion: 1 },
  {
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    ultimateVersion: 1,
    character: "man-mou-saang" as CharacterId
  },
  {
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    ultimateVersion: 1,
    forgeVersion: 1,
    character: "man-mou-saang" as CharacterId
  },
  {
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    ultimateVersion: 1,
    forgeVersion: 1,
    character: "cau-saang" as CharacterId,
    qteSource: true
  }
];

describe("属性：引擎确定性（任意种子 × 版本束 × 合法命令序列，重放恒等）", () => {
  test("同种子同版本束两次完整重放：摘要与终局状态逐位一致", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 0, max: VARIANTS.length - 1 }),
        (seed, act, variantIndex) => {
          const options: SimOptions = {
            act,
            seed,
            bot: "random",
            captureFinalState: true,
            ...VARIANTS[variantIndex]
          };
          const first = simulateCampaign(options);
          const second = simulateCampaign(options);
          const { finalState: stateA, ...summaryA } = first;
          const { finalState: stateB, ...summaryB } = second;
          expect(summaryB).toEqual(summaryA);
          expect(normalize(stateB)).toBe(normalize(stateA));
        }
      ),
      { numRuns: 24 } // 每例 = 两整局战役；24 例 ≈ 48 局，全门耗时可控
    );
  });

  test("不同种子的命令流不会互相污染（相邻种子各自自洽）", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xfffffffe }), (seed) => {
        const base = { act: 1, bot: "random" as const, captureFinalState: true };
        const a1 = simulateCampaign({ ...base, seed });
        const a2 = simulateCampaign({ ...base, seed });
        const b1 = simulateCampaign({ ...base, seed: seed + 1 });
        expect(normalize(a2.finalState)).toBe(normalize(a1.finalState));
        // 不要求相邻种子局面不同（理论上可碰撞），只要求各自重放自洽
        expect(b1.win).toBe(simulateCampaign({ ...base, seed: seed + 1 }).win);
      }),
      { numRuns: 12 }
    );
  });
});
