/** P11 满堂彩与绝技：纯规则（零 DOM、零 IO、零随机）。引擎结算与测试共用。 */
import type { CharacterId } from "./content/roster";

export const BRAVO_MAX = 3;

export function ultimateEnabled(state: {
  ultimateVersion?: number;
  ruleset?: string;
  campaign?: object | null;
}): boolean {
  return state.ultimateVersion === 1 && state.ruleset === "p7" && Boolean(state.campaign);
}

/**
 * 彩转移：基于**裸分**（施法原始分，不含声韵成长/骊珠/干扰加成）——练声提升
 * 伤害与最终分，但彩要真本事；破阵拍同规则（甜区深处 92+ 即正音档）。
 * ≥85 蓄彩 +1（封顶 3）；<65 断彩归零；其间保持。
 * 初版"最终分 + 中段保彩"经仿真证伪（声韵成长后正音率 ~45%、场均 4 绝技、
 * 花旦 81% 越带）；"严格连续裸分"对普通玩家又过苛，取折中并每场限一次。
 */
export function bravoTransition(prev: number, rawScore: number): number {
  const base = Math.max(0, Math.min(BRAVO_MAX, Math.floor(prev)));
  if (rawScore >= 85) return Math.min(BRAVO_MAX, base + 1);
  if (rawScore < 65) return 0;
  return base;
}

/** 绝技效果计划：引擎按计划套用（伤害再叠声势/露隙/护甲吸收）。 */
export interface UltimatePlan {
  /** 基础伤害（引擎再加声势、露隙 ×1.25、敌方护甲吸收） */
  damage: number;
  /** 正音时无视敌方护甲（文武生） */
  bypassArmor: boolean;
  heal: number;
  armor: number;
  /** ≥65 清除发音干扰（花旦） */
  clearInterference: boolean;
  /** 敌方虚弱回合数（丑生） */
  weaknessTurns: number;
  /** 夺取敌方全部护甲（丑生） */
  stealAllArmor: boolean;
  /** 立刻换手（丑生） */
  redraw: boolean;
}

const EMPTY_PLAN: UltimatePlan = {
  damage: 0,
  bypassArmor: false,
  heal: 0,
  armor: 0,
  clearInterference: false,
  weaknessTurns: 0,
  stealAllArmor: false,
  redraw: false
};

/**
 * 绝技结算计划：tierMultiplier 为施法档位倍率（引擎 getScoreTier 产出），
 * toneScore 为调准分（无基频通道为 null，花旦加成诚实不触发）。
 */
export function ultimateResolve(
  characterId: CharacterId,
  tierMultiplier: number,
  score: number,
  toneScore: number | null
): UltimatePlan {
  const mult = Math.max(0, tierMultiplier);
  switch (characterId) {
    case "man-mou-saang":
      return {
        ...EMPTY_PLAN,
        damage: Math.round(15 * mult),
        bypassArmor: score >= 85
      };
    case "faa-daan":
      return {
        ...EMPTY_PLAN,
        heal: Math.round(5 * mult) + (toneScore !== null && toneScore >= 80 ? 2 : 0),
        armor: Math.round(5 * mult),
        clearInterference: score >= 65
      };
    case "cau-saang":
      return {
        ...EMPTY_PLAN,
        damage: Math.round(5 * mult),
        weaknessTurns: 3,
        stealAllArmor: true,
        redraw: true
      };
    default:
      return { ...EMPTY_PLAN };
  }
}
