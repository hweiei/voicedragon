/** Independent beginner curriculum: no changes to legacy combat or saves. */
export interface Lesson {
  id: string;
  title: string;
  phrase: string;
  jyutping: string;
  meaning: string;
  tip: string;
  question: string;
  answers: string[];
  correct: number;
}
export const LESSONS: Lesson[] = [
  {
    id: "greeting",
    title: "街口 · 初次见面",
    phrase: "你好",
    jyutping: "nei5 hou2",
    meaning: "你好。初次见面时的简单问候。",
    tip: "两个音节分别听、分别模仿。粤拼数字表示声调，不是普通话的声调编号。",
    question: "第一次见到街坊，你会怎么打招呼？",
    answers: ["你好", "再见", "唔该"],
    correct: 0
  },
  {
    id: "please",
    title: "茶档 · 请人帮忙",
    phrase: "唔该",
    jyutping: "m4 goi1",
    meaning: "劳驾、麻烦你；也常用来感谢对方提供服务。",
    tip: "“唔”可以单独成音节：双唇轻合，发出鼻音。不要读成普通话的“无”。",
    question: "想请店员过来帮忙，适合先说哪一句？",
    answers: ["早晨", "唔该", "拜拜"],
    correct: 1
  },
  {
    id: "order",
    title: "冰室 · 点一杯饮品",
    phrase: "我要一杯冻奶茶",
    jyutping: "ngo5 jiu3 jat1 bui1 dung3 naai5 caa4",
    meaning: "我要一杯冰奶茶。“冻”在这里表示冰的、冷的。",
    tip: "先分成“我要 / 一杯 / 冻奶茶”三段，再连起来。不要急着追求速度。",
    question: "菜单上的“冻奶茶”是什么意思？",
    answers: ["热奶茶", "不加奶的茶", "冰奶茶"],
    correct: 2
  },
  {
    id: "price",
    title: "夜市 · 问个价钱",
    phrase: "几多钱",
    jyutping: "gei2 do1 cin2",
    meaning: "多少钱？“几多”表示多少。",
    tip: "留意“几”和“钱”的上升音高。先听完整问句，再尝试自然地说。",
    question: "想知道饮品价格，应该问什么？",
    answers: ["几多钱？", "喺边度？", "你好吗？"],
    correct: 0
  },
  {
    id: "thanks",
    title: "街坊 · 收到心意",
    phrase: "多谢",
    jyutping: "do1 ze6",
    meaning: "谢谢。收到礼物、赞赏等时常用。",
    tip: "“多谢”与“唔该”不是处处通用：收到礼物常说多谢，请求帮助常说唔该。",
    question: "街坊送你一份小礼物，你会说什么？",
    answers: ["几多钱", "多谢", "早晨"],
    correct: 1
  },
  {
    id: "boss",
    title: "天台冰室 · 实战",
    phrase: "唔该，我要一杯冻奶茶",
    jyutping: "m4 goi1 ngo5 jiu3 jat1 bui1 dung3 naai5 caa4",
    meaning: "劳驾，我要一杯冰奶茶。把请求与点单连起来。",
    tip: "这是本局的综合挑战。先引起店员注意，再说清楚你想要什么。",
    question: "店员把饮品送到你面前，你可以怎样感谢这次服务？",
    answers: ["几多钱", "你好", "唔该"],
    correct: 2
  }
];
export function routeFor(seed: number): string[] {
  return [
    "街口",
    seed % 2 ? "电车站" : "骑楼巷",
    "霓虹冰室",
    seed % 3 ? "庙街夜市" : "海旁小店",
    "街坊茶档",
    "天台冰室"
  ];
}
export function canAdvance(
  answered: boolean,
  recordingDone: boolean,
  readingOnly: boolean
): boolean {
  return answered && (recordingDone || readingOnly);
}
