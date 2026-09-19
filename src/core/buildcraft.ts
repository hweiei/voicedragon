/** P8-A 构筑规则：纯函数；不改变内容表、玩家牌组或随机状态。 */
import { lookupSkill } from "./content";
import type { Skill, SkillType } from "./data";

export interface BuildDeck {
  deck: string[];
  upgradedSlots?: number[];
  removedCards?: number;
}
export type Capability =
  | "damage"
  | "multi"
  | "strength"
  | "guard"
  | "cleanse"
  | "redraw"
  | "heal"
  | "weaken";
export const CAPABILITY_LABELS: Record<Capability, string> = {
  damage: "输出",
  multi: "多段",
  strength: "增势",
  guard: "护甲",
  cleanse: "净化",
  redraw: "换手",
  heal: "治疗",
  weaken: "虚弱"
};
const TYPE_CAPABILITIES: Record<SkillType, readonly Capability[]> = {
  attack: ["damage"],
  multi: ["damage", "multi"],
  strength: ["strength"],
  guard: ["guard"],
  hybrid: ["damage", "guard"],
  cleanse: ["guard", "cleanse"],
  tempo: ["guard", "redraw"],
  heal: ["heal", "guard"],
  weaken: ["damage", "weaken"]
};
export function capabilities(skill: Skill): readonly Capability[] {
  // 得闲饮茶还有固定治疗；顶硬上的护甲有正音条件，不计作稳定护甲来源。
  return skill.id === "dak-haan-jam-caa" ? ["guard", "heal"] : TYPE_CAPABILITIES[skill.type];
}
export const BUILD_FLOWS = [
  { id: "combo", name: "连击增势", description: "声势对每一段攻击生效，多段与增势相互配合。" },
  {
    id: "guard",
    name: "守势攻防",
    description: "用护甲与虚弱抵挡威胁，再穿插输出；没有自动反击。"
  },
  { id: "cycle", name: "调息周转", description: "净化、治疗与换手改善续航；换手仍可能抽回同一张。" }
] as const;

/** P9：反击战役的流派文案覆盖；旧局保持 BUILD_FLOWS 原文逐字不变。 */
export function flowDescription(flow: (typeof BUILD_FLOWS)[number], counterOn: boolean): string {
  return counterOn && flow.id === "guard"
    ? "用护甲与虚弱抵挡威胁；反击姿态能把被挡下的伤害还击回去，穿甲招不触发。"
    : flow.description;
}

/** 仅单卡一次强化，费用、技能 id、短句和全部特殊钩子保持原样。 */
export const UPGRADE_POWER: Readonly<Record<string, number>> = {
  "ding-ngang-soeng": 10,
  "m-sai-geng": 12,
  "hou-sai-lei": 12,
  "jat-cai-soeng": 5,
  "gaa-jau": 3,
  "zap-saang-laa": 7,
  "p7-wan-jyu-sin": 10,
  "p7-zip-zyu-lai": 5,
  "p7-m-hou-gam-gap": 8,
  "p7-waan-gwo-gok-dou": 10,
  "p7-m-hou-fong-hei": 16,
  "p7-jau-gung-jau-sau": 13,
  "p9-waan-faan-bei-nei": 10,
  "p10-jat-fu-dong-gwaan": 19,
  "p10-gu-paan-saang-fai": 12,
  "p10-gaau-ding-saai": 10
};
export const MIN_DECK_SIZE = 5;
export function buildEnabled(state: {
  buildVersion?: number;
  ruleset?: string;
  campaign?: object | null;
}): boolean {
  return state.buildVersion === 1 && state.ruleset === "p7" && Boolean(state.campaign);
}
export function upgradedSkill(skill: Skill): Skill | undefined {
  const power = UPGRADE_POWER[skill.id];
  return power === undefined
    ? undefined
    : {
        ...skill,
        name: `${skill.name}＋`,
        power,
        description:
          skill.type === "strength"
            ? "基础声势 {power}，实际增量随声韵与遗物调整；本场每段攻击受益。"
            : skill.description
      };
}
export function deckSkill(player: BuildDeck, index: number, enabled = true): Skill | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= player.deck.length) return undefined;
  const skill = lookupSkill(player.deck[index]);
  if (!skill) return undefined;
  return enabled && player.upgradedSlots?.includes(index) ? (upgradedSkill(skill) ?? skill) : skill;
}
export function upgradeReason(player: BuildDeck, index: number): string | null {
  const skill = deckSkill(player, index, false);
  if (!skill) return "这张牌已不在牌组中。";
  if (player.upgradedSlots?.includes(index)) return "这张牌已升级，不能重复强化。";
  if (UPGRADE_POWER[skill.id] === undefined) return "这张牌本期尚未开放升级。";
  return null;
}
export function removalPrice(player: BuildDeck): number {
  return Math.min(75, 25 + Math.max(0, player.removedCards ?? 0) * 10);
}
export function removalReason(player: BuildDeck, index: number): string | null {
  const skill = deckSkill(player, index, false);
  if (!skill) return "这张牌已不在牌组中。";
  if (player.deck.length <= MIN_DECK_SIZE) return `至少保留 ${MIN_DECK_SIZE} 张牌。`;
  if (
    capabilities(skill).includes("damage") &&
    !player.deck.some((id, slot) => {
      const other = lookupSkill(id);
      return slot !== index && other && capabilities(other).includes("damage");
    })
  )
    return "不能删除最后一张输出牌。";
  return null;
}
/** 删除槽位只发生在非战斗节点；纯映射避免同名副本串档。 */
export function upgradesAfterRemoval(slots: readonly number[], removedIndex: number): number[] {
  return slots
    .filter((index) => index !== removedIndex)
    .map((index) => (index > removedIndex ? index - 1 : index));
}
export function buildOverview(player: BuildDeck) {
  const counts: Record<Capability, number> = {
    damage: 0,
    multi: 0,
    strength: 0,
    guard: 0,
    cleanse: 0,
    redraw: 0,
    heal: 0,
    weaken: 0
  };
  const costs = [0, 0, 0, 0]; // 0/1/2/3+ 气
  for (const id of player.deck) {
    const skill = lookupSkill(id);
    if (!skill) continue;
    for (const tag of capabilities(skill)) counts[tag]++;
    costs[Math.min(3, skill.cost)]++;
  }
  const flowStatus = [
    counts.multi && counts.strength
      ? "多段与增势已可联动"
      : counts.multi
        ? "已有多段，可寻找增势"
        : counts.strength
          ? "已有增势，可寻找多段"
          : "尚缺多段与增势",
    counts.guard && counts.damage ? "已有输出与护甲，可交替使用" : "需要补足输出或护甲",
    `净化 ${counts.cleanse} · 换手 ${counts.redraw} · 治疗 ${counts.heal}`
  ];
  return { counts, costs, flowStatus };
}

export interface SynergyHint {
  kind: "synergy" | "gap" | "caution";
  text: string;
}
/** 解释当前牌组的事实，不排序奖励、不消费 RNG、不返回无依据的推荐分。 */
export function synergyHints(candidate: Skill, player: BuildDeck): SynergyHint[] {
  const { counts, costs } = buildOverview(player);
  const tags = capabilities(candidate);
  const hints: SynergyHint[] = [];
  if (tags.includes("multi") && counts.strength > 0)
    hints.push({
      kind: "synergy",
      text: `已有 ${counts.strength} 张增势招式，声势对这张牌的每一击生效。`
    });
  if (tags.includes("strength") && counts.multi > 0)
    hints.push({ kind: "synergy", text: `已有 ${counts.multi} 张多段招式，可逐段获得声势加成。` });
  if (tags.includes("cleanse") && counts.cleanse === 0)
    hints.push({ kind: "gap", text: "牌组尚无净化，可补足发音干扰与易伤的应对。" });
  if (tags.includes("heal") && counts.heal === 0)
    hints.push({ kind: "gap", text: "牌组尚无治疗招式，可补充战斗内续航。" });
  if (tags.includes("guard") && counts.guard === 0)
    hints.push({ kind: "gap", text: "牌组尚无稳定护甲来源，可补足防护。" });
  if (tags.includes("redraw") && player.deck.length >= 8)
    hints.push({
      kind: "synergy",
      text: `当前 ${player.deck.length} 张牌，整手换牌可寻找关键招式，但不保证抽到。`
    });
  const copies = player.deck.filter((id) => id === candidate.id).length;
  if (copies >= 2)
    hints.push({ kind: "caution", text: `已有 ${copies} 张同名牌，继续加入会增加其抽牌占比。` });
  if (candidate.cost >= 2 && costs[2] + costs[3] >= Math.ceil(player.deck.length / 2))
    hints.push({ kind: "caution", text: "当前至少半数牌需 2 气以上，注意每回合声气分配。" });
  return hints.slice(0, 2);
}
