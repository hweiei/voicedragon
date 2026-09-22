/**
 * P15 铸剑炉独立平衡门（与旧门分报）：
 * 1. 锻造行（+事件/遗物/题池）三角色 × 三幕全部落 45–65%、零超时；
 * 2. 基线行（不带 forge）与 P11/P12/P13 基线**逐位一致**——内容扩容不进旧池（零漂移）；
 * 3. 锻造内容真的进局：观察钩子能抽到锻造事件与锻造遗物（机制运转证据）。
 * 报告：docs/P15-BALANCE-REPORT.md（`npm run sim:p15` 复现）。
 */

import { describe, expect, test } from "vitest";
import { CHARACTERS } from "../../src/core/content/roster";
import type { GameState } from "../../src/core/engine";
import { simulateAct, simulateCampaign } from "../../src/core/sim";

const base = {
  bot: "greedy" as const,
  runs: 300,
  ruleset: "p7" as const,
  buildVersion: 1 as const,
  encounterVersion: 1 as const,
  counterVersion: 1 as const,
  rosterVersion: 1 as const,
  ultimateVersion: 1 as const
};

/** P11/P12/P13 基线（同种子同配置，逐位对照）。 */
const BASELINE_WINS: Record<string, number[]> = {
  "man-mou-saang": [189, 177, 169],
  "faa-daan": [193, 181, 177],
  "cau-saang": [185, 175, 156]
};

describe("P15 铸剑炉独立平衡门", () => {
  test.each(CHARACTERS.map((character) => [character.id, character.name] as const))(
    "%s 锻造开局：三幕 45–65%、零超时",
    (character) => {
      for (const act of [1, 2, 3]) {
        const result = simulateAct({
          ...base,
          act,
          character,
          forgeVersion: 1,
          qteSource: character === "cau-saang"
        });
        expect(result.winRate).toBeGreaterThanOrEqual(0.45);
        expect(result.winRate).toBeLessThanOrEqual(0.65);
        expect(result.timeouts).toBe(0);
      }
    },
    180_000
  );

  test.each(CHARACTERS.map((character) => [character.id, character.name] as const))(
    "%s 基线行（不带锻造）与历史基线逐位一致（扩容零漂移）",
    (character) => {
      for (const act of [1, 2, 3]) {
        const result = simulateAct({
          ...base,
          act,
          character,
          qteSource: character === "cau-saang"
        });
        expect(result.wins).toBe(BASELINE_WINS[character][act - 1]);
        expect(result.timeouts).toBe(0);
      }
    },
    180_000
  );

  test("锻造内容真的进局：事件与遗物都能被抽到（机制运转证据）", () => {
    const eventsSeen = new Set<string>();
    const relicsSeen = new Set<string>();
    for (const character of CHARACTERS) {
      for (const act of [1, 2, 3]) {
        for (let i = 0; i < 60; i += 1) {
          simulateCampaign({
            act,
            seed: (0x2026_0922 + i * 7919) >>> 0,
            bot: "greedy",
            ruleset: "p7",
            buildVersion: 1,
            encounterVersion: 1,
            counterVersion: 1,
            rosterVersion: 1,
            ultimateVersion: 1,
            forgeVersion: 1,
            character: character.id,
            qteSource: character.id === "cau-saang",
            observe: (state: GameState) => {
              if (state.event?.id.startsWith("p15-")) {
                eventsSeen.add(state.event.id);
              }
              for (const relicId of state.player?.relics ?? []) {
                if (relicId.startsWith("p15-")) relicsSeen.add(relicId);
              }
            }
          });
        }
      }
    }
    // 12 件锻造事件每件都应被抽到过；6 件流派遗物经首胜授予，九槽位全覆盖（必须全满）
    expect(eventsSeen.size).toBe(12);
    expect(relicsSeen.size).toBe(6);
  }, 240_000);
});
