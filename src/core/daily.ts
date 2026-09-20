/**
 * P3 每日挑战（纯函数）：服务器日期哈希为种子，全服同局（纯本地可算）。
 * 种子 = djb2(本地日期串 YYYY-MM-DD)；战绩存本地，比较规则：通关优先 → 楼层 → 综合分。
 */

export interface DailyRecord {
  /** 版本分榜，旧纪录不与扩展词缀局直接比较。 */
  ruleset?: "legacy" | "p7";
  /** 挑战种子对应的日期键 */
  dateKey: string;
  seed: number;
  floor: number;
  victory: boolean;
  averageScore: number;
  finishedAt: string;
}

export function dateKeyFor(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** djb2：稳定、无碰撞风险的文本散列（同日必同种子，跨日强散列）。 */
export function dailySeedForKey(dateKey: string): number {
  let hash = 5381;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = ((hash << 5) + hash + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash || 0x6d2b79f5;
}

export function dailyChallengeSeed(now = new Date()): number {
  return dailySeedForKey(dateKeyFor(now));
}

/**
 * 通用战绩比较（每日挑战与 P12 切磋码战绩簿共用同一比较器）：
 * 通关 > 未通关；其次到达楼层；再次平均声韵。返回正数表示 a 更好。
 */
export interface RunRecordLike {
  victory: boolean;
  floor: number;
  averageScore: number;
}

export function compareRunRecords(a: RunRecordLike, b: RunRecordLike): number {
  if (a.victory !== b.victory) return a.victory ? 1 : -1;
  if (a.floor !== b.floor) return a.floor - b.floor;
  return a.averageScore - b.averageScore;
}

export function compareDailyRecords(a: DailyRecord, b: DailyRecord): number {
  return compareRunRecords(a, b);
}
