/**
 * P13 音节掌握度聚合（纯函数层）：整数聚合、旧档归一、听辨两条独立通道。
 * 引擎侧力量化见 ./mastery.test.ts；持久化往返见 ../contract/p13-wordbook.test.ts。
 */

import { describe, expect, test } from "vitest";
import {
  SYLLABLE_MASTERY_LIMIT,
  emptySrsStore,
  enqueueListeningMiss,
  normalizeSyllableMastery,
  recordAttempt,
  recordListeningAttempt
} from "../../src/core/srs";

const NOW = new Date("2026-09-20T10:00:00+08:00");

describe("P13 逐音节掌握度聚合", () => {
  test("recordAttempt 按音节累计整数聚合（次数/和/最好/最近），不存曲线也不存文本", () => {
    const store = emptySrsStore();
    recordAttempt(
      store,
      "p10-daai-si-keoi",
      {
        score: 78,
        wordScore: 78,
        toneScore: 80,
        expectedTones: [1, 4],
        toneSyllableScores: [80, 60]
      },
      NOW
    );
    recordAttempt(
      store,
      "p10-daai-si-keoi",
      {
        score: 88,
        wordScore: 88,
        toneScore: 90,
        expectedTones: [1, 4],
        toneSyllableScores: [90, 70]
      },
      NOW
    );
    const stats = store.syllables!["p10-daai-si-keoi"];
    expect(stats).toHaveLength(2);
    expect(stats[0]).toEqual({ attempts: 2, sumScore: 170, bestScore: 90, lastScore: 90 });
    expect(stats[1]).toEqual({ attempts: 2, sumScore: 130, bestScore: 70, lastScore: 70 });
    // 只有整数：序列化后不含浮点与曲线字段
    const json = JSON.stringify(store.syllables!);
    expect(json).not.toMatch(/\.\d/);
    expect(json).not.toMatch(/curve|frames|text/i);
  });

  test("缺音节明细的尝试不写逐音节聚合（不假装有数据）", () => {
    const store = emptySrsStore();
    recordAttempt(store, "p10-daai-si-keoi", { score: 90 }, NOW);
    expect(store.syllables!["p10-daai-si-keoi"]).toBeUndefined();
    // 但产出通道的统计照常
    expect(store.stats.voiceAttempts).toBe(1);
  });

  test("normalizeSyllableMastery 钳制脏档：上限截断、负数归零、非法条目丢弃", () => {
    const normalized = normalizeSyllableMastery({
      "ok-skill": [
        { attempts: 3.9, sumScore: -5, bestScore: 999, lastScore: 42.6 },
        { attempts: Number.NaN, sumScore: 100, bestScore: 100, lastScore: 100 }
      ],
      "bad id!": [{ attempts: 1 }],
      notArray: { attempts: 1 }
    });
    expect(Object.keys(normalized)).toEqual(["ok-skill"]);
    expect(normalized["ok-skill"][0]).toEqual({
      attempts: 3,
      sumScore: 0,
      bestScore: 100,
      lastScore: 43
    });
    expect(normalized["ok-skill"][1]).toEqual({
      attempts: 0,
      sumScore: 0,
      bestScore: 100,
      lastScore: 100
    });
    // sumScore 不可能超过 attempts × 100
    const clamped = normalizeSyllableMastery({
      "ok-skill": [{ attempts: 1, sumScore: 9999, bestScore: 0, lastScore: 0 }]
    });
    expect(clamped["ok-skill"][0].sumScore).toBe(100);
    // 超长音节表被截断（防御性上限）
    const long = normalizeSyllableMastery({
      "ok-skill": Array.from({ length: 60 }, () => ({
        attempts: 1,
        sumScore: 1,
        bestScore: 1,
        lastScore: 1
      }))
    });
    expect(long["ok-skill"]).toHaveLength(SYLLABLE_MASTERY_LIMIT);
  });
});

describe("P13 听辨通道与产出通道分离", () => {
  test("enqueueListeningMiss 只动错词本排程，发音统计一格不动", () => {
    const store = emptySrsStore();
    enqueueListeningMiss(store, "p10-daai-si-keoi", NOW);
    const entry = store.entries["p10-daai-si-keoi"];
    expect(entry.lapses).toBe(1);
    expect(entry.intervalDays).toBe(1);
    expect(entry.attempts).toBe(1);
    expect(store.stats.voiceAttempts).toBe(0);
    expect(store.stats.sumWord).toBe(0);
    expect(store.stats.toneCount).toBe(0);
    expect(store.syllables!["p10-daai-si-keoi"]).toBeUndefined();
    expect(store.stats.skillsUsed).toEqual([]);

    // 二次听错：lapses 累加、ease 下调（下限 1.3）、间隔回 1 天
    for (let i = 0; i < 8; i += 1) enqueueListeningMiss(store, "p10-daai-si-keoi", NOW);
    expect(store.entries["p10-daai-si-keoi"].ease).toBe(1.3);
    expect(store.entries["p10-daai-si-keoi"].lapses).toBe(9);
  });

  test("recordListeningAttempt 只累计听辨计数（感知成绩不混进发音成绩）", () => {
    const store = emptySrsStore();
    recordListeningAttempt(store, true);
    recordListeningAttempt(store, false);
    recordListeningAttempt(store, true);
    expect(store.stats.listeningAttempts).toBe(3);
    expect(store.stats.listeningCorrect).toBe(2);
    expect(store.stats.voiceAttempts).toBe(0);
    expect(store.entries).toEqual({});
  });
});
