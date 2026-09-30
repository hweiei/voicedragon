/**
 * 章节登记表：每章的场景、语言重点、街坊池、Boss、起手卡组。
 * ready=false 的章节只展示预告，不能开局。
 */
import { CH1_STARTER } from "./content/ch1";
import { CH2_STARTER } from "./content/ch2";
import { CH3_STARTER } from "./content/ch3";
import { CH4_STARTER } from "./content/ch4";
import { CH5_STARTER } from "./content/ch5";
import { CH6_STARTER } from "./content/ch6";

export interface ChapterDef {
  id: number;
  /** 例：第一章 */
  label: string;
  title: string;
  /** 这一章学什么（给玩家看） */
  focus: string;
  /** 章节卡片背景（public/street/ 下的相对路径） */
  bg: string;
  ready: boolean;
  /** 地图前段（第 1–2 行）出现的街坊 */
  npcsEarly: string[];
  /** 地图后段（第 3 行起）出现的街坊 */
  npcsLate: string[];
  boss: string;
  starter: string[];
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    label: "第一章",
    title: "街市·茶餐厅",
    focus: "问候 · 数字 · 价钱 · 点餐 · 啦／呀／㗎",
    bg: "bg/cafe.jpg",
    ready: true,
    npcsEarly: ["auntie", "waiter", "taxi"],
    npcsLate: ["auntie", "waiter", "taxi", "landlady"],
    boss: "boss",
    starter: CH1_STARTER
  },
  {
    id: 2,
    label: "第二章",
    title: "出行·问路",
    focus: "方位 · 地点 · 时间 · 喺／去／嚟",
    bg: "bg/busstop.jpg",
    ready: true,
    npcsEarly: ["mtrstaff", "grandpa"],
    npcsLate: ["mtrstaff", "grandpa", "minibus"],
    boss: "buscaptain",
    starter: CH2_STARTER
  },
  {
    id: 3,
    label: "第三章",
    title: "唐楼·邻里",
    focus: "请求与投诉 · 咗／紧（体貌助词）",
    bg: "bg/rooftop.jpg",
    ready: true,
    npcsEarly: ["neibour", "kid"],
    npcsLate: ["neibour", "kid", "faan"],
    boss: "chair",
    starter: CH3_STARTER
  },
  {
    id: 4,
    label: "第四章",
    title: "写字楼·搵工",
    focus: "礼貌与排期 · 可／识（情态动词）",
    bg: "bg/rush.jpg",
    ready: true,
    npcsEarly: ["staff", "clerk"],
    npcsLate: ["staff", "clerk", "chief"],
    boss: "director",
    starter: CH4_STARTER
  },
  {
    id: 5,
    label: "第五章",
    title: "办事·睇医生",
    focus: "描述问题 · 因为／所以 · 比较",
    bg: "bg/clinic.jpg",
    ready: true,
    npcsEarly: ["doctor", "counter"],
    npcsLate: ["doctor", "counter", "ticket"],
    boss: "yuen",
    starter: CH5_STARTER
  },
  {
    id: 6,
    label: "第六章",
    title: "节庆·饮宴",
    focus: "祝福语 · 情绪 · 人情世故",
    bg: "bg/banquet.jpg",
    ready: true,
    npcsEarly: ["mc", "cook2"],
    npcsLate: ["mc", "cook2", "lion"],
    boss: "saicing",
    starter: CH6_STARTER
  }
];

export function chapterOf(id: number | undefined): ChapterDef {
  return CHAPTERS.find((c) => c.id === id && c.ready) ?? CHAPTERS[0];
}

/** 章节是否解锁：第 1 章常开，其余需通关上一章且内容已就绪 */
export function chapterUnlocked(id: number, cleared: number[]): boolean {
  const ch = CHAPTERS.find((c) => c.id === id);
  if (!ch?.ready) return false;
  return id === 1 || cleared.includes(id - 1);
}
