import { type Journal, restoreJournal } from "./journal";
export const BACKUP_LIMIT = 1024 * 1024;
export const BACKUP_KIND = "voice-dragon-beginner-journal";
export function exportJournal(journal: Journal, at: string): string {
  return JSON.stringify(
    { kind: BACKUP_KIND, version: 1, exportedAt: at, journal: restoreJournal(journal) },
    null,
    2
  );
}
export function importJournal(text: string): Journal {
  if (new TextEncoder().encode(text).length > BACKUP_LIMIT)
    throw new Error("文件超过 1 MiB，不能导入。");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON。");
  }
  if (!raw || typeof raw !== "object") throw new Error("这不是学习手账备份。");
  const value = raw as { kind?: unknown; version?: unknown; journal?: Partial<Journal> };
  if (
    value.kind !== BACKUP_KIND ||
    value.version !== 1 ||
    value.journal?.version !== 1 ||
    !value.journal.entries ||
    typeof value.journal.entries !== "object" ||
    Array.isArray(value.journal.entries)
  )
    throw new Error("备份类型或版本不受支持。");
  const journal = restoreJournal(value.journal);
  if (Object.keys(value.journal.entries).length > 0 && !Object.keys(journal.entries).length)
    throw new Error("备份没有有效的练习记录，未覆盖当前手账。");
  return journal;
}
