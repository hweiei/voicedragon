import type { Skill } from "../data";
/**
 * P11 绝技句内容：进 ALL_SKILLS（图鉴/练习场/SRS 可见可学），不进任何 skillsFor 卡池。
 * type 仅作图鉴标签；power/cost 不参与战斗（战斗效果见 core/bravo.ts ultimateResolve）。
 */
import type { CharacterId } from "./roster";

export interface UltimateDef {
  character: CharacterId;
  skill: Skill;
}

export const ULTIMATE_SKILLS: readonly Skill[] = [
  {
    id: "p11-ultimate-man-mou-saang",
    name: "锣鼓响好戏开场",
    phrase: "锣鼓响好戏开场",
    alternatives: ["锣鼓响好戏开场", "鑼鼓響好戲開場", "锣鼓一响好戏开场"],
    jyutping: "lo4 gu2 hoeng2 hou2 hei3 hoi1 coeng4",
    lesson: "好戏正式开演；绝技蓄满时一锤定音",
    type: "attack",
    rarity: "rare",
    cost: 2,
    power: 18,
    description: "满堂彩绝技（文武生）：重击 15×档位，正音时无视护甲；每场一次。"
  },
  {
    id: "p11-ultimate-faa-daan",
    name: "莺声婉转绕梁三日",
    phrase: "莺声婉转绕梁三日",
    alternatives: ["莺声婉转绕梁三日", "鶯聲婉轉繞梁三日", "歌声绕梁三日"],
    jyutping: "jing1 sing1 jyun2 zyun2 jiu2 loeng4 saam1 jat6",
    lesson: "歌声美妙，余音绕梁久久不散；绝技蓄满时满座皆惊",
    type: "heal",
    rarity: "rare",
    cost: 2,
    power: 8,
    description: "满堂彩绝技（花旦）：回复与护甲 5×档位，调准 ≥80 再 +2 回复；每场一次。"
  },
  {
    id: "p11-ultimate-cau-saang",
    name: "好戏在后头",
    phrase: "好戏在后头",
    alternatives: ["好戏在后头", "好戲在後頭", "精彩的还在后面"],
    jyutping: "hou2 hei3 zoi6 hau6 tau4",
    lesson: "更精彩的还在后面；绝技蓄满时反客为主",
    type: "weaken",
    rarity: "rare",
    cost: 2,
    power: 6,
    description: "满堂彩绝技（丑生）：伤害 5×档位，虚弱 3 回合并夺其全部护甲、立刻换手；每场一次。"
  }
];

export const ULTIMATE_FOR_CHARACTER: Readonly<Record<CharacterId, Skill>> = {
  "man-mou-saang": ULTIMATE_SKILLS[0],
  "faa-daan": ULTIMATE_SKILLS[1],
  "cau-saang": ULTIMATE_SKILLS[2]
};
