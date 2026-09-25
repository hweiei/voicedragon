import { describe, expect, test } from "vitest";
import { bossLesson, bossPrompt } from "../../src/beginner/boss";
import { CHUNKS } from "../../src/beginner/branches";
import { LESSONS } from "../../src/beginner/curriculum";
import { emptyJournal, recordPractice } from "../../src/beginner/journal";
import { BACKUP_LIMIT, exportJournal, importJournal } from "../../src/beginner/journal-backup";
import { audioFileFor } from "../../src/beginner/lesson-audio";
import { freshProgress, restoreProgress } from "../../src/beginner/progress";

describe("P21 complete first chapter", () => {
  test("every teaching phrase, segment and NPC line has a fixed audio asset mapping", () => {
    for (const text of [
      ...LESSONS.map((l) => l.phrase),
      ...Object.values(CHUNKS).flat(),
      "奶茶到喇，慢慢饮。"
    ])
      expect(audioFileFor(text)).toMatch(/^audio\/yue\/[\w-]+\.mp3$/);
    expect(audioFileFor("未知内容")).toBeNull();
  });
  test("three boss rounds use previously taught expressions and valid scenario answers", () => {
    for (let round = 0; round < 3; round++) {
      const lesson = bossLesson(round);
      expect(lesson.answers[lesson.correct]).toBeTruthy();
      expect(audioFileFor(lesson.phrase)).toBeTruthy();
      expect(bossPrompt(round)).toBeTruthy();
      expect(lesson.id).toBe("boss");
    }
  });
  test("partial boss progress restores, future or out-of-range recordings are rejected", () => {
    const state = {
      ...freshProgress(1),
      floor: 5,
      routes: ["coach", "coach", "coach", "coach", "coach", "challenge"],
      completed: LESSONS.slice(0, 5).map((l) => l.id),
      relics: Array(5).fill("慢声耳机"),
      bossRound: 1,
      bossSpoken: [0]
    };
    expect(restoreProgress(state, 2).bossRound).toBe(1);
    expect(restoreProgress({ ...state, bossSpoken: [2] }, 2)).toEqual(freshProgress(2));
    expect(restoreProgress({ ...state, bossRound: 99 }, 2)).toEqual(freshProgress(2));
  });
  test("legacy completed run migrates without forcing users to replay a new boss", () => {
    const state = {
      ...freshProgress(1),
      floor: 5,
      routes: Array(6).fill("coach"),
      completed: LESSONS.map((l) => l.id),
      spoken: ["boss"],
      relics: Array(5).fill("慢声耳机"),
      done: true
    };
    const { bossRound: _, bossSpoken: __, ...old } = state;
    expect(restoreProgress(old, 2)).toMatchObject({
      done: true,
      bossRound: 2,
      bossSpoken: [0, 1, 2]
    });
  });
  test("backup round trip preserves aggregates but strips arbitrary audio and text fields", () => {
    const journal = recordPractice(emptyJournal(), "run-1:greeting", "greeting", false, 10000);
    const raw = JSON.parse(exportJournal(journal, "2026-09-25T00:00:00Z"));
    raw.journal.audio = "private";
    raw.journal.entries.greeting.transcript = "private";
    expect(importJournal(JSON.stringify(raw))).toEqual(journal);
  });
  test("backup rejects malformed, wrong-version and oversized inputs", () => {
    for (const text of [
      "{",
      "null",
      JSON.stringify({ kind: "other", version: 1 }),
      "x".repeat(BACKUP_LIMIT + 1)
    ])
      expect(() => importJournal(text)).toThrow();
  });
});
