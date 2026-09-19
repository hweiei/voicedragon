/** P10 名伶被动：纯规则（零 DOM、零 IO、零随机）。引擎结算与测试共用。 */
import type { CharacterId } from "./content/roster";

export interface RosterState {
  rosterVersion?: number;
  ruleset?: string;
  campaign?: object | null;
  characterId?: CharacterId;
}

export function rosterEnabled(state: RosterState): boolean {
  return state.rosterVersion === 1 && state.ruleset === "p7" && Boolean(state.campaign);
}

/** 施法被动上下文（全部来自公开状态与本次施法元数据）。 */
export interface CastPassiveContext {
  characterId: CharacterId;
  /** 本次最终战斗分数（含声韵加成与干扰） */
  score: number;
  /** 调准分；无基频通道为 null（QTE/WebSpeech/仿真） */
  toneScore: number | null;
  /** 施法通道："qte" = 破阵拍 */
  source: string;
  /** 当前一次性标记（combat.passives） */
  passives: Record<string, boolean>;
}

export interface CastPassiveEffect {
  strengthDelta: number;
  armorDelta: number;
  energyDelta: number;
  /** 当次施法伤害加成（亮相一次性爆发，不累积声势） */
  castDamageBonus: number;
  passives: Record<string, boolean>;
}

/**
 * 「亮相」文武生：每场首次正音(≥85) → 当次施法伤害 +4（开场爆发，不累积声势）。
 * 「绕梁」花旦：调准分 ≥80 → 护甲 +2（无标记，逐次判定；无声通道不触发）。
 * 「打诨」丑生：破阵拍 ≥92（甜区深处）→ 声气 +1（每回合一次，标记 endTurn 重置）。
 * 不满足任何条件返回 null（零分配、零标记变更）。
 */
export function applyCastPassive(context: CastPassiveContext): CastPassiveEffect | null {
  const passives = { ...context.passives };
  switch (context.characterId) {
    case "man-mou-saang":
      if (context.score >= 85 && !passives.limelight) {
        passives.limelight = true;
        return { strengthDelta: 0, armorDelta: 0, energyDelta: 0, castDamageBonus: 4, passives };
      }
      return null;
    case "faa-daan":
      if (context.toneScore !== null && context.toneScore >= 80) {
        return { strengthDelta: 0, armorDelta: 2, energyDelta: 0, castDamageBonus: 0, passives };
      }
      return null;
    case "cau-saang":
      if (context.source === "qte" && context.score >= 92 && !passives["jest-turn"]) {
        passives["jest-turn"] = true;
        return { strengthDelta: 0, armorDelta: 0, energyDelta: 1, castDamageBonus: 0, passives };
      }
      return null;
    default:
      return null;
  }
}

/** endTurn 重置每回合标记（亮相等每场标记保留）。 */
export function resetTurnPassives(passives: Record<string, boolean>): Record<string, boolean> {
  // 解构省略替代 delete（biome noDelete）：键同样被移除，行为与 P10 基线逐位一致
  const { "jest-turn": _jestTurn, ...rest } = passives;
  return rest;
}

/** 解锁判定纯函数（本地数据注入：战役元存档与成就数）。 */
export function characterUnlocked(
  character: {
    unlock: { kind: "act-boss"; act: number } | { kind: "achievements"; count: number } | null;
  },
  context: { bossClearedActs: number[]; achievementCount: number }
): boolean {
  if (!character.unlock) return true;
  if (character.unlock.kind === "act-boss")
    return context.bossClearedActs.includes(character.unlock.act);
  return context.achievementCount >= character.unlock.count;
}
