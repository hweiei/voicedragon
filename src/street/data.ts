/**
 * 街坊篇内容总表：合并各章节内容模块，对外保持原有导出不变。
 * 新章节：在 content/ 下新增 chN.ts，并在这里合并、在 chapters.ts 登记。
 */
import { CH1_CARDS, CH1_EVENTS, CH1_NPCS, CH1_RELICS, CH1_STARTER } from "./content/ch1";
import { CH2_CARDS, CH2_EVENTS, CH2_NPCS, CH2_STARTER } from "./content/ch2";
import { CH3_CARDS, CH3_EVENTS, CH3_NPCS, CH3_RELICS, CH3_STARTER } from "./content/ch3";
import { CH4_CARDS, CH4_EVENTS, CH4_NPCS, CH4_RELICS, CH4_STARTER } from "./content/ch4";
import type { CardDef, EventDef, NpcDef, RelicDef } from "./types";

export type { CardDef, CardKind, EventDef, Intent, NpcDef, RelicDef, Tag } from "./types";

function tag<T extends { chapter?: number }>(
  rec: Record<string, T>,
  chapter: number
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(rec).map(([k, v]) => [k, { ...v, chapter: v.chapter ?? chapter }])
  );
}

export const CARDS: Record<string, CardDef> = {
  ...tag(CH1_CARDS, 1),
  ...tag(CH2_CARDS, 2),
  ...tag(CH3_CARDS, 3),
  ...tag(CH4_CARDS, 4)
};
/** 温习地摊：跨章节的复习对战对象，不进任何章节的常规池 */
export const RECAP_NPCS: Record<string, NpcDef> = {
  recap: {
    id: "recap",
    name: "温习地摊",
    img: "auntie.png",
    bg: "bg/market.jpg",
    sign: "温习",
    target: 26,
    hidden: true,
    intro: "阿婶摆开你旧日的句子：「上先学嘅，仲记唔记得呀？」",
    win: "记牢晒，行路都带劲！",
    intents: [
      {
        line: "呢啲句要趁热读啦。",
        jp: "ni1 di1 ge2 jau3 soeng6 zat6 duk6 laa1",
        gloss: "这些句子要趁热读啦。",
        label: "催温习",
        loss: 2
      },
      {
        line: "唔紧要，慢慢嚟。",
        jp: "m4 gan2 jiu3, maan6 maan2 lai4",
        gloss: "没关系，慢慢来。",
        label: "打气",
        loss: 2
      },
      {
        line: "读到啱晒，有赏㗎！",
        jp: "duk6 dou3 gaam1 saai3, jau5 song2 gaa3",
        gloss: "读得全对，有奖励的！",
        label: "利诱",
        loss: 2
      }
    ]
  }
};
export const NPCS: Record<string, NpcDef> = {
  ...tag(CH1_NPCS, 1),
  ...tag(CH2_NPCS, 2),
  ...tag(CH3_NPCS, 3),
  ...tag(CH4_NPCS, 4),
  ...tag(RECAP_NPCS, 1)
};
export const RELICS: Record<string, RelicDef> = { ...CH1_RELICS, ...CH3_RELICS, ...CH4_RELICS };
export const EVENTS: EventDef[] = [...CH1_EVENTS, ...CH2_EVENTS, ...CH3_EVENTS, ...CH4_EVENTS];
/** 兼容旧代码：第 1 章起手卡组 */
export const STARTER_DECK: string[] = [...CH1_STARTER];
export { CH1_STARTER, CH2_STARTER, CH3_STARTER, CH4_STARTER };
