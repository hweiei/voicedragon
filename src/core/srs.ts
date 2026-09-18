/**
 * P3 学习闭环核心（纯函数）：错词本 + 简化 SM-2 调度 + 学习报告聚合。
 * 规则：战斗/练习中单句综合分 <65 自动进错词本；复习表现改写间隔与难度系数；
 * 「每日三句」= 到期优先 → 最弱优先。所有函数确定性、可单测。
 */

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
}

/** 全局练习聚合（学习报告四轴：字准 / 调准 / 信心 / 词汇量）。 */
export interface SrsStats {
  voiceAttempts: number;
  sumWord: number;
  toneCount: number;
  sumTone: number;
  sumConfidence: number;
  skillsUsed: string[];
}

export interface SrsStore {
  entries: Record<string, SrsEntry>;
  stats: SrsStats;
}

/** 进入错词本的综合分门槛（低于即钉子户）。 */
export const SRS_LEECH_THRESHOLD = 65;

const DAY_MS = 24 * 60 * 60 * 1000;

export function emptySrsStore(): SrsStore {
  return {
    entries: {},
    stats: {
      voiceAttempts: 0,
      sumWord: 0,
      toneCount: 0,
      sumTone: 0,
      sumConfidence: 0,
      skillsUsed: []
    }
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

  const existing = store.entries[skillId];
  if (existing) {
    const quality = qualityFromScore(attempt.score);
    existing.lastScore = attempt.score;
    existing.bestScore = Math.max(existing.bestScore, attempt.score);
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
    .sort((a, b) => a.bestScore - b.bestScore || b.lapses - a.lapses);
  return [...due, ...rest].slice(0, count);
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
}

export function buildLearningReport(store: SrsStore, now = new Date()): LearningReport {
  const stats = store.stats;
  const mistakes = Object.values(store.entries).sort(
    (a, b) => a.bestScore - b.bestScore || b.lapses - a.lapses
  );
  return {
    voiceAttempts: stats.voiceAttempts,
    wordAvg: stats.voiceAttempts ? Math.round(stats.sumWord / stats.voiceAttempts) : 0,
    toneAvg: stats.toneCount ? Math.round(stats.sumTone / stats.toneCount) : null,
    confidenceAvg: stats.voiceAttempts ? Math.round(stats.sumConfidence / stats.voiceAttempts) : 0,
    vocab: stats.skillsUsed.length,
    mistakes,
    dueCount: dueEntries(store, now).length
  };
}
