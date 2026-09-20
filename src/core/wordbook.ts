/**
 * P13 词林拾遗（核心层，纯函数）：把「见过的句子」变成可收集、可展示的词林。
 *
 * 收录来源：全部技能短语（含反击技 / 签名技 / 绝技句）+ 全部奇遇标题（场景词，无粤拼不评掌握度）。
 * **奖励不出售强度**：这里只产出点数、称号与掌握度视图——一个战斗字段都没有（契约测试锁定）。
 */

import { ALL_EVENTS, ALL_SKILLS } from "./content";
import type { Skill } from "./data";
import { type SkillMasteryView, masteryTierDistribution, skillMasteryView } from "./mastery";
import type { SrsStore } from "./srs";
import { parseJyutpingTones } from "./tone";

export type WordbookKind = "skill" | "scene";

export interface WordbookEntry {
  id: string;
  kind: WordbookKind;
  name: string;
  phrase: string;
  jyutping?: string;
  lesson: string;
  /** 图鉴是否点亮（技能：图鉴 skills；场景：图鉴 events） */
  collected: boolean;
  /** 短语条目的掌握度视图；场景词为 null */
  mastery: SkillMasteryView | null;
}

export interface WordbookProgress {
  total: number;
  collected: number;
  skillTotal: number;
  skillCollected: number;
  sceneTotal: number;
  sceneCollected: number;
  gradedSyllables: number;
  totalSyllables: number;
  /** 掌握度分布（按短语） */
  tier0: number;
  tier1: number;
  tier2: number;
  /** 词林点数（纯装饰：只解锁称号与主题） */
  points: number;
  title: WordbookTitle;
  nextTitle: WordbookTitle | null;
}

export interface WordbookTitle {
  id: string;
  name: string;
  requirement: number;
  desc: string;
}

/** 称号阶梯（纯装饰）。 */
export const WORDBOOK_TITLES: readonly WordbookTitle[] = [
  { id: "new-voice", name: "新声", requirement: 0, desc: "刚进词林，先声夺人" },
  { id: "tune-reader", name: "识曲", requirement: 20, desc: "开始听得出调门" },
  { id: "tone-wise", name: "通韵", requirement: 60, desc: "六调在你耳里各就各位" },
  { id: "six-tone-master", name: "六调了然", requirement: 120, desc: "整句连读也稳得住" },
  { id: "wordbook-keeper", name: "词林班主", requirement: 200, desc: "这一方词林，你说了算" }
];

/** 点数规则（纯装饰，见证式）：收录 +2；掌握度 tier1 +6、tier2 +12（取最高不叠加）。 */
export const WORDBOOK_POINTS_PER_ENTRY = 2;
export const WORDBOOK_POINTS_PER_TIER1 = 6;
export const WORDBOOK_POINTS_PER_TIER2 = 12;
/** 词林点数解锁「词林」主题的门槛（设置页复用既有主题系统）。 */
export const WORDBOOK_THEME_REQUIREMENT = 80;

/**
 * 场景词（奇遇）：带短语与粤拼，但**不评掌握度**——练习场只开放技能短语的跟读通道，
 * 没有练习数据就不假装有掌握度（诚实降级）。
 */
function sceneEntries(seenEvents: readonly string[]): WordbookEntry[] {
  const seen = new Set(seenEvents);
  return ALL_EVENTS.map((event) => ({
    id: event.id,
    kind: "scene" as const,
    name: event.title,
    phrase: event.lesson.phrase,
    jyutping: event.lesson.jyutping,
    lesson: event.lesson.meaning,
    collected: seen.has(event.id),
    mastery: null
  }));
}

function skillEntries(
  store: SrsStore | null,
  seenSkills: readonly string[],
  skills: readonly Skill[]
): WordbookEntry[] {
  const seen = new Set(seenSkills);
  return skills.map((skill) => ({
    id: skill.id,
    kind: "skill" as const,
    name: skill.name,
    phrase: skill.phrase,
    jyutping: skill.jyutping,
    lesson: skill.lesson,
    collected: seen.has(skill.id),
    mastery: skillMasteryView(store, skill.id, parseJyutpingTones(skill.jyutping))
  }));
}

/** 词林全量条目（技能在前、场景词在后；顺序稳定）。 */
export function wordbookEntries(
  store: SrsStore | null,
  codex: { skills: readonly string[]; events: readonly string[] },
  skills: readonly Skill[] = ALL_SKILLS
): WordbookEntry[] {
  return [...skillEntries(store, codex.skills, skills), ...sceneEntries(codex.events)];
}

/** 点数与称号（纯函数；tier 取最高）。 */
export function wordbookProgress(entries: readonly WordbookEntry[]): WordbookProgress {
  const skillEntriesOnly = entries.filter((entry) => entry.kind === "skill");
  let points = 0;
  let tier1 = 0;
  let tier2 = 0;
  let tier0 = 0;
  let gradedSyllables = 0;
  let totalSyllables = 0;
  for (const entry of entries) {
    if (entry.collected) points += WORDBOOK_POINTS_PER_ENTRY;
    const mastery = entry.mastery;
    if (!mastery) continue;
    if (mastery.tier === 2) {
      tier2 += 1;
      points += WORDBOOK_POINTS_PER_TIER2;
    } else if (mastery.tier === 1) {
      tier1 += 1;
      points += WORDBOOK_POINTS_PER_TIER1;
    } else {
      tier0 += 1;
    }
    gradedSyllables += mastery.graded;
    totalSyllables += mastery.total;
  }
  const title = wordbookTitleFor(points);
  const nextTitle = WORDBOOK_TITLES.find((entry) => entry.requirement > points) ?? null;
  return {
    total: entries.length,
    collected: entries.filter((entry) => entry.collected).length,
    skillTotal: skillEntriesOnly.length,
    skillCollected: skillEntriesOnly.filter((entry) => entry.collected).length,
    sceneTotal: entries.length - skillEntriesOnly.length,
    sceneCollected: entries.filter((entry) => entry.kind === "scene" && entry.collected).length,
    gradedSyllables,
    totalSyllables,
    tier0,
    tier1,
    tier2,
    points,
    title,
    nextTitle
  };
}

export function wordbookTitleFor(points: number): WordbookTitle {
  let current = WORDBOOK_TITLES[0];
  for (const title of WORDBOOK_TITLES) {
    if (points >= title.requirement) current = title;
  }
  return current;
}

/** 掌握度汇总（词林页签顶部一行话用；也可被学习报告复用）。 */
export function wordbookMasterySummary(
  store: SrsStore | null,
  skills: readonly Skill[] = ALL_SKILLS
): {
  tier0: number;
  tier1: number;
  tier2: number;
  gradedSyllables: number;
  totalSyllables: number;
} {
  return masteryTierDistribution(
    store,
    skills.map((skill) => ({ id: skill.id, tones: parseJyutpingTones(skill.jyutping) }))
  );
}

/** 需要补练的句子（有练习数据但未达标，按均分升序）：词林页签的「去练习」入口。 */
export function wordbookFocusIds(entries: readonly WordbookEntry[], limit = 3): string[] {
  return entries
    .filter((entry) => entry.mastery && entry.mastery.graded > 0 && entry.mastery.tier < 2)
    .sort(
      (a, b) =>
        (a.mastery!.average ?? 0) - (b.mastery!.average ?? 0) ||
        a.mastery!.graded - b.mastery!.graded ||
        a.id.localeCompare(b.id)
    )
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.id);
}
