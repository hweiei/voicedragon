/**
 * 内容包注册表：幕号 → 数据包；以及跨幕合并视图（图鉴 / 练习场 / 技能查找）。
 *
 * 约定（P5）：
 * - actContent(act) 永远返回合法包（越界钳到 [1, ACT_COUNT]），引擎/UI 无需判空；
 * - 累计池 *UpToAct(act)：act 1 = 既有 12 技能 / 5 遗物（行为与 P0~P4 逐位一致），
 *   act 2 起追加该幕新内容——奖励/商店/掉落都从累计池抽，保证池永不枯竭；
 * - 事件/敌人/精英/Boss 是本幕独占（换幕即换对手）；
 * - lookupSkill / lookupRelic 供引擎在战斗中按 id 取卡（旧 getSkill 只认识第一幕）。
 */

import {
  type EnemyBlueprint,
  type GameEventContent,
  ITEMS,
  type Item,
  type Relic,
  type Skill
} from "../data";
import { EXPANSION_EVENTS, EXPANSION_ITEMS, EXPANSION_SKILLS } from "./expansion";

/** 缺失版本字段 = legacy；进行中旧局不会被静默升级。 */
export type ContentRuleset = "legacy" | "p7";
import { ACT1_CONTENT } from "./act1";
import { ACT2_CONTENT } from "./act2";
import { ACT3_CONTENT } from "./act3";
import type { ActContentPack } from "./types";

export type { ActContentPack } from "./types";

export const ACT_COUNT = 3;

export const ACT_PACKS: readonly ActContentPack[] = [ACT1_CONTENT, ACT2_CONTENT, ACT3_CONTENT];

/** 幕号中文（UI 展示用）。 */
export const ACT_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;

export function actContent(act: number): ActContentPack {
  const index = Math.max(1, Math.min(ACT_COUNT, Math.floor(act))) - 1;
  return ACT_PACKS[index];
}

/** 累计技能池：act 1 起步，act 2/3 逐幕追加（奖励三选一 / 夜市 / 事件学艺共用）。 */
export function skillsUpToAct(act: number): Skill[] {
  const pack = actContent(act);
  return ACT_PACKS.slice(0, pack.act).flatMap((entry) => entry.skills);
}

/** 累计遗物池：本幕及之前各幕的遗物（精英必掉 / 夜市 / 宝箱 / 事件换取共用）。 */
export function relicsUpToAct(act: number): Relic[] {
  const pack = actContent(act);
  return ACT_PACKS.slice(0, pack.act).flatMap((entry) => entry.relics);
}

/** 跨幕合并注册表（图鉴 / 练习场 / 雷达分母）。act 1 在前，顺序稳定。 */
export const ALL_SKILLS: readonly Skill[] = ACT_PACKS.flatMap((pack) => [
  ...pack.skills,
  ...EXPANSION_SKILLS[pack.act]
]);
export const ALL_RELICS: readonly Relic[] = ACT_PACKS.flatMap((pack) => pack.relics);
export const ALL_EVENTS: readonly GameEventContent[] = ACT_PACKS.flatMap((pack) => [
  ...pack.events,
  ...EXPANSION_EVENTS[pack.act]
]);

/** 图鉴「楼中对手」全集：普通敌人 + 精英 + 各幕 Boss。 */
export function codexEnemyList(): EnemyBlueprint[] {
  return ACT_PACKS.flatMap((pack) => [...pack.enemies, ...pack.elites, pack.boss]);
}

export function lookupSkill(id: string): Skill | undefined {
  return ALL_SKILLS.find((skill) => skill.id === id);
}

export function lookupRelic(id: string): Relic | undefined {
  return ALL_RELICS.find((relic) => relic.id === id);
}

/** 新旧内容查询共用全集；抽取使用版本化池。 */
export const ALL_ITEMS: readonly Item[] = [...ITEMS, ...EXPANSION_ITEMS];
export function itemsFor(ruleset?: ContentRuleset): Item[] {
  return ruleset === "p7" ? [...ALL_ITEMS] : ITEMS;
}
export function skillsFor(act: number, ruleset?: ContentRuleset): Skill[] {
  if (ruleset !== "p7") return skillsUpToAct(act);
  return ACT_PACKS.slice(0, actContent(act).act).flatMap((pack) => [
    ...pack.skills,
    ...EXPANSION_SKILLS[pack.act]
  ]);
}
export function eventsFor(act: number, ruleset?: ContentRuleset): GameEventContent[] {
  const pack = actContent(act);
  return ruleset === "p7" ? [...pack.events, ...EXPANSION_EVENTS[pack.act]] : pack.events;
}
