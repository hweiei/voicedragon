/** 街坊篇 · 内容数据的类型定义（各章节内容模块共用）。 */

export type CardKind = "persuade" | "calm" | "skill";
/** 标签：用于「接住」街坊的意图（讲价、催促、提问……）。 */
export type Tag =
  | "raise"
  | "rush"
  | "sorry"
  | "confused"
  | "seats"
  | "order"
  | "bill"
  | "where"
  | "time"
  | "direction"
  | "fare"
  | "transport";

export interface CardDef {
  id: string;
  phrase: string;
  jp: string;
  meaning: string;
  kind: CardKind;
  cost: number;
  /** 说服值 */
  persuade?: number;
  /** 稳住值（本回合抵挡耐心损失） */
  calm?: number;
  draw?: number;
  energy?: number;
  tags?: Tag[];
  rarity: "starter" | "common" | "rare";
  /** 所属章节，缺省为第 1 章 */
  chapter?: number;
}

export interface Intent {
  line: string;
  jp: string;
  /** 给学习者看的意思 */
  gloss: string;
  label: string;
  /** 不接住时，你损失的耐心 */
  loss: number;
  /** 用带这个标签的句子卡就能「接住」 */
  need?: Tag;
}

export interface NpcDef {
  id: string;
  name: string;
  img: string;
  /** 场景背景（public/street/bg/*.jpg） */
  bg: string;
  sign: string;
  target: number;
  intro: string;
  win: string;
  intents: Intent[];
  boss?: boolean;
  /** 不在街坊录/街道进度里展示（如温习地摊） */
  hidden?: boolean;
  /** 所属章节，缺省为第 1 章 */
  chapter?: number;
}

export interface RelicDef {
  id: string;
  glyph: string;
  name: string;
  desc: string;
}

export interface EventDef {
  title: string;
  text: string;
  reward: "card" | "gold" | "heal";
}
