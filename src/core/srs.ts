/**
 * P3/P8 学习闭环核心（纯函数）：错词本 + 简化 SM-2 调度 + 六调画像 + 本地趋势。
 * 规则：战斗/练习中单句综合分 <65 自动进错词本；复习表现改写间隔与难度系数；
 * 「每日三句」= 到期优先 → 最弱优先。所有函数确定性、可单测。
 */

import { dateKeyFor } from "./daily";

export type TrackedTone = 1 | 2 | 3 | 4 | 5 | 6;

export interface ToneMasteryStat {
  attempts: number;
  sumScore: number;
  bestScore: number;
  lastScore: number;
}

export type ToneMasteryMap = Record<TrackedTone, ToneMasteryStat>;

export interface SrsEntry {
  /** 技能卡 id */
  id: string;
  /** 难度系数（SM-2 ease factor，下限 1.3） */
  ease: number;
  /** 当前复习间隔（天） */
  intervalDays: number;
  /** 下次到期时间（ISO 本地日期时间串） */
  dueAt: string;
  lastScore: number;
  bestScore: number;
  attempts: number;
  lapses: number;
  addedAt: string;
  lastReviewAt: string;
  /** P8-C 最近一次真实语音维度；旧档可缺失。 */
  lastWordScore?: number;
  lastToneScore?: number | null;
  /** 最近一次最低分音节（0-based）及其目标调。 */
  focusSyllable?: number;
  focusTone?: TrackedTone;
}

/** 全局练习聚合（学习报告四轴：字准 / 调准 / 信心 / 词汇量）。 */
export interface SrsStats {
  voiceAttempts: number;
  sumWord: number;
  toneCount: number;
  sumTone: number;
  sumConfidence: number;
  skillsUsed: string[];
  /** P8-C 六调音节画像；只累计有本地 F0 明细的真实语音。 */
  toneMastery: ToneMasteryMap;
}

export interface LearningDay {
  /** 用户本地日历 YYYY-MM-DD。 */
  dateKey: string;
  attempts: number;
  sumScore: number;
  sumWord: number;
  toneCount: number;
  sumTone: number;
  /** 当天练过的不同技能；不保存识别文本或逐次记录。 */
  practicedIds: string[];
}

export interface SrsStore {
  entries: Record<string, SrsEntry>;
  stats: SrsStats;
  /** P8-D 最多 90 个有练习的本地自然日；旧档加载时补空数组。 */
  history: LearningDay[];
}

/** 进入错词本的综合分门槛（低于即钉子户）。 */
export const SRS_LEECH_THRESHOLD = 65;

const DAY_MS = 24 * 60 * 60 * 1000;
const TRACKED_TONES: TrackedTone[] = [1, 2, 3, 4, 5, 6];
export const LEARNING_HISTORY_DAYS = 90;
export const DAILY_PRACTICE_GOAL = 3;
export const LEARNING_TREND_DAYS = 14;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function emptyToneMastery(): ToneMasteryMap {
  return Object.fromEntries(
    TRACKED_TONES.map((tone) => [tone, { attempts: 0, sumScore: 0, bestScore: 0, lastScore: 0 }])
  ) as ToneMasteryMap;
}

/** 旧档/异常局部字段归一；不修改传入对象。 */
export function normalizeToneMastery(input: unknown): ToneMasteryMap {
  const base = emptyToneMastery();
  if (!input || typeof input !== "object") return base;
  const source = input as Partial<Record<TrackedTone, Partial<ToneMasteryStat>>>;
  for (const tone of TRACKED_TONES) {
    const value = source[tone];
    if (!value || typeof value !== "object") continue;
    const attempts = isFiniteNumber(value.attempts) ? Math.max(0, Math.floor(value.attempts)) : 0;
    const sumScore = isFiniteNumber(value.sumScore) ? Math.max(0, Math.round(value.sumScore)) : 0;
    const bestScore = isFiniteNumber(value.bestScore)
      ? Math.max(0, Math.min(100, Math.round(value.bestScore)))
      : 0;
    const lastScore = isFiniteNumber(value.lastScore)
      ? Math.max(0, Math.min(100, Math.round(value.lastScore)))
      : 0;
    base[tone] = { attempts, sumScore, bestScore, lastScore };
  }
  return base;
}

function dateFromKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function shiftedDateKey(now: Date, dayOffset: number): string {
  return dateKeyFor(new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 12));
}

/** 归一并合并重复日期；只保留最近 90 个有练习的自然日。 */
export function normalizeLearningHistory(input: unknown): LearningDay[] {
  if (!Array.isArray(input)) return [];
  const byDate = new Map<string, LearningDay>();
  for (const raw of input.slice(0, 500)) {
    if (!raw || typeof raw !== "object") continue;
    const source = raw as Partial<LearningDay>;
    if (typeof source.dateKey !== "string" || !dateFromKey(source.dateKey)) continue;
    const attempts = isFiniteNumber(source.attempts)
      ? Math.max(0, Math.min(100000, Math.floor(source.attempts)))
      : 0;
    if (!attempts) continue;
    const sumScore = isFiniteNumber(source.sumScore)
      ? Math.max(0, Math.min(attempts * 100, Math.round(source.sumScore)))
      : 0;
    const sumWord = isFiniteNumber(source.sumWord)
      ? Math.max(0, Math.min(attempts * 100, Math.round(source.sumWord)))
      : 0;
    const toneCount = isFiniteNumber(source.toneCount)
      ? Math.max(0, Math.min(attempts, Math.floor(source.toneCount)))
      : 0;
    const sumTone = isFiniteNumber(source.sumTone)
      ? Math.max(0, Math.min(toneCount * 100, Math.round(source.sumTone)))
      : 0;
    const practicedIds = Array.isArray(source.practicedIds)
      ? [
          ...new Set(
            source.practicedIds.filter(
              (id): id is string => typeof id === "string" && /^[a-z0-9-]{1,128}$/.test(id)
            )
          )
        ].slice(0, 256)
      : [];
    const existing = byDate.get(source.dateKey);
    if (existing) {
      existing.attempts += attempts;
      existing.sumScore += sumScore;
      existing.sumWord += sumWord;
      existing.toneCount += toneCount;
      existing.sumTone += sumTone;
      existing.practicedIds = [...new Set([...existing.practicedIds, ...practicedIds])].slice(
        0,
        256
      );
    } else {
      byDate.set(source.dateKey, {
        dateKey: source.dateKey,
        attempts,
        sumScore,
        sumWord,
        toneCount,
        sumTone,
        practicedIds
      });
    }
  }
  return [...byDate.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-LEARNING_HISTORY_DAYS);
}

export function emptySrsStore(): SrsStore {
  return {
    entries: {},
    stats: {
      voiceAttempts: 0,
      sumWord: 0,
      toneCount: 0,
      sumTone: 0,
      sumConfidence: 0,
      skillsUsed: [],
      toneMastery: emptyToneMastery()
    },
    history: []
  };
}

/** SM-2 质量分映射（0–5）：≥85 正音=5，≥65 清晰=4，≥40 入门=2，其余=0。 */
export function qualityFromScore(score: number): number {
  if (score >= 85) return 5;
  if (score >= 65) return 4;
  if (score >= 40) return 2;
  return 0;
}

function nextSchedule(entry: SrsEntry, quality: number, now: Date): void {
  entry.attempts += 1;
  entry.lastReviewAt = now.toISOString();
  if (quality >= 4) {
    // 记得：间隔 1天 → 3天 → ×ease 递增
    if (entry.intervalDays < 1) entry.intervalDays = 1;
    else if (entry.intervalDays < 3) entry.intervalDays = 3;
    else entry.intervalDays = Math.min(90, Math.round(entry.intervalDays * entry.ease));
    entry.ease = Math.min(2.8, entry.ease + (quality === 5 ? 0.08 : 0.02));
  } else {
    entry.lapses += 1;
    entry.intervalDays = 1;
    entry.ease = Math.max(1.3, entry.ease - 0.2);
  }
  entry.dueAt = new Date(now.getTime() + entry.intervalDays * DAY_MS).toISOString();
}

export interface AttemptInput {
  /** 综合分（字准×调准合成后） */
  score: number;
  wordScore?: number | null;
  toneScore?: number | null;
  confidence?: number | null;
  /** P8-C 音节明细；两数组等长且合法时才累计六调画像。 */
  expectedTones?: number[] | null;
  toneSyllableScores?: number[] | null;
}

interface AttemptFocus {
  syllable: number;
  tone: TrackedTone;
  score: number;
}

function isTrackedTone(value: number): value is TrackedTone {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

function accumulateToneMastery(stats: SrsStats, attempt: AttemptInput): AttemptFocus | null {
  const tones = attempt.expectedTones;
  const scores = attempt.toneSyllableScores;
  if (!tones || !scores || !tones.length || tones.length !== scores.length) return null;
  stats.toneMastery = normalizeToneMastery(stats.toneMastery);
  let focus: AttemptFocus | null = null;
  for (let index = 0; index < tones.length; index += 1) {
    const tone = tones[index];
    const rawScore = scores[index];
    if (!isTrackedTone(tone) || !Number.isFinite(rawScore)) continue;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const bucket = stats.toneMastery[tone];
    bucket.attempts += 1;
    bucket.sumScore += score;
    bucket.bestScore = Math.max(bucket.bestScore, score);
    bucket.lastScore = score;
    if (!focus || score < focus.score) focus = { syllable: index, tone, score };
  }
  return focus;
}

function applyAttemptDetail(
  entry: SrsEntry,
  attempt: AttemptInput,
  focus: AttemptFocus | null
): void {
  entry.lastWordScore = Math.round(attempt.wordScore ?? attempt.score);
  entry.lastToneScore =
    attempt.toneScore != null && Number.isFinite(attempt.toneScore)
      ? Math.round(attempt.toneScore)
      : null;
  if (focus) {
    entry.focusSyllable = focus.syllable;
    entry.focusTone = focus.tone;
  }
}

function recordLearningDay(
  store: SrsStore,
  skillId: string,
  attempt: AttemptInput,
  now: Date
): void {
  const dateKey = dateKeyFor(now);
  store.history = normalizeLearningHistory(store.history);
  let day = store.history.find((entry) => entry.dateKey === dateKey);
  if (!day) {
    day = {
      dateKey,
      attempts: 0,
      sumScore: 0,
      sumWord: 0,
      toneCount: 0,
      sumTone: 0,
      practicedIds: []
    };
    store.history.push(day);
  }
  day.attempts += 1;
  day.sumScore += Math.max(0, Math.min(100, Math.round(attempt.score)));
  day.sumWord += Math.max(0, Math.min(100, Math.round(attempt.wordScore ?? attempt.score)));
  if (attempt.toneScore != null && Number.isFinite(attempt.toneScore)) {
    day.toneCount += 1;
    day.sumTone += Math.max(0, Math.min(100, Math.round(attempt.toneScore)));
  }
  if (!day.practicedIds.includes(skillId)) day.practicedIds.push(skillId.slice(0, 128));
  store.history = normalizeLearningHistory(store.history);
}

/**
 * 记录一次发声练习：更新聚合统计；综合分低于门槛则进入/更新错词本调度；
 * 已在错词本中的条目无论分数都按 SM-2 推进复习。
 */
export function recordAttempt(
  store: SrsStore,
  skillId: string,
  attempt: AttemptInput,
  now = new Date()
): SrsStore {
  const stats = store.stats;
  stats.voiceAttempts += 1;
  stats.sumWord += Math.round(attempt.wordScore ?? attempt.score);
  if (attempt.toneScore != null && Number.isFinite(attempt.toneScore)) {
    stats.toneCount += 1;
    stats.sumTone += Math.round(attempt.toneScore);
  }
  stats.sumConfidence += Math.round(attempt.confidence ?? 0);
  if (!stats.skillsUsed.includes(skillId)) stats.skillsUsed.push(skillId);
  const focus = accumulateToneMastery(stats, attempt);
  recordLearningDay(store, skillId, attempt, now);

  const existing = store.entries[skillId];
  if (existing) {
    const quality = qualityFromScore(attempt.score);
    existing.lastScore = attempt.score;
    existing.bestScore = Math.max(existing.bestScore, attempt.score);
    applyAttemptDetail(existing, attempt, focus);
    nextSchedule(existing, quality, now);
    return store;
  }
  if (attempt.score < SRS_LEECH_THRESHOLD) {
    const entry: SrsEntry = {
      id: skillId,
      ease: 2.5,
      intervalDays: 0,
      dueAt: now.toISOString(),
      lastScore: attempt.score,
      bestScore: attempt.score,
      attempts: 1,
      lapses: 0,
      addedAt: now.toISOString(),
      lastReviewAt: now.toISOString()
    };
    entry.intervalDays = 1;
    entry.dueAt = new Date(now.getTime() + DAY_MS).toISOString();
    applyAttemptDetail(entry, attempt, focus);
    store.entries[skillId] = entry;
  }
  return store;
}

/** 到期需复习的错词（按到期时间升序）。 */
export function dueEntries(store: SrsStore, now = new Date()): SrsEntry[] {
  const nowMs = now.getTime();
  return Object.values(store.entries)
    .filter((entry) => Date.parse(entry.dueAt) <= nowMs)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

/** 「每日三句」：到期优先，其次按历史最差分数补齐。 */
export function dailyPicks(store: SrsStore, now = new Date(), count = 3): SrsEntry[] {
  const due = dueEntries(store, now);
  if (due.length >= count) return due.slice(0, count);
  const picked = new Set(due.map((entry) => entry.id));
  const rest = Object.values(store.entries)
    .filter((entry) => !picked.has(entry.id))
    .sort(
      (a, b) =>
        a.bestScore - b.bestScore ||
        (a.lastToneScore ?? 101) - (b.lastToneScore ?? 101) ||
        b.lapses - a.lapses
    );
  return [...due, ...rest].slice(0, count);
}

export interface DailyPracticeProgress {
  dateKey: string;
  completed: number;
  goal: number;
  remaining: number;
  attempts: number;
  practicedIds: string[];
  streak: number;
}

/** 连续练习天数：今天尚未练习时从昨天开始，避免白天打开即断签。 */
export function learningStreak(history: LearningDay[], now = new Date()): number {
  const days = new Set(
    normalizeLearningHistory(history)
      .filter((day) => day.attempts > 0)
      .map((day) => day.dateKey)
  );
  let offset = days.has(dateKeyFor(now)) ? 0 : -1;
  let streak = 0;
  while (streak < LEARNING_HISTORY_DAYS && days.has(shiftedDateKey(now, offset))) {
    streak += 1;
    offset -= 1;
  }
  return streak;
}

export function dailyPracticeProgress(
  store: SrsStore,
  now = new Date(),
  goal = DAILY_PRACTICE_GOAL
): DailyPracticeProgress {
  const safeGoal = Math.max(1, Math.floor(goal));
  const dateKey = dateKeyFor(now);
  const history = normalizeLearningHistory(store.history);
  const day = history.find((entry) => entry.dateKey === dateKey);
  const practicedIds = day ? [...day.practicedIds] : [];
  const completed = Math.min(safeGoal, practicedIds.length);
  return {
    dateKey,
    completed,
    goal: safeGoal,
    remaining: Math.max(0, safeGoal - completed),
    attempts: day?.attempts ?? 0,
    practicedIds,
    streak: learningStreak(history, now)
  };
}

export interface LearningTrendDay {
  dateKey: string;
  label: string;
  attempts: number;
  scoreAvg: number | null;
  wordAvg: number | null;
  toneAvg: number | null;
}

export interface LearningTrend {
  days: LearningTrendDay[];
  /** 后 7 天练习日均分 - 前 7 天练习日均分；两侧各少于 2 天时为空。 */
  scoreDelta: number | null;
  practicedDays: number;
}

export function buildLearningTrend(
  history: LearningDay[],
  now = new Date(),
  dayCount = LEARNING_TREND_DAYS
): LearningTrend {
  const count = Math.max(2, Math.min(LEARNING_HISTORY_DAYS, Math.floor(dayCount)));
  const byDate = new Map(normalizeLearningHistory(history).map((day) => [day.dateKey, day]));
  const days: LearningTrendDay[] = [];
  for (let offset = -(count - 1); offset <= 0; offset += 1) {
    const dateKey = shiftedDateKey(now, offset);
    const day = byDate.get(dateKey);
    const date = dateFromKey(dateKey)!;
    days.push({
      dateKey,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      attempts: day?.attempts ?? 0,
      scoreAvg: day ? Math.round(day.sumScore / day.attempts) : null,
      wordAvg: day ? Math.round(day.sumWord / day.attempts) : null,
      toneAvg: day?.toneCount ? Math.round(day.sumTone / day.toneCount) : null
    });
  }
  const midpoint = Math.floor(days.length / 2);
  const averageSide = (side: LearningTrendDay[]): number | null => {
    const values = side
      .map((day) => day.scoreAvg)
      .filter((value): value is number => value != null);
    if (values.length < 2) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };
  const earlier = averageSide(days.slice(0, midpoint));
  const later = averageSide(days.slice(midpoint));
  return {
    days,
    scoreDelta: earlier == null || later == null ? null : Math.round(later - earlier),
    practicedDays: days.filter((day) => day.attempts > 0).length
  };
}

export interface ToneMasteryReport extends ToneMasteryStat {
  tone: TrackedTone;
  average: number | null;
}

export interface LearningReport {
  voiceAttempts: number;
  /** 字准均值（0–100，无数据为 0） */
  wordAvg: number;
  /** 调准均值（无 F0 数据为 null——报告里显示“未开通通道”） */
  toneAvg: number | null;
  confidenceAvg: number;
  /** 已练过的不同技能数 */
  vocab: number;
  /** 错词本全量（按 worst 排序） */
  mistakes: SrsEntry[];
  dueCount: number;
  toneMastery: ToneMasteryReport[];
  /** 已采样声调中均分最低者；没有 F0 音节数据时为 null。 */
  focusTone: TrackedTone | null;
  /** 与 focusTone 对应的错词练习入口（最多三句）。 */
  focusPracticeIds: string[];
  practice: DailyPracticeProgress;
  trend: LearningTrend;
}

export function buildLearningReport(store: SrsStore, now = new Date()): LearningReport {
  const stats = store.stats;
  const mistakes = Object.values(store.entries).sort(
    (a, b) =>
      a.bestScore - b.bestScore ||
      (a.lastToneScore ?? 101) - (b.lastToneScore ?? 101) ||
      b.lapses - a.lapses
  );
  const mastery = normalizeToneMastery(stats.toneMastery);
  const toneMastery: ToneMasteryReport[] = TRACKED_TONES.map((tone) => ({
    tone,
    ...mastery[tone],
    average: mastery[tone].attempts
      ? Math.round(mastery[tone].sumScore / mastery[tone].attempts)
      : null
  }));
  const focusTone =
    toneMastery
      .filter((entry) => entry.average != null)
      .sort((a, b) => a.average! - b.average! || a.tone - b.tone)[0]?.tone ?? null;
  const focusPracticeIds = focusTone
    ? mistakes
        .filter((entry) => entry.focusTone === focusTone)
        .slice(0, 3)
        .map((entry) => entry.id)
    : [];
  return {
    voiceAttempts: stats.voiceAttempts,
    wordAvg: stats.voiceAttempts ? Math.round(stats.sumWord / stats.voiceAttempts) : 0,
    toneAvg: stats.toneCount ? Math.round(stats.sumTone / stats.toneCount) : null,
    confidenceAvg: stats.voiceAttempts ? Math.round(stats.sumConfidence / stats.voiceAttempts) : 0,
    vocab: stats.skillsUsed.length,
    mistakes,
    dueCount: dueEntries(store, now).length,
    toneMastery,
    focusTone,
    focusPracticeIds,
    practice: dailyPracticeProgress(store, now),
    trend: buildLearningTrend(store.history, now)
  };
}
