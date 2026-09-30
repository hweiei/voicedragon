/**
 * 熟练度（简化间隔重复）：每句 0–5 级。
 * - 用得越多、读得越准，经验越多，升级。
 * - 超过「复习间隔 × 2」没用过，掉一级（遗忘）。
 * - 等级换成出牌加成：学得越好，打得越爽。
 */

export interface MasteryEntry {
  /** 累计经验 */
  xp: number;
  /** 上次使用时间（ms） */
  last: number;
}

export type MasteryEvent = "play" | "answer" | "spoke" | "crit" | "quiz";

export const MAX_LEVEL = 5;
/** 达到各等级需要的累计经验：Lv1=3 … Lv5=40 */
export const LEVEL_XP = [0, 3, 8, 15, 25, 40];
/** 各等级的复习间隔（天），超过 2 倍间隔会掉一级 */
export const REVIEW_DAYS = [0, 1, 2, 4, 7, 14];
const XP: Record<MasteryEvent, number> = { play: 1, answer: 2, spoke: 3, crit: 4, quiz: 2 };
const DAY = 86_400_000;

export const LEVEL_NAMES = ["生疏", "见过", "识听", "识讲", "熟", "滚瓜烂熟"];

export function levelOf(xp: number): number {
  let lv = 0;
  for (let i = 1; i <= MAX_LEVEL; i++) if (xp >= LEVEL_XP[i]) lv = i;
  return lv;
}

/** 记一次使用，返回是否升级 */
export function gainXp(
  book: Record<string, MasteryEntry>,
  id: string,
  events: MasteryEvent[],
  now: number
): { before: number; after: number } {
  const e = book[id] ?? { xp: 0, last: now };
  const before = levelOf(e.xp);
  const add = events.reduce((s, ev) => s + XP[ev], 0);
  e.xp = Math.min(LEVEL_XP[MAX_LEVEL] + 20, e.xp + add);
  e.last = now;
  book[id] = e;
  return { before, after: levelOf(e.xp) };
}

/** 按遗忘规则回落：每超过 2 倍复习间隔掉一级。返回掉级的卡 id */
export function applyDecay(book: Record<string, MasteryEntry>, now: number): string[] {
  const dropped: string[] = [];
  for (const [id, e] of Object.entries(book)) {
    let lv = levelOf(e.xp);
    let last = e.last;
    let changed = false;
    while (lv > 0 && now - last > REVIEW_DAYS[lv] * 2 * DAY) {
      last += REVIEW_DAYS[lv] * 2 * DAY;
      lv -= 1;
      changed = true;
    }
    if (changed) {
      e.xp = LEVEL_XP[lv];
      e.last = last;
      dropped.push(id);
    }
  }
  return dropped;
}

/** 等级对应的出牌加成（加在说服或稳住上） */
export function levelBonus(lv: number): number {
  return lv >= 5 ? 3 : lv >= 4 ? 2 : lv >= 2 ? 1 : 0;
}

/** 整本熟练度 → 每张卡的加成表（供对局 run.bonus 使用） */
export function bonusTable(book: Record<string, MasteryEntry>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, e] of Object.entries(book)) {
    const b = levelBonus(levelOf(e.xp));
    if (b) out[id] = b;
  }
  return out;
}

/** 到期该复习的卡（给每日温习用）：已过复习间隔，按逾期程度排序 */
export function dueCards(book: Record<string, MasteryEntry>, now: number, limit = 5): string[] {
  return Object.entries(book)
    .map(([id, e]) => {
      const lv = levelOf(e.xp);
      const overdue = (now - e.last) / DAY - REVIEW_DAYS[lv];
      return { id, overdue };
    })
    .filter((x) => x.overdue >= 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, limit)
    .map((x) => x.id);
}
