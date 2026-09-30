/**
 * 章节登记表：每章的场景、语言重点、街坊池、Boss、起手卡组。
 * ready=false 的章节只展示预告，不能开局。
 */
import { CH1_STARTER } from "./content/ch1";

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
    bg: "bg/taxi.jpg",
    ready: false,
    npcsEarly: [],
    npcsLate: [],
    boss: "",
    starter: []
  },
  {
    id: 3,
    label: "第三章",
    title: "唐楼·邻里",
    focus: "请求与投诉 · 咗／紧／过",
    bg: "bg/tonglau.jpg",
    ready: false,
    npcsEarly: [],
    npcsLate: [],
    boss: "",
    starter: []
  },
  {
    id: 4,
    label: "第四章",
    title: "写字楼·搵工",
    focus: "礼貌用语 · 日程 · 可以／识／要",
    bg: "bg/rush.jpg",
    ready: false,
    npcsEarly: [],
    npcsLate: [],
    boss: "",
    starter: []
  },
  {
    id: 5,
    label: "第五章",
    title: "办事·睇医生",
    focus: "描述问题 · 因为／所以 · 比较",
    bg: "bg/market.jpg",
    ready: false,
    npcsEarly: [],
    npcsLate: [],
    boss: "",
    starter: []
  },
  {
    id: 6,
    label: "第六章",
    title: "节庆·饮宴",
    focus: "祝福语 · 情绪 · 俚语",
    bg: "bg/rush.jpg",
    ready: false,
    npcsEarly: [],
    npcsLate: [],
    boss: "",
    starter: []
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
