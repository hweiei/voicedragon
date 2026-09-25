import { LESSONS } from "./curriculum";

export const JOURNAL_KEY = "voice-dragon-beginner-journal-v1";
const DAY = 86_400_000;
export type RecallRating = "again" | "remembered";
export interface JournalEntry {
  id: string;
  reading: number;
  recording: number;
  reviews: number;
  lastAt: number;
  dueAt: number;
  intervalDays: number;
  rating: RecallRating | null;
}
export interface Journal {
  version: 1;
  entries: Record<string, JournalEntry>;
  recentEvents: string[];
}
export const emptyJournal = (): Journal => ({ version: 1, entries: {}, recentEvents: [] });
const validId = (id: string) => LESSONS.some((lesson) => lesson.id === id);
const integer = (value: unknown, max = 100000) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
/** Only bounded aggregates. Never deserialize audio, transcript, or arbitrary metadata. */
export function restoreJournal(raw: unknown): Journal {
  const result = emptyJournal();
  if (!raw || typeof raw !== "object") return result;
  const value = raw as Partial<Journal>;
  if (value.version !== 1 || !value.entries || typeof value.entries !== "object") return result;
  for (const lesson of LESSONS) {
    const entry = value.entries[lesson.id];
    if (
      !entry ||
      entry.id !== lesson.id ||
      !integer(entry.reading) ||
      !integer(entry.recording) ||
      !integer(entry.reviews) ||
      !integer(entry.lastAt, 8e15) ||
      !integer(entry.dueAt, 8e15) ||
      !integer(entry.intervalDays, 14) ||
      ![null, "again", "remembered"].includes(entry.rating) ||
      entry.reading + entry.recording === 0
    )
      continue;
    result.entries[lesson.id] = {
      id: lesson.id,
      reading: entry.reading,
      recording: entry.recording,
      reviews: entry.reviews,
      lastAt: entry.lastAt,
      dueAt: entry.dueAt,
      intervalDays: entry.intervalDays,
      rating: entry.rating
    };
  }
  if (Array.isArray(value.recentEvents))
    result.recentEvents = [
      ...new Set(
        value.recentEvents.filter((id) => typeof id === "string" && /^[\w:-]{1,120}$/.test(id))
      )
    ].slice(-1000);
  return result;
}
/** Idempotent completion; a self-report schedules review but is never a pronunciation grade. */
export function recordPractice(
  journal: Journal,
  eventId: string,
  id: string,
  spoken: boolean,
  now: number,
  rating?: RecallRating
): Journal {
  if (
    !validId(id) ||
    journal.recentEvents.includes(eventId) ||
    !/^[\w:-]{1,120}$/.test(eventId) ||
    !integer(now, 8e15)
  )
    return journal;
  const old = journal.entries[id];
  const intervalDays =
    rating === "again"
      ? 0
      : rating === "remembered"
        ? Math.min(14, Math.max(1, (old?.intervalDays ?? 0) * 2))
        : (old?.intervalDays ?? 1);
  const dueAt =
    rating === "again"
      ? now + 10 * 60_000
      : rating === "remembered"
        ? now + intervalDays * DAY
        : (old?.dueAt ?? now + DAY);
  const entry: JournalEntry = {
    id,
    reading: Math.min(100000, (old?.reading ?? 0) + (spoken ? 0 : 1)),
    recording: Math.min(100000, (old?.recording ?? 0) + (spoken ? 1 : 0)),
    reviews: Math.min(100000, (old?.reviews ?? 0) + (rating ? 1 : 0)),
    lastAt: now,
    dueAt,
    intervalDays,
    rating: rating ?? old?.rating ?? null
  };
  return {
    version: 1,
    entries: { ...journal.entries, [id]: entry },
    recentEvents: [...journal.recentEvents, eventId].slice(-1000)
  };
}
/** Due first, then least recently practiced. Only previously encountered phrases are eligible. */
export function reviewQueue(journal: Journal, now: number, limit = 3): string[] {
  return Object.values(journal.entries)
    .sort(
      (a, b) =>
        Number(b.dueAt <= now) - Number(a.dueAt <= now) ||
        a.dueAt - b.dueAt ||
        a.lastAt - b.lastAt ||
        a.id.localeCompare(b.id)
    )
    .slice(0, Math.max(0, Math.min(6, limit)))
    .map((entry) => entry.id);
}
export function dueCount(journal: Journal, now: number): number {
  return Object.values(journal.entries).filter((entry) => entry.dueAt <= now).length;
}
export const RECALL_PROMPTS: Record<string, string> = {
  greeting: "第一次见面，用粤语向街坊打个招呼。",
  please: "想请店员过来帮忙，先用粤语礼貌地引起注意。",
  order: "你想点一杯冰奶茶，试着用粤语说出完整的点单句。",
  price: "想知道饮品的价格，用粤语问一句。",
  thanks: "街坊送来小礼物，用粤语感谢他的心意。",
  boss: "先礼貌地招呼店员，再用粤语点一杯冰奶茶。"
};
