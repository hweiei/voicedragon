/** P9 守势反击：纯规则（零 DOM、零 IO、零随机）。预测与实际结算共用本模块。 */

/** 反击姿态：ratio 为百分比整数（50 = 还击被挡伤害的 50%）。 */
export interface CounterStance {
  ratio: number;
}

export function counterEnabled(state: {
  counterVersion?: number;
  ruleset?: string;
  campaign?: object | null;
}): boolean {
  return state.counterVersion === 1 && state.ruleset === "p7" && Boolean(state.campaign);
}

export interface CounterContext {
  /** 本次敌方行动被玩家护甲挡下的总伤害 */
  blocked: number;
  /** 姿态比率（百分比整数） */
  ratio: number;
  /** 敌方当前护甲（吸收还击，不穿甲） */
  enemyArmor: number;
  /** 敌方是否露隙（所受伤害 +25%，与玩家攻击同规则） */
  enemyVulnerable: boolean;
}

export interface CounterResult {
  /** 实际打到敌方生命的还击伤害（已扣敌方护甲） */
  damage: number;
  /** 还击后的敌方护甲 */
  armorAfter: number;
}

/**
 * 还击结算：blocked > 0 时还击 max(1, floor(blocked × ratio / 100))，
 * 露隙 ×1.25；先被敌方护甲吸收。穿甲行动 blocked = 0，天然不触发。
 */
export function resolveCounterDamage(context: CounterContext): CounterResult {
  const base =
    context.blocked > 0 ? Math.max(1, Math.floor((context.blocked * context.ratio) / 100)) : 0;
  const applied = base > 0 && context.enemyVulnerable ? Math.round(base * 1.25) : base;
  const absorbed = Math.min(context.enemyArmor, applied);
  return { damage: Math.max(0, applied - absorbed), armorAfter: context.enemyArmor - absorbed };
}
