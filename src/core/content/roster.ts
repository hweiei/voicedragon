/** P10 名伶登场：角色与签名技内容。仅 rosterVersion=1 的战役使用；旧局零接触。 */
import type { Skill } from "../data";

export type CharacterId = "man-mou-saang" | "faa-daan" | "cau-saang";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  jyutping: string;
  /** 徽记字形（粤剧行当） */
  glyph: string;
  /** 定位一句话（选择卡与战斗状态行共用） */
  role: string;
  /** 招牌名（被动标识） */
  passive: string;
  passiveDescription: string;
  /** 本地解锁条件；null = 默认可用 */
  unlock: { kind: "act-boss"; act: number } | { kind: "achievements"; count: number } | null;
  /** 起始牌组（槽位即顺序，构筑升级按槽位记录） */
  startingDeck: string[];
  /** 签名技 id（进角色限定池） */
  signature: string;
}

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: "man-mou-saang",
    name: "文武生",
    jyutping: "man6 mou5 saang1",
    glyph: "生",
    role: "武场文唱 · 攻势",
    passive: "亮相",
    passiveDescription: "每场战斗首次正音（≥85 分）施法，该次伤害 +4。",
    unlock: null,
    startingDeck: ["ding-ngang-soeng", "m-sai-geng", "zap-saang-laa", "gaa-jau", "faai-di-zau"],
    signature: "p10-jat-fu-dong-gwaan"
  },
  {
    id: "faa-daan",
    name: "花旦",
    jyutping: "faa1 daan2",
    glyph: "旦",
    role: "声色艺全 · 声调",
    passive: "绕梁",
    passiveDescription: "调准分 ≥80 的施法额外获得 2 点护甲（无声破阵拍无调准通道，不触发）。",
    unlock: { kind: "act-boss", act: 1 },
    startingDeck: ["jat-cai-soeng", "faai-di-zau", "m-sai-geng", "jau-mou-gaau-co", "hou-sai-lei"],
    signature: "p10-gu-paan-saang-fai"
  },
  {
    id: "cau-saang",
    name: "丑生",
    jyutping: "cau2 saang1",
    glyph: "丑",
    role: "插科打诨 · 诡变",
    passive: "打诨",
    passiveDescription: "破阵拍 ≥92 分（甜区深处）时回复 1 点声气（每回合一次）；适合无声游玩。",
    unlock: { kind: "achievements", count: 8 },
    startingDeck: [
      "faai-di-zau",
      "ding-ngang-soeng",
      "jau-mou-gaau-co",
      "zap-saang-laa",
      "p9-waan-faan-bei-nei"
    ],
    signature: "p10-gaau-ding-saai"
  }
];

/** 签名技：各角色限定池一张（图鉴全集可见，获取仅限对应角色）。 */
export const SIGNATURE_SKILLS: Readonly<Record<CharacterId, Skill>> = {
  "man-mou-saang": {
    id: "p10-jat-fu-dong-gwaan",
    name: "一夫当关",
    phrase: "一夫当关",
    alternatives: ["一夫当关", "一夫當關", "一个人守住关口"],
    jyutping: "jat1 fu1 dong1 gwaan1",
    lesson: "一个人把守关口，形容有勇力挡千军",
    type: "attack",
    rarity: "rare",
    cost: 2,
    power: 16,
    description: "造成 {power} 点伤害；正音时无视护甲。"
  },
  "faa-daan": {
    id: "p10-gu-paan-saang-fai",
    name: "顾盼生辉",
    phrase: "顾盼生辉",
    alternatives: ["顾盼生辉", "顧盼生輝", "神采飞扬"],
    jyutping: "gu3 paan3 saang1 fai1",
    lesson: "左右顾看之间神采飞扬，形容姿态动人",
    type: "heal",
    rarity: "rare",
    cost: 2,
    power: 9,
    description: "回复 {power} 点生命与 5 点护甲；良好发音（≥65）额外清除发音干扰。"
  },
  "cau-saang": {
    id: "p10-gaau-ding-saai",
    name: "搞掂晒",
    phrase: "搞掂晒",
    alternatives: ["搞掂晒", "全部搞定", "统统搞定"],
    jyutping: "gaau2 ding6 saai3",
    lesson: "全部办妥、统统搞定",
    type: "weaken",
    rarity: "rare",
    cost: 2,
    power: 7,
    description: "造成 {power} 点伤害并令敌人虚弱 2 回合；再夺其半数护甲归为己用。"
  }
};

export const SIGNATURE_SKILL_LIST: readonly Skill[] = CHARACTERS.map(
  (character) => SIGNATURE_SKILLS[character.id]
);

export function lookupCharacter(id: string | undefined): CharacterDef | undefined {
  return CHARACTERS.find((character) => character.id === id);
}
