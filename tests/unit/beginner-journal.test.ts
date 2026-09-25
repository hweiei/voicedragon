import { describe, expect, test } from "vitest";
import {
  dueCount,
  emptyJournal,
  recordPractice,
  restoreJournal,
  reviewQueue
} from "../../src/beginner/journal";
import { freshProgress, restoreProgress } from "../../src/beginner/progress";
const NOW = 1700000000000;
const DAY = 86400000;
describe("P19 persistent beginner journal", () => {
  test("counts reading and recording separately without an accuracy score", () => {
    let j = recordPractice(emptyJournal(), "run-a:greeting", "greeting", false, NOW);
    j = recordPractice(j, "run-b:greeting", "greeting", true, NOW);
    expect(j.entries.greeting).toMatchObject({
      reading: 1,
      recording: 1,
      reviews: 0,
      dueAt: NOW + DAY,
      rating: null
    });
    expect(JSON.stringify(j)).not.toMatch(/score|transcript|audio|blob/);
  });
  test("same completion is idempotent, restart has a new run identity", () => {
    const j = recordPractice(emptyJournal(), "run-a:greeting", "greeting", true, NOW);
    expect(recordPractice(j, "run-a:greeting", "greeting", true, NOW + 1)).toBe(j);
    expect(freshProgress(42, "run-a").runId).not.toBe(freshProgress(42, "run-b").runId);
  });
  test("self-reported again schedules 10 minutes, remembered grows to a capped interval", () => {
    let j = recordPractice(emptyJournal(), "a", "greeting", false, NOW);
    j = recordPractice(j, "b", "greeting", false, NOW, "again");
    expect(j.entries.greeting.dueAt).toBe(NOW + 600000);
    expect(j.entries.greeting.intervalDays).toBe(0);
    j = recordPractice(j, "c", "greeting", false, NOW, "remembered");
    expect(j.entries.greeting.dueAt).toBe(NOW + DAY);
    for (let i = 0; i < 10; i++)
      j = recordPractice(j, `review-${i}`, "greeting", true, NOW, "remembered");
    expect(j.entries.greeting.intervalDays).toBe(14);
    expect(j.entries.greeting.rating).toBe("remembered");
  });
  test("practicing in a new run does not postpone an overdue review", () => {
    let j = recordPractice(emptyJournal(), "a", "greeting", false, NOW);
    j = recordPractice(j, "b", "greeting", true, NOW + DAY * 2);
    expect(j.entries.greeting.dueAt).toBe(NOW + DAY);
    expect(dueCount(j, NOW + DAY * 2)).toBe(1);
  });
  test("review uses learned phrases only, due first, at most three by default", () => {
    let j = emptyJournal();
    for (const id of ["greeting", "please", "order", "price"])
      j = recordPractice(j, id, id, false, NOW);
    j = recordPractice(j, "again", "price", false, NOW, "again");
    expect(reviewQueue(j, NOW + 600000)[0]).toBe("price");
    expect(reviewQueue(j, NOW + 600000)).toHaveLength(3);
    expect(reviewQueue(emptyJournal(), NOW)).toEqual([]);
  });
  test("restore strips unknown fields, invalid ids and duplicate events", () => {
    const good = recordPractice(emptyJournal(), "a", "greeting", false, NOW);
    const raw = {
      ...good,
      audio: "secret",
      entries: {
        ...good.entries,
        arbitrary: { id: "arbitrary" },
        greeting: { ...good.entries.greeting, transcript: "secret" }
      },
      recentEvents: ["a", "a", "<script>"]
    };
    expect(restoreJournal(raw)).toEqual(good);
    expect(restoreJournal({ ...good, version: 99 })).toEqual(emptyJournal());
    expect(
      restoreJournal({
        version: 1,
        entries: { greeting: { ...good.entries.greeting, recording: -1 } }
      }).entries
    ).toEqual({});
  });
  test("legacy run without identity migrates deterministically", () => {
    const { runId: _, ...old } = freshProgress(42);
    expect(restoreProgress(old, 1).runId).toBe("legacy-42");
  });
});
