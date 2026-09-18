/**
 * P4 玩家档案单测：终局累计（战绩/无尽最佳/自适应节律）、真声施法连击、
 * 图鉴幂等点亮、SRS 驯服计数、成就点驱动的主题门槛数值边界。
 */

import { describe, expect, test } from "vitest";
import {
  adaptiveBoostFor,
  countSrsGraduated,
  emptyProfile,
  markCodexSeen,
  recordRunEnd,
  recordVoiceCast
} from "../../src/core/profile";
import type { RunEndInput } from "../../src/core/profile";
import { emptySrsStore, recordAttempt } from "../../src/core/srs";

const summary = (overrides: Partial<RunEndInput["summary"]> = {}) => ({
  floor: 10,
  enemies: 9,
  elites: 2,
  averageScore: 76,
  bestScore: 88,
  damage: 320,
  skills: 11,
  ...overrides
});

const runEnd = (overrides: Partial<RunEndInput> = {}): RunEndInput => ({
  victory: true,
  endless: false,
  campaign: false,
  floor: 10,
  summary: summary(),
  ...overrides
});

describe("recordRunEnd", () => {
  test("classic victory counts runs/kills/elites/classicVictories and bumps streak to +1", () => {
    const profile = emptyProfile();
    recordRunEnd(profile, runEnd());
    expect(profile.stats.runs).toBe(1);
    expect(profile.stats.victories).toBe(1);
    expect(profile.stats.classicVictories).toBe(1);
    expect(profile.stats.campaignVictories).toBe(0);
    expect(profile.stats.kills).toBe(9);
    expect(profile.stats.elites).toBe(2);
    expect(profile.stats.bestVoice).toBe(88);
    expect(profile.stats.adaptiveStreak).toBe(1);
  });

  test("campaign victory counts boss kill instead of classic", () => {
    const profile = emptyProfile();
    recordRunEnd(profile, runEnd({ campaign: true }));
    expect(profile.stats.campaignVictories).toBe(1);
    expect(profile.stats.campaignBossKills).toBe(1);
    expect(profile.stats.classicVictories).toBe(0);
  });

  test("endless defeat raises best floor but never counts victories", () => {
    const profile = emptyProfile();
    recordRunEnd(profile, runEnd({ victory: false, endless: true, floor: 17 }));
    recordRunEnd(profile, runEnd({ victory: false, endless: true, floor: 12 }));
    expect(profile.stats.endlessBest).toBe(17);
    expect(profile.stats.victories).toBe(0);
    expect(profile.stats.runs).toBe(2);
  });

  test("adaptive streak clamps: +3 max, -2 min, sign flips reset across zero", () => {
    const profile = emptyProfile();
    for (let i = 0; i < 5; i += 1) recordRunEnd(profile, runEnd());
    expect(profile.stats.adaptiveStreak).toBe(3);
    recordRunEnd(profile, runEnd({ victory: false, floor: 3 }));
    expect(profile.stats.adaptiveStreak).toBe(-1); // 跨零重置，不由 +3 直落 +2
    for (let i = 0; i < 5; i += 1) recordRunEnd(profile, runEnd({ victory: false, floor: 2 }));
    expect(profile.stats.adaptiveStreak).toBe(-2);
    recordRunEnd(profile, runEnd());
    expect(profile.stats.adaptiveStreak).toBe(1);
  });

  test("bestVoice only goes up (lower summaries do not drag it down)", () => {
    const profile = emptyProfile();
    recordRunEnd(profile, runEnd({ summary: summary({ bestScore: 91 }) }));
    recordRunEnd(
      profile,
      runEnd({ victory: false, floor: 2, summary: summary({ bestScore: 40 }) })
    );
    expect(profile.stats.bestVoice).toBe(91);
  });
});

describe("recordVoiceCast", () => {
  test("counts attempts, best, and the ∧85 combo chain with reset", () => {
    const profile = emptyProfile();
    for (const score of [86, 90, 84, 85, 88, 92]) recordVoiceCast(profile, score);
    expect(profile.stats.voiceAttempts).toBe(6);
    expect(profile.stats.bestVoice).toBe(92);
    expect(profile.stats.combo85).toBe(3);
    expect(profile.stats.maxCombo85).toBe(3); // 前两连后断档，当前三连已反超
    recordVoiceCast(profile, 100);
    expect(profile.stats.maxCombo85).toBe(4);
    recordVoiceCast(profile, 10);
    expect(profile.stats.combo85).toBe(0);
    expect(profile.stats.maxCombo85).toBe(4);
  });
});

describe("markCodexSeen", () => {
  test("idempotent: duplicates never enter the list and return false", () => {
    const profile = emptyProfile();
    expect(markCodexSeen(profile, "enemies", ["a", "b"])).toBe(true);
    expect(markCodexSeen(profile, "enemies", ["b", "a", "c"])).toBe(true);
    expect(profile.codex.enemies).toEqual(["a", "b", "c"]);
    expect(markCodexSeen(profile, "enemies", ["a"])).toBe(false);
    expect(profile.codex.enemies).toHaveLength(3);
  });
});

describe("adaptiveBoostFor", () => {
  test("maps streak to bounded boost per REDESIGN-PLAN §6.2", () => {
    expect(adaptiveBoostFor(3)).toBe(0.05);
    expect(adaptiveBoostFor(10)).toBe(0.05);
    expect(adaptiveBoostFor(-2)).toBe(-0.08);
    expect(adaptiveBoostFor(-9)).toBe(-0.08);
    expect(adaptiveBoostFor(0)).toBe(0);
    expect(adaptiveBoostFor(2)).toBe(0);
    expect(adaptiveBoostFor(-1)).toBe(0);
  });
});

describe("countSrsGraduated", () => {
  test("only entries with interval ≥10 days are 'tamed'", () => {
    const store = emptySrsStore();
    const now = new Date("2026-09-19T08:00:00");
    recordAttempt(store, "m-sai-geng", { score: 40 }, now); // 很差：间隔拉不长
    recordAttempt(store, "ding-ngang-soeng", { score: 95 }, now);
    // 人工把两条目整成不同间隔来验边界
    expect(countSrsGraduated(store)).toBe(0);
    for (const entry of Object.values(store.entries)) entry.intervalDays = 10;
    expect(countSrsGraduated(store)).toBe(Object.keys(store.entries).length);
    for (const entry of Object.values(store.entries)) entry.intervalDays = 9;
    expect(countSrsGraduated(store)).toBe(0);
  });
});
