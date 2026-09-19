import { BOSS_EVOLUTIONS } from "./content/encounters";
/** P8-B 纯规则：当前意图、阶段阈值、敌方行动计划、真实受击与预测共用。 */
import type { EnemyIntent } from "./data";

export interface BossPhaseState {
  phase: 1 | 2;
  pending: boolean;
  startTurn: number;
}
export function evolutionEnabled(state: {
  encounterVersion?: number;
  ruleset?: string;
  campaign?: object | null;
}): boolean {
  return state.encounterVersion === 1 && state.ruleset === "p7" && Boolean(state.campaign);
}
export function intentAt(
  pattern: EnemyIntent[],
  turn: number,
  phase?: BossPhaseState
): EnemyIntent {
  return pattern[Math.max(0, turn - (phase?.startTurn ?? 1)) % pattern.length];
}
export function shouldQueuePhase(
  id: string,
  hp: number,
  maxHp: number,
  phase?: BossPhaseState
): boolean {
  const definition = BOSS_EVOLUTIONS[id];
  return Boolean(
    definition &&
      phase?.phase === 1 &&
      !phase.pending &&
      hp > 0 &&
      hp <= maxHp * definition.threshold
  );
}
export interface EnemyAction {
  label: string;
  type: EnemyIntent["type"];
  damage: number;
  hits: number;
  pierce: boolean;
  guard: number;
  voicePenalty: number;
  selfVulnerable: number;
}
export function resolveEnemyAction(
  intent: EnemyIntent,
  baseAttack: number,
  weakness: number
): EnemyAction {
  const attacks = ["attack", "guardAttack", "silence"].includes(intent.type);
  const raw = intent.type === "silence" ? (intent.amount ?? 0) : baseAttack * (intent.amount ?? 0);
  const base = Math.max(1, Math.round(raw));
  const damage = weakness > 0 ? Math.max(1, Math.round(base * 0.65)) : base;
  return {
    label: intent.label,
    type: intent.type,
    damage: attacks ? damage : 0,
    hits: attacks ? (intent.type === "attack" ? intent.hits || 1 : 1) : 0,
    pierce: Boolean(intent.pierce),
    guard: intent.guard ?? 0,
    voicePenalty:
      intent.type === "silence" ? 10 : intent.type === "debuff" ? 7 * (intent.amount || 1) : 0,
    selfVulnerable: intent.selfVulnerable ?? 0
  };
}
export interface HitDefense {
  armor: number;
  vulnerable: boolean;
  dragonScale: boolean;
}
/** 龙鳞音甲逐段触发；穿甲不消耗护甲，也不触发补甲。默认路径与旧 applyEnemyHit 等价。 */
export function resolveIncomingHit(amount: number, defense: HitDefense, pierce = false) {
  const damage = defense.vulnerable ? Math.round(amount * 1.25) : amount;
  const armor = !pierce && defense.dragonScale && defense.armor <= 0 ? 3 : defense.armor;
  const blocked = pierce ? 0 : Math.min(armor, damage);
  return { actual: Math.max(0, damage - blocked), blocked, armorAfter: armor - blocked };
}
export function forecastEnemyAction(action: EnemyAction, player: HitDefense & { hp: number }) {
  let armor = player.armor;
  let total = 0;
  let blocked = 0;
  for (let i = 0; i < action.hits; i++) {
    const hit = resolveIncomingHit(action.damage, { ...player, armor }, action.pierce);
    total += hit.actual;
    blocked += hit.blocked;
    armor = hit.armorAfter;
  }
  const hitDamage = resolveIncomingHit(
    action.damage,
    { ...player, armor: 0, dragonScale: false },
    true
  ).actual;
  const pieces: string[] = [];
  if (action.hits)
    pieces.push(
      `${hitDamage} × ${action.hits} 伤害${player.vulnerable ? "（含玩家易伤）" : ""}${action.pierce ? "（穿甲）" : ""}${action.type === "silence" ? "（吞音固定伤害）" : ""}`
    );
  if (action.guard) pieces.push(`敌方护甲 +${action.guard}`);
  if (action.voicePenalty) pieces.push(`下一句判定 -${action.voicePenalty}`);
  if (action.selfVulnerable) pieces.push(`行动后露隙 ${action.selfVulnerable} 轮（敌方受伤 +25%）`);
  if (action.type === "charge") pieces.unshift("蓄势，不造成伤害");
  const hpLoss = Math.min(Math.max(0, player.hp), total);
  return {
    label: action.label,
    detail: pieces.join(" / "),
    type: action.type === "guardAttack" ? "mixed" : action.type,
    hpLoss,
    blocked,
    forecast: `按当前状态：预计生命 -${hpLoss}，护甲抵消 ${blocked}。`,
    hint: action.pierce
      ? "此招无视护甲；虚弱仍可减伤。"
      : action.voicePenalty
        ? "干扰只影响下一句，可先用辅助招承接。"
        : action.selfVulnerable
          ? "露隙在敌方行动结束后生效，下一轮可集中输出。"
          : action.hits > 1
            ? "护甲逐段抵挡；留意连击总量。"
            : "预测会随护甲、虚弱和易伤状态更新。"
  };
}
