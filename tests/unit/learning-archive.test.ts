import { describe, expect, test } from "vitest";
import {
  LearningArchiveError,
  createLearningArchive,
  learningArchiveSummary,
  parseLearningArchive,
  serializeLearningArchive
} from "../../src/core/learning-archive";
import { emptySrsStore, recordAttempt } from "../../src/core/srs";

const NOW = new Date("2026-09-19T10:00:00");

function populatedStore() {
  const store = emptySrsStore();
  recordAttempt(
    store,
    "ding-ngang-soeng",
    {
      score: 58,
      wordScore: 80,
      toneScore: 43,
      confidence: 82,
      expectedTones: [2, 6, 6],
      toneSyllableScores: [78, 35, 52]
    },
    NOW
  );
  return store;
}

describe("P8-D learning archive", () => {
  test("versioned JSON round-trips all whitelisted learning aggregates", () => {
    const store = populatedStore();
    const text = serializeLearningArchive(store, NOW);
    const archive = parseLearningArchive(text);
    expect(archive.kind).toBe("voice-tower-learning");
    expect(archive.version).toBe(1);
    expect(archive.exportedAt).toBe(NOW.toISOString());
    expect(archive.store).toEqual(store);
    expect(learningArchiveSummary(archive)).toEqual({
      exportedAt: NOW.toISOString(),
      voiceAttempts: 1,
      vocab: 1,
      mistakes: 1,
      activeDays: 1
    });
  });

  test("sanitizer drops unknown sensitive-looking fields rather than exporting them", () => {
    const store = populatedStore() as ReturnType<typeof populatedStore> & {
      transcript?: string;
      audio?: string;
    };
    store.transcript = "不应导出";
    store.audio = "data:audio/wav;base64,secret";
    (store.entries["ding-ngang-soeng"] as unknown as { pitchFrames: number[] }).pitchFrames = [
      1, 2
    ];
    store.history[0].practicedIds.push("识别文本");
    const text = JSON.stringify(createLearningArchive(store, NOW));
    expect(text).not.toContain("不应导出");
    expect(text).not.toContain("data:audio");
    expect(text).not.toContain("pitchFrames");
    expect(text).not.toContain("识别文本");
  });

  test("invalid JSON, wrong kind and unknown versions are rejected with stable codes", () => {
    expect(() => parseLearningArchive("{")).toThrowError(
      expect.objectContaining({ code: "invalid-json" })
    );
    expect(() => parseLearningArchive({ kind: "other", version: 1 })).toThrowError(
      expect.objectContaining({ code: "invalid-kind" })
    );
    expect(() =>
      parseLearningArchive({
        kind: "voice-tower-learning",
        version: 99,
        exportedAt: NOW.toISOString(),
        store: populatedStore()
      })
    ).toThrowError(expect.objectContaining({ code: "unsupported-version" }));
  });

  test("malformed entries are discarded and numeric aggregates are bounded", () => {
    const archive = parseLearningArchive({
      kind: "voice-tower-learning",
      version: 1,
      exportedAt: NOW.toISOString(),
      store: {
        entries: {
          "bad entry": { id: "bad entry" },
          valid: {
            id: "valid",
            ease: 9,
            intervalDays: 999,
            dueAt: NOW.toISOString(),
            lastScore: 200,
            bestScore: -3,
            attempts: 2,
            lapses: 0,
            addedAt: NOW.toISOString(),
            lastReviewAt: NOW.toISOString()
          }
        },
        stats: {
          voiceAttempts: -5,
          sumWord: 20,
          toneCount: 0,
          sumTone: 0,
          sumConfidence: 0,
          skillsUsed: ["valid"]
        },
        history: []
      }
    });
    expect(Object.keys(archive.store.entries)).toEqual(["valid"]);
    expect(archive.store.entries.valid).toMatchObject({
      ease: 2.8,
      intervalDays: 90,
      lastScore: 100,
      bestScore: 0
    });
    expect(archive.store.stats.voiceAttempts).toBe(0);
    expect(() =>
      parseLearningArchive({
        kind: "voice-tower-learning",
        version: 1,
        exportedAt: NOW.toISOString(),
        store: { entries: [], stats: [] }
      })
    ).toThrowError(expect.objectContaining({ code: "invalid-store" }));
  });

  test("error class remains distinguishable for UI messaging", () => {
    try {
      parseLearningArchive("nope");
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LearningArchiveError);
    }
  });
});
