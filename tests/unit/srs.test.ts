/**
 * P3 学习闭环单测：错词本收录、SM-2 简化调度、每日三句挑选、学习报告聚合、
 * 每日挑战种子与战绩比较。
 */

import { describe, expect, test } from "vitest";
import { compareDailyRecords, dailySeedForKey, dateKeyFor } from "../../src/core/daily";
import {
  SRS_LEECH_THRESHOLD,
  buildLearningReport,
  buildLearningTrend,
  dailyPicks,
  dailyPracticeProgress,
  dueEntries,
  emptySrsStore,
  learningStreak,
  normalizeLearningHistory,
  normalizeToneMastery,
  qualityFromScore,
  recordAttempt
} from "../../src/core/srs";

const NOW = new Date("2026-09-18T12:00:00");
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * 86400000);

describe("srs deck", () => {
  test("score below threshold auto-enters the mistake deck, above does not", () => {
    const store = emptySrsStore();
    recordAttempt(store, "ding-ngang-soeng", { score: SRS_LEECH_THRESHOLD - 1 }, NOW);
    recordAttempt(store, "hou-sai-lei", { score: 92 }, NOW);
    expect(Object.keys(store.entries)).toEqual(["ding-ngang-soeng"]);
    expect(store.entries["ding-ngang-soeng"].intervalDays).toBe(1);
  });

  test("quality ladder follows scoreLabel tiers", () => {
    expect(qualityFromScore(92)).toBe(5);
    expect(qualityFromScore(70)).toBe(4);
    expect(qualityFromScore(50)).toBe(2);
    expect(qualityFromScore(10)).toBe(0);
  });

  test("good recalls grow intervals 1 → 3 → ×ease; failures reset", () => {
    const store = emptySrsStore();
    recordAttempt(store, "m-sai-geng", { score: 50 }, NOW);
    const entry = store.entries["m-sai-geng"];
    entry.dueAt = NOW.toISOString();
    recordAttempt(store, "m-sai-geng", { score: 88 }, daysFromNow(1));
    expect(entry.intervalDays).toBe(3);
    entry.dueAt = daysFromNow(4).toISOString();
    recordAttempt(store, "m-sai-geng", { score: 90 }, daysFromNow(4));
    expect(entry.intervalDays).toBeGreaterThan(3);
    const longInterval = entry.intervalDays;
    recordAttempt(store, "m-sai-geng", { score: 20 }, daysFromNow(10));
    expect(entry.intervalDays).toBe(1);
    expect(entry.lapses).toBe(1);
    expect(entry.ease).toBeLessThan(2.6);
    expect(longInterval).toBeGreaterThan(3);
  });

  test("dailyPicks: due first, then weakest", () => {
    const store = emptySrsStore();
    recordAttempt(store, "a-id", { score: 60 }, NOW);
    recordAttempt(store, "b-id", { score: 55 }, NOW);
    recordAttempt(store, "c-id", { score: 58 }, NOW);
    recordAttempt(store, "d-id", { score: 30 }, NOW);
    // 全部 1 天后到期；1.5 天后查看 → 全部到期，取 3 个
    const picks = dailyPicks(store, daysFromNow(1.5), 3);
    expect(picks).toHaveLength(3);
    expect(picks.map((entry) => entry.id)).toContain("a-id");
    // 未到期视角（NOW 当天）：无到期 → 按最弱补齐
    const early = dailyPicks(store, NOW, 2);
    expect(early[0].id).toBe("d-id");
    expect(dueEntries(store, NOW)).toHaveLength(0);
  });

  test("learning report aggregates four axes", () => {
    const store = emptySrsStore();
    recordAttempt(store, "s1", { score: 80, wordScore: 85, toneScore: 70, confidence: 90 }, NOW);
    recordAttempt(store, "s2", { score: 60, wordScore: 55, toneScore: null, confidence: 80 }, NOW);
    const report = buildLearningReport(store, NOW);
    expect(report.voiceAttempts).toBe(2);
    expect(report.wordAvg).toBe(70); // (85+55)/2
    expect(report.toneAvg).toBe(70); // 仅一次有 F0
    expect(report.confidenceAvg).toBe(85);
    expect(report.vocab).toBe(2);
    expect(report.mistakes.map((entry) => entry.id)).toEqual(["s2"]); // s1 ≥65 不进错词本
  });

  test("P8-C accumulates six-tone syllable mastery and remembers the weakest syllable", () => {
    const store = emptySrsStore();
    recordAttempt(
      store,
      "ding-ngang-soeng",
      {
        score: 58,
        wordScore: 82,
        toneScore: 44,
        expectedTones: [2, 6, 6],
        toneSyllableScores: [78, 35, 51]
      },
      NOW
    );
    expect(store.stats.toneMastery[2]).toMatchObject({ attempts: 1, sumScore: 78, bestScore: 78 });
    expect(store.stats.toneMastery[6]).toMatchObject({
      attempts: 2,
      sumScore: 86,
      bestScore: 51,
      lastScore: 51
    });
    expect(store.entries["ding-ngang-soeng"]).toMatchObject({
      lastWordScore: 82,
      lastToneScore: 44,
      focusSyllable: 1,
      focusTone: 6
    });
  });

  test("malformed syllable arrays never pollute tone mastery", () => {
    const store = emptySrsStore();
    recordAttempt(store, "bad", {
      score: 50,
      expectedTones: [1, 9],
      toneSyllableScores: [70]
    });
    expect(Object.values(store.stats.toneMastery).every((entry) => entry.attempts === 0)).toBe(
      true
    );
  });

  test("learning report identifies the weakest sampled tone and linked mistake phrases", () => {
    const store = emptySrsStore();
    recordAttempt(store, "tone-one", {
      score: 55,
      toneScore: 72,
      expectedTones: [1],
      toneSyllableScores: [72]
    });
    recordAttempt(store, "tone-four", {
      score: 45,
      toneScore: 31,
      expectedTones: [4],
      toneSyllableScores: [31]
    });
    const report = buildLearningReport(store, NOW);
    expect(report.focusTone).toBe(4);
    expect(report.focusPracticeIds).toEqual(["tone-four"]);
    expect(report.toneMastery.find((entry) => entry.tone === 4)).toMatchObject({
      average: 31,
      attempts: 1
    });
    expect(report.toneMastery.find((entry) => entry.tone === 2)?.average).toBeNull();
  });

  test("old or partial tone mastery normalizes to six safe buckets", () => {
    const normalized = normalizeToneMastery({
      2: { attempts: 3, sumScore: 210, bestScore: 120, lastScore: -8 },
      4: { attempts: Number.NaN, sumScore: 30 }
    });
    expect(Object.keys(normalized)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(normalized[2]).toEqual({ attempts: 3, sumScore: 210, bestScore: 100, lastScore: 0 });
    expect(normalized[4].attempts).toBe(0);
  });
});

describe("P8-D local learning history", () => {
  test("same-day attempts aggregate while daily goal counts distinct phrases", () => {
    const store = emptySrsStore();
    recordAttempt(store, "s1", { score: 70, wordScore: 80, toneScore: 60 }, NOW);
    recordAttempt(store, "s1", { score: 90, wordScore: 92, toneScore: 88 }, NOW);
    recordAttempt(store, "s2", { score: 50, wordScore: 55, toneScore: null }, NOW);
    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      dateKey: "2026-09-18",
      attempts: 3,
      sumScore: 210,
      sumWord: 227,
      toneCount: 2,
      sumTone: 148,
      practicedIds: ["s1", "s2"]
    });
    expect(dailyPracticeProgress(store, NOW)).toMatchObject({
      completed: 2,
      goal: 3,
      remaining: 1,
      attempts: 3
    });
  });

  test("history normalization merges duplicate dates and keeps only the latest 90 active days", () => {
    const raw = Array.from({ length: 95 }, (_, index) => {
      const date = new Date(2026, 0, index + 1, 12);
      return {
        dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        attempts: 1,
        sumScore: 70,
        sumWord: 72,
        toneCount: 0,
        sumTone: 0,
        practicedIds: [`s${index}`]
      };
    });
    raw.push({ ...raw[94], sumScore: 80, practicedIds: ["duplicate"] });
    const history = normalizeLearningHistory(raw);
    expect(history).toHaveLength(90);
    expect(history.at(-1)).toMatchObject({ attempts: 2, sumScore: 150 });
    expect(history.at(-1)?.practicedIds).toEqual(["s94", "duplicate"]);
  });

  test("streak starts from yesterday when today has not been practiced", () => {
    const store = emptySrsStore();
    recordAttempt(store, "s1", { score: 70 }, new Date(2026, 8, 16, 10));
    recordAttempt(store, "s2", { score: 70 }, new Date(2026, 8, 17, 10));
    expect(learningStreak(store.history, NOW)).toBe(2);
    recordAttempt(store, "s3", { score: 70 }, NOW);
    expect(learningStreak(store.history, NOW)).toBe(3);
  });

  test("14-day trend preserves empty days and only reports delta with enough data", () => {
    const store = emptySrsStore();
    recordAttempt(store, "early-1", { score: 60 }, new Date(2026, 8, 6, 10));
    recordAttempt(store, "early-2", { score: 64 }, new Date(2026, 8, 7, 10));
    recordAttempt(store, "late-1", { score: 78 }, new Date(2026, 8, 17, 10));
    recordAttempt(store, "late-2", { score: 82 }, NOW);
    const trend = buildLearningTrend(store.history, NOW);
    expect(trend.days).toHaveLength(14);
    expect(trend.practicedDays).toBe(4);
    expect(trend.days.filter((day) => day.scoreAvg == null)).toHaveLength(10);
    expect(trend.scoreDelta).toBe(18); // (78+82)/2 - (60+64)/2

    const sparse = buildLearningTrend(store.history.slice(-1), NOW);
    expect(sparse.scoreDelta).toBeNull();
  });
});

describe("daily challenge", () => {
  test("date key zero-pads and seed is deterministic per day", () => {
    expect(dateKeyFor(new Date("2026-09-08T10:00:00"))).toBe("2026-09-08");
    expect(dailySeedForKey("2026-09-18")).toBe(dailySeedForKey("2026-09-18"));
    expect(dailySeedForKey("2026-09-18")).not.toBe(dailySeedForKey("2026-09-19"));
    expect(dailySeedForKey("2026-09-20")).not.toBe(dailySeedForKey("2026-10-20"));
  });

  test("record comparison: victory > floor > average score", () => {
    const base = {
      dateKey: "2026-09-18",
      seed: 1,
      floor: 8,
      victory: false,
      averageScore: 70,
      finishedAt: ""
    };
    const win = { ...base, victory: true, floor: 5, averageScore: 60 };
    expect(compareDailyRecords(win, base)).toBeGreaterThan(0);
    const deeper = { ...base, floor: 9 };
    expect(compareDailyRecords(deeper, base)).toBeGreaterThan(0);
    const smoother = { ...base, averageScore: 75 };
    expect(compareDailyRecords(smoother, base)).toBeGreaterThan(0);
    const worse = { ...base, floor: 7, averageScore: 99 };
    expect(compareDailyRecords(worse, base)).toBeLessThan(0);
  });
});
