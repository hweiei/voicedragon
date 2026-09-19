import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  loadDailyRecords,
  loadGame,
  loadSrsStore,
  saveDailyRecord,
  saveGame
} from "../../src/adapters/storage";
import type { DailyRecord } from "../../src/core/daily";
import { GameEngine } from "../../src/core/engine";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key)
  });
});
afterEach(() => vi.unstubAllGlobals());

test("同日新旧规则独立榜；各自只保留更优成绩", () => {
  const record: DailyRecord = {
    dateKey: "2026-09-19",
    seed: 19,
    floor: 10,
    victory: true,
    averageScore: 90,
    finishedAt: "2026-09-19T00:00:00Z"
  };
  saveDailyRecord(record);
  saveDailyRecord({ ...record, ruleset: "p7", floor: 3, victory: false });
  saveDailyRecord({ ...record, ruleset: "p7", floor: 1, victory: false });
  expect(loadDailyRecords()[record.dateKey]).toEqual(record);
  expect(loadDailyRecords("p7")[record.dateKey].floor).toBe(3);
  saveDailyRecord({ ...record, ruleset: "p7", floor: 5, victory: false });
  expect(loadDailyRecords("p7")[record.dateKey].floor).toBe(5);
});

test("P8-C 加载旧 SRS 档案时补齐六调画像且保留原统计", () => {
  localStorage.setItem(
    "voice-tower-srs-v1",
    JSON.stringify({
      entries: {},
      stats: {
        voiceAttempts: 7,
        sumWord: 500,
        toneCount: 2,
        sumTone: 140,
        sumConfidence: 560,
        skillsUsed: ["ding-ngang-soeng"]
      }
    })
  );
  const store = loadSrsStore();
  expect(store.stats.voiceAttempts).toBe(7);
  expect(store.stats.skillsUsed).toEqual(["ding-ngang-soeng"]);
  expect(Object.keys(store.stats.toneMastery)).toEqual(["1", "2", "3", "4", "5", "6"]);
  expect(store.stats.toneMastery[6].attempts).toBe(0);
  expect(store.history).toEqual([]);
});

test("存档适配器往返保留P7规则、词缀和新道具", () => {
  const e = new GameEngine();
  e.startDaily(444, "2026-09-19");
  e.startCombat();
  e.state.player!.items.push("p7-fan");
  expect(saveGame(e.state)).toBe(true);
  expect(loadGame()!.state).toEqual(e.state);
});
