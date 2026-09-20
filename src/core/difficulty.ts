/**
 * P14 自适应难度 2.0（纯规则层）：把「连胜计数」换成**按幕的在线强度评级**。
 *
 * 这是**本地启发式**，不是机器学习，文案不许夸大：
 * - 用最朴素的 Elo 式 logistic 在线更新（一步 K 常数），没有训练、没有模型、没有网络；
 * - 全部数据留在本机（`voice-tower-difficulty-v1`），只有 rating 与胜负计数，不含对局内容；
 * - 关掉「自适应难度」= 退回 0，与 P13 之前逐位一致。
 *
 * 与 P4 老行为的差异（老行为保留在 profile.stats.adaptiveStreak，仅存档兼容，不再驱动难度）：
 * 老：连赢 3 局 → 固定 +5%；连输 2 局 → 固定 −8%（不分模式、不分幕）。
 * 新：按 经典 / 无尽 / 幕 1..3 各自记账，胜了加分、败了减分，再按分差换算 ±15% 内的缩放。
 */

export type DifficultyKey = "classic" | "endless" | "act1" | "act2" | "act3";

export interface DifficultyContext {
  endless?: boolean;
  campaign?: boolean;
  act?: number;
}

export interface DifficultyStore {
  /** 各模式的玩家强度评级（缺省 = 目标分，即势均力敌）。 */
  ratings: Partial<Record<DifficultyKey, number>>;
  wins: number;
  losses: number;
}

/** 目标强度：rating = 该值时视为势均力敌（boost = 0）。 */
export const DIFFICULTY_TARGET = 1500;
/** 在线更新步长（Elo 的 K）：一局输赢最多动 24 分。 */
export const DIFFICULTY_K = 24;
/** 换算：每 2000 分差 → 100% 缩放（经 DIFFICULTY_BOOST_CAP 钳到 ±15%）。 */
export const DIFFICULTY_POINTS_PER_BOOST = 2000;
/** 缩放上限：与引擎 `scaledEnemy` 的 ±15% 钳制同源（双保险，任一处收紧都生效）。 */
export const DIFFICULTY_BOOST_CAP = 0.15;

export function emptyDifficultyStore(): DifficultyStore {
  return { ratings: {}, wins: 0, losses: 0 };
}

/** 模式 + 幕 → 记账键（未知一律归 classic，绝不抛异常）。 */
export function difficultyKeyFor(context: DifficultyContext | undefined): DifficultyKey {
  if (!context) return "classic";
  if (context.endless) return "endless";
  if (context.campaign) {
    const act = Math.round(context.act ?? 1);
    if (act === 2) return "act2";
    if (act === 3) return "act3";
    return "act1";
  }
  return "classic";
}

/** 该键当前评级（无数据 = 目标分）。 */
export function ratingFor(store: DifficultyStore, key: DifficultyKey): number {
  const rating = store.ratings[key];
  return Number.isFinite(rating) ? (rating as number) : DIFFICULTY_TARGET;
}

/** 期望胜率（Elo logistic）。 */
export function expectedWinRate(rating: number): number {
  return 1 / (1 + 10 ** ((DIFFICULTY_TARGET - rating) / 400));
}

/** 一局结果 → 新评级（整数化，保证确定性）。 */
export function ratingUpdate(rating: number, won: boolean, k = DIFFICULTY_K): number {
  const expected = expectedWinRate(rating);
  const next = rating + k * ((won ? 1 : 0) - expected);
  return Math.round(Math.max(0, next));
}

/**
 * 评级 → 难度缩放（±15%）。
 * 方向：rating 高于目标 = 玩家在该模式更强 → **加难**（正 boost）；低于目标 → 减压。
 */
export function boostForRating(rating: number): number {
  const raw = (rating - DIFFICULTY_TARGET) / DIFFICULTY_POINTS_PER_BOOST;
  const clamped = Math.max(-DIFFICULTY_BOOST_CAP, Math.min(DIFFICULTY_BOOST_CAP, raw));
  return Math.round(clamped * 10000) / 10000;
}

/** 该模式当前难度缩放（未开局/无数据 = 0，即基线）。 */
export function boostFor(store: DifficultyStore, key: DifficultyKey): number {
  if (!store.ratings[key]) return 0;
  return boostForRating(ratingFor(store, key));
}

/** 一局结算：更新该模式评级与胜负计数（纯函数，返回新档；不修改入参）。 */
export function recordDifficultyResult(
  store: DifficultyStore,
  key: DifficultyKey,
  won: boolean
): DifficultyStore {
  return {
    ratings: { ...store.ratings, [key]: ratingUpdate(ratingFor(store, key), won) },
    wins: store.wins + (won ? 1 : 0),
    losses: store.losses + (won ? 0 : 1)
  };
}

/** 脏档归一（读档用）：未知键丢弃、非有限数丢弃、计数非负取整。 */
export function normalizeDifficultyStore(input: unknown): DifficultyStore {
  const base = emptyDifficultyStore();
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<DifficultyStore>;
  const keys: DifficultyKey[] = ["classic", "endless", "act1", "act2", "act3"];
  const ratings: Partial<Record<DifficultyKey, number>> = {};
  for (const key of keys) {
    const value = raw.ratings?.[key];
    if (Number.isFinite(value)) ratings[key] = Math.max(0, Math.round(value as number));
  }
  const count = (value: unknown): number =>
    Number.isFinite(value) ? Math.max(0, Math.min(1_000_000, Math.floor(value as number))) : 0;
  return { ratings, wins: count(raw.wins), losses: count(raw.losses) };
}

/** 一句话说明（设置页/徽标用；如实，不吹）。 */
export function difficultySummary(store: DifficultyStore): string {
  const keys: DifficultyKey[] = ["classic", "endless", "act1", "act2", "act3"];
  const active = keys.filter((key) => store.ratings[key]);
  if (!active.length) return "还没有足够的对局做本地评级";
  const parts = active.map((key) => {
    const boost = boostFor(store, key);
    const label = key === "classic" ? "经典" : key === "endless" ? "无尽" : `第${key.slice(3)}幕`;
    return `${label} ${boost > 0 ? "+" : ""}${Math.round(boost * 100)}%`;
  });
  return `本地启发式评级：${parts.join(" · ")}`;
}
