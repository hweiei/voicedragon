/**
 * P4 成就系统单测：判定阈值、newlyUnlocked 差集、积分汇总、隐藏成就标记。
 * 判定必须为纯函数：同输入同输出，不受时间/随机影响。
 */

import { describe, expect, test } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_POINTS_TOTAL,
  achievementPoints,
  checkAchievements,
  newlyUnlocked
} from "../../src/core/achievements";
import type { AchievementContext } from "../../src/core/achievements";

const EMPTY: AchievementContext = {
  voiceAttempts: 0,
  bestVoice: 0,
  maxCombo85: 0,
  runs: 0,
  victories: 0,
  classicVictories: 0,
  kills: 0,
  elites: 0,
  endlessBest: 0,
  campaignStarsTotal: 0,
  campaignBossKills: 0,
  quizPerfects: 0,
  dailyWins: 0,
  srsGraduated: 0
};

describe("achievement thresholds", () => {
  test("empty context unlocks nothing", () => {
    expect(checkAchievements(EMPTY)).toEqual([]);
  });

  test("each threshold flips exactly at the boundary", () => {
    expect(checkAchievements({ ...EMPTY, voiceAttempts: 1 })).toContain("first-voice");
    expect(checkAchievements({ ...EMPTY, voiceAttempts: 99 })).not.toContain("voice-100");
    expect(checkAchievements({ ...EMPTY, voiceAttempts: 100 })).toContain("voice-100");
    expect(checkAchievements({ ...EMPTY, bestVoice: 84 })).not.toContain("clear-85");
    expect(checkAchievements({ ...EMPTY, bestVoice: 85 })).toContain("clear-85");
    expect(checkAchievements({ ...EMPTY, maxCombo85: 5 })).toContain("combo-85");
    expect(checkAchievements({ ...EMPTY, elites: 10 })).toContain("elite-hunter");
    expect(checkAchievements({ ...EMPTY, endlessBest: 14 })).not.toContain("endless-walker");
    expect(checkAchievements({ ...EMPTY, endlessBest: 15 })).toContain("endless-walker");
    expect(checkAchievements({ ...EMPTY, campaignStarsTotal: 20 })).toContain("star-scout");
    expect(checkAchievements({ ...EMPTY, dailyWins: 3 })).toContain("daily-devotee");
    expect(checkAchievements({ ...EMPTY, quizPerfects: 3 })).toContain("quiz-scholar");
    expect(checkAchievements({ ...EMPTY, srsGraduated: 3 })).toContain("mistake-tamer");
    expect(checkAchievements({ ...EMPTY, campaignBossKills: 1 })).toContain("dragon-bane");
    expect(checkAchievements({ ...EMPTY, classicVictories: 1 })).toContain("tower-clear");
    expect(checkAchievements({ ...EMPTY, runs: 0, victories: 1 })).toContain("first-victory");
  });

  test("only dragon-bane is secret", () => {
    const secret = ACHIEVEMENTS.filter((def) => def.secret).map((def) => def.id);
    expect(secret).toEqual(["dragon-bane"]);
  });

  test("total points are stable (13 defs)", () => {
    expect(ACHIEVEMENTS).toHaveLength(13);
    expect(ACHIEVEMENT_POINTS_TOTAL).toBe(
      13 === 13 ? ACHIEVEMENTS.reduce((s, d) => s + d.points, 0) : 0
    );
    expect(ACHIEVEMENT_POINTS_TOTAL).toBeGreaterThanOrEqual(200);
  });
});

describe("newlyUnlocked diff", () => {
  const ctx: AchievementContext = { ...EMPTY, voiceAttempts: 1, bestVoice: 90, victories: 1 };

  test("nothing owned → all passing are new", () => {
    const defs = newlyUnlocked(ctx, []);
    expect(defs.map((def) => def.id)).toEqual(["first-voice", "first-victory", "clear-85"]);
  });

  test("owned achievements are excluded from the diff", () => {
    const defs = newlyUnlocked(ctx, new Set(["first-voice", "first-victory"]));
    expect(defs.map((def) => def.id)).toEqual(["clear-85"]);
  });

  test("nothing passes → empty diff", () => {
    expect(newlyUnlocked(EMPTY, [])).toEqual([]);
  });
});

describe("achievementPoints", () => {
  test("sums only unlocked ids; unknown ids ignored", () => {
    expect(achievementPoints([])).toBe(0);
    expect(achievementPoints(["first-voice"])).toBe(10);
    expect(achievementPoints(["first-voice", "ghost-id", "clear-85"])).toBe(25);
    // 全部解锁 = 总分
    expect(achievementPoints(ACHIEVEMENTS.map((def) => def.id))).toBe(ACHIEVEMENT_POINTS_TOTAL);
  });
});
