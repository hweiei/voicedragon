/**
 * P6-F1 演出编排：FxPlan 纯数据 + effect→plan 映射（纯函数，零 DOM）。
 *
 * 设计（方案 §4/§5-M1）：
 * - 引擎 `emit({ effect })` + `combat.lastResult` 组成 FxContext；
 * - `planFor` 产出可序列化的演出计划（命令模式：纯数据，可单测、可回放）；
 * - FxDirector 消费计划；调度规则（去抖/预算）在 scheduler.ts。
 *
 * 黄金契约：`src/core/` 零侵入，本文件只读引擎已有数据。
 */

/** 演出目标：与战斗界面 DOM 结构对应的逻辑锚点（由 director 解析为元素）。 */
export type FxTarget =
  | "enemy" // 敌人头像（受击抖动）
  | "enemy-stage" // 敌人舞台（伤害浮字宿主）
  | "player-row" // 我方行（受创闪光）
  | "player-status" // 我方状态行（护甲/治疗浮字宿主）
  | "screen"; // 战场全屏（敌方攻击震屏 / 星辉 / 宝藏）

export interface FloaterSpec {
  text: string;
  kind:
    | "damage"
    | "armor"
    | "heal"
    | "star"
    /** P16 乐学快打：施法档位浮字（正音/清晰/入门/未稳），学习回报感的第一落点 */
    | "tier-master"
    | "tier-clear"
    | "tier-learning"
    | "tier-shaky";
  target: FxTarget;
  /** 相对计划起点的延迟（交错节奏：闪光 0 → 抖动 16 → 浮字 40，见方案 §5-M2） */
  delayMs?: number;
  /** 暴击（rawScore ≥ 90「正中」）：浮字放大 + 金光 */
  crit?: boolean;
}

export interface ShakeSpec {
  target: FxTarget;
  /** 振幅 px（2..8，随伤害/敌方上限线性分级，见 ampFor） */
  amp: number;
  ms: number;
}

export interface FlashSpec {
  target: FxTarget;
  ms?: number;
}

export interface FxPlan {
  id: string;
  /** 2 = 不可打断的演出（胜负）；1 = 常规战斗；0 = 装饰 */
  priority: 0 | 1 | 2;
  /** hit-stop：命中瞬间的冻结帧（重击更长），由 director 的时钟门实现 */
  hitstopMs?: number;
  crit?: boolean;
  shakes?: ShakeSpec[];
  flashes?: FlashSpec[];
  floaters?: FloaterSpec[];
  /** 胜利/星辉的字幕序列（按 140ms 交错） */
  starMarks?: string[];
  /** 败北压暗一拍 */
  dim?: boolean;
}

export interface FxContext {
  damage?: number;
  armor?: number;
  healing?: number;
  /** 发音原始分（0-100）：≥ CRIT_SCORE 判暴击 */
  score?: number;
  enemyMaxHp?: number;
}

/* ── 调参常量（打击感参数表见 docs/FX-TUNING，改这里即可全局生效） ───────── */

/** 「正中」暴击线：与 QTE/语音评分的 90+ 档同源 */
export const CRIT_SCORE = 90;
/** 重击线：单次伤害 ≥ 敌方上限 30% → 长 hit-stop */
export const HEAVY_HIT_RATIO = 0.3;
export const HITSTOP_NORMAL_MS = 40;
export const HITSTOP_HEAVY_MS = 80;
export const SHAKE_MIN_AMP = 2;
export const SHAKE_MAX_AMP = 8;
/** 缺失敌方上限时的默认伤害占比（中等震感，避免满幅） */
const FALLBACK_RATIO = 0.4;
/** 浮字入场延迟：让闪光/抖动先手 40ms（0/16/40 交错节奏的第三拍） */
const FLOATER_DELAY_MS = 40;
/** P16 档位浮字延迟：让伤害数字先落，档位评价紧随其后（第四拍） */
const TIER_FLOATER_DELAY_MS = 130;

/** 档位浮字分档线：与引擎 tierFor（src/core/engine.ts）同源 */
const TIER_MASTER_SCORE = 85;
const TIER_CLEAR_SCORE = 65;
const TIER_LEARNING_SCORE = 40;

/**
 * P16 乐学快打：把发音档位变成看得见的回报（纯函数）。
 * 与引擎档位线一致：≥85 正音 / ≥65 清晰 / ≥40 入门 / 其余 未稳。
 * 正音带 crit 金光（与伤害暴击同源视觉语言）；低档用柔和字色，不做负面羞辱。
 */
export function tierFloaterFor(score: number | undefined): FloaterSpec | null {
  if (score === undefined || !Number.isFinite(score)) return null;
  if (score >= TIER_MASTER_SCORE) {
    return {
      text: "正音！",
      kind: "tier-master",
      target: "enemy-stage",
      delayMs: TIER_FLOATER_DELAY_MS,
      crit: true
    };
  }
  if (score >= TIER_CLEAR_SCORE) {
    return {
      text: "清晰",
      kind: "tier-clear",
      target: "enemy-stage",
      delayMs: TIER_FLOATER_DELAY_MS
    };
  }
  if (score >= TIER_LEARNING_SCORE) {
    return {
      text: "入门",
      kind: "tier-learning",
      target: "enemy-stage",
      delayMs: TIER_FLOATER_DELAY_MS
    };
  }
  return {
    text: "未稳",
    kind: "tier-shaky",
    target: "enemy-stage",
    delayMs: TIER_FLOATER_DELAY_MS
  };
}

/** 伤害 → 震屏振幅：线性分级、两端夹取（纯函数）。「手枪不配火箭的晃法」。 */
export function ampFor(damage: number, enemyMaxHp: number): number {
  if (!Number.isFinite(damage) || damage <= 0) return SHAKE_MIN_AMP;
  const ratio =
    Number.isFinite(enemyMaxHp) && enemyMaxHp > 0
      ? Math.min(1, damage / enemyMaxHp)
      : FALLBACK_RATIO;
  const amp = SHAKE_MIN_AMP + (SHAKE_MAX_AMP - SHAKE_MIN_AMP) * ratio;
  return Math.round(amp * 10) / 10;
}

/** 护甲/治疗增益浮字（hit 无伤害时的兜底与 skill 共用）。 */
function buffFloaters(ctx: FxContext): FloaterSpec[] {
  const floaters: FloaterSpec[] = [];
  if ((ctx.armor ?? 0) > 0) {
    floaters.push({
      text: `+${ctx.armor}`,
      kind: "armor",
      target: "player-status",
      delayMs: FLOATER_DELAY_MS
    });
  }
  if ((ctx.healing ?? 0) > 0) {
    floaters.push({
      text: `+${ctx.healing}`,
      kind: "heal",
      target: "player-status",
      delayMs: FLOATER_DELAY_MS
    });
  }
  return floaters;
}

/**
 * effect → 演出计划。未知 effect 或无可播放动作返回 null。
 * 纯函数：同一 (effect, ctx) 必同一计划（与项目确定性纪律一致）。
 */
export function planFor(effect: string | undefined, ctx: FxContext = {}): FxPlan | null {
  switch (effect) {
    case "hit": {
      const damage = ctx.damage ?? 0;
      if (damage <= 0) {
        // 引擎约定 hit 必有伤害；防御性兜底为纯增益演出
        const floaters = buffFloaters(ctx);
        return floaters.length > 0 ? { id: "skill", priority: 1, floaters } : null;
      }
      const crit = (ctx.score ?? 0) >= CRIT_SCORE;
      const heavy =
        Number.isFinite(ctx.enemyMaxHp) &&
        (ctx.enemyMaxHp ?? 0) > 0 &&
        damage >= (ctx.enemyMaxHp as number) * HEAVY_HIT_RATIO;
      const tier = tierFloaterFor(ctx.score);
      const floaters: FloaterSpec[] = [
        {
          text: `-${damage}`,
          kind: "damage",
          target: "enemy-stage",
          delayMs: FLOATER_DELAY_MS,
          crit
        },
        ...buffFloaters(ctx),
        ...(tier ? [tier] : [])
      ];
      return {
        id: crit ? "hit.crit" : "hit",
        priority: 1,
        crit,
        hitstopMs: heavy ? HITSTOP_HEAVY_MS : HITSTOP_NORMAL_MS,
        shakes: [{ target: "enemy", amp: ampFor(damage, ctx.enemyMaxHp ?? 0), ms: 320 }],
        flashes: [{ target: "enemy", ms: 90 }],
        floaters
      };
    }

    case "skill": {
      // P16：防御/治疗类出声施法同样给档位反馈（学习回报不止于攻击）
      const tier = tierFloaterFor(ctx.score);
      const floaters = [...buffFloaters(ctx), ...(tier ? [tier] : [])];
      return floaters.length > 0 ? { id: "skill", priority: 1, floaters } : null;
    }

    case "enemy":
      // 敌方攻击：战场轻震 + 我方红闪（不震出招者，只震受击侧）
      return {
        id: "enemy",
        priority: 1,
        shakes: [{ target: "screen", amp: 5, ms: 280 }],
        flashes: [{ target: "player-row", ms: 340 }]
      };

    case "victory":
      return { id: "victory", priority: 2, starMarks: ["★", "声", "震"] };

    case "star":
      return { id: "star", priority: 2, starMarks: ["★"] };

    case "treasure":
      return {
        id: "treasure",
        priority: 0,
        floaters: [{ text: "✦", kind: "star", target: "screen" }]
      };

    case "defeat":
      return { id: "defeat", priority: 2, dim: true };

    default:
      return null;
  }
}
