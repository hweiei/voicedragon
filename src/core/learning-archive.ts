/**
 * P8-D 学习档案备份/恢复（纯函数）。只允许 SRS 聚合字段进入归档；
 * 未知字段（识别文本、录音引用、F0 帧等）在归一化时一律丢弃。
 */

import {
  type SrsEntry,
  type SrsStore,
  emptySrsStore,
  normalizeLearningHistory,
  normalizeSyllableMastery,
  normalizeToneMastery
} from "./srs";

export const LEARNING_ARCHIVE_KIND = "voice-tower-learning";
export const LEARNING_ARCHIVE_VERSION = 1;
export const LEARNING_ARCHIVE_MAX_BYTES = 1024 * 1024;

export interface LearningArchive {
  kind: typeof LEARNING_ARCHIVE_KIND;
  version: typeof LEARNING_ARCHIVE_VERSION;
  exportedAt: string;
  store: SrsStore;
}

export interface LearningArchiveSummary {
  exportedAt: string;
  voiceAttempts: number;
  vocab: number;
  mistakes: number;
  activeDays: number;
}

export class LearningArchiveError extends Error {
  constructor(
    message: string,
    readonly code: "invalid-json" | "invalid-kind" | "unsupported-version" | "invalid-store"
  ) {
    super(message);
    this.name = "LearningArchiveError";
  }
}

function finite(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function sanitizeEntry(key: string, raw: unknown): SrsEntry | null {
  if (!/^[a-z0-9-]{1,128}$/.test(key) || !raw || typeof raw !== "object") return null;
  const value = raw as Partial<SrsEntry>;
  if (!validDate(value.dueAt) || !validDate(value.addedAt) || !validDate(value.lastReviewAt)) {
    return null;
  }
  const id = typeof value.id === "string" && value.id === key ? value.id : key;
  const entry: SrsEntry = {
    id,
    ease:
      typeof value.ease === "number" && Number.isFinite(value.ease)
        ? Math.max(1.3, Math.min(2.8, value.ease))
        : 2.5,
    intervalDays: finite(value.intervalDays, 1, 0, 90),
    dueAt: value.dueAt,
    lastScore: finite(value.lastScore, 0, 0, 100),
    bestScore: finite(value.bestScore, 0, 0, 100),
    attempts: finite(value.attempts, 1, 1, 100000),
    lapses: finite(value.lapses, 0, 0, 100000),
    addedAt: value.addedAt,
    lastReviewAt: value.lastReviewAt
  };
  if (typeof value.lastWordScore === "number" && Number.isFinite(value.lastWordScore)) {
    entry.lastWordScore = finite(value.lastWordScore, 0, 0, 100);
  }
  if (value.lastToneScore === null) entry.lastToneScore = null;
  else if (typeof value.lastToneScore === "number" && Number.isFinite(value.lastToneScore)) {
    entry.lastToneScore = finite(value.lastToneScore, 0, 0, 100);
  }
  if (
    typeof value.focusSyllable === "number" &&
    Number.isInteger(value.focusSyllable) &&
    value.focusSyllable >= 0 &&
    value.focusSyllable <= 32
  ) {
    entry.focusSyllable = value.focusSyllable;
  }
  if (
    typeof value.focusTone === "number" &&
    Number.isInteger(value.focusTone) &&
    value.focusTone >= 1 &&
    value.focusTone <= 6
  ) {
    entry.focusTone = value.focusTone as 1 | 2 | 3 | 4 | 5 | 6;
  }
  return entry;
}

/** 严格检查外壳、白名单化内部字段；返回可直接落盘的新对象。 */
export function sanitizeLearningStore(input: unknown): SrsStore {
  if (!input || typeof input !== "object") {
    throw new LearningArchiveError("学习档案缺少有效数据。", "invalid-store");
  }
  const source = input as Partial<SrsStore>;
  if (
    !source.stats ||
    typeof source.stats !== "object" ||
    Array.isArray(source.stats) ||
    !source.entries ||
    typeof source.entries !== "object" ||
    Array.isArray(source.entries)
  ) {
    throw new LearningArchiveError("学习档案结构不完整。", "invalid-store");
  }
  const base = emptySrsStore();
  const rawStats = source.stats as Partial<SrsStore["stats"]>;
  const entries: Record<string, SrsEntry> = {};
  for (const [key, raw] of Object.entries(source.entries).slice(0, 1000)) {
    const entry = sanitizeEntry(key, raw);
    if (entry) entries[key] = entry;
  }
  const skillsUsed = Array.isArray(rawStats.skillsUsed)
    ? [
        ...new Set(rawStats.skillsUsed.filter((id): id is string => /^[a-z0-9-]{1,128}$/.test(id)))
      ].slice(0, 1000)
    : [];
  return {
    entries,
    stats: {
      ...base.stats,
      voiceAttempts: finite(rawStats.voiceAttempts),
      sumWord: finite(rawStats.sumWord),
      toneCount: finite(rawStats.toneCount),
      sumTone: finite(rawStats.sumTone),
      sumConfidence: finite(rawStats.sumConfidence),
      skillsUsed,
      toneMastery: normalizeToneMastery(rawStats.toneMastery),
      // P13：听辨聚合计数属于同一隐私等级（纯计数，无文本）
      listeningAttempts: finite(rawStats.listeningAttempts),
      listeningCorrect: finite(rawStats.listeningCorrect)
    },
    history: normalizeLearningHistory(source.history),
    // P13：逐音节掌握度（整数聚合）随档导出；未知字段依旧一律丢弃
    syllables: normalizeSyllableMastery(source.syllables)
  };
}

export function createLearningArchive(store: SrsStore, now = new Date()): LearningArchive {
  return {
    kind: LEARNING_ARCHIVE_KIND,
    version: LEARNING_ARCHIVE_VERSION,
    exportedAt: now.toISOString(),
    store: sanitizeLearningStore(store)
  };
}

export function serializeLearningArchive(store: SrsStore, now = new Date()): string {
  return JSON.stringify(createLearningArchive(store, now), null, 2);
}

export function parseLearningArchive(input: string | unknown): LearningArchive {
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new LearningArchiveError("文件不是有效的 JSON。", "invalid-json");
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new LearningArchiveError("这不是《声震龙楼》学习档案。", "invalid-kind");
  }
  const value = parsed as Partial<LearningArchive>;
  if (value.kind !== LEARNING_ARCHIVE_KIND) {
    throw new LearningArchiveError("这不是《声震龙楼》学习档案。", "invalid-kind");
  }
  if (value.version !== LEARNING_ARCHIVE_VERSION) {
    throw new LearningArchiveError("该学习档案版本暂不支持。", "unsupported-version");
  }
  if (!validDate(value.exportedAt)) {
    throw new LearningArchiveError("学习档案缺少有效导出时间。", "invalid-store");
  }
  return {
    kind: LEARNING_ARCHIVE_KIND,
    version: LEARNING_ARCHIVE_VERSION,
    exportedAt: value.exportedAt,
    store: sanitizeLearningStore(value.store)
  };
}

export function learningArchiveSummary(archive: LearningArchive): LearningArchiveSummary {
  return {
    exportedAt: archive.exportedAt,
    voiceAttempts: archive.store.stats.voiceAttempts,
    vocab: archive.store.stats.skillsUsed.length,
    mistakes: Object.keys(archive.store.entries).length,
    activeDays: archive.store.history.length
  };
}
