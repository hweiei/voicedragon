/** P9 反击版本内容：仅经 skillsFor(act, "p7", 1) 进入反击战役卡池；旧局不可获取。 */
import type { Skill } from "../data";

export const COUNTER_SKILLS: readonly Skill[] = [
  {
    id: "p9-waan-faan-bei-nei",
    name: "还返俾你",
    phrase: "还返俾你",
    alternatives: ["还返俾你", "還返俾你", "还给你", "还给你吧"],
    jyutping: "waan4 faan1 bei2 nei5",
    lesson: "把东西还给对方；这里是把伤害原样奉还",
    type: "guard",
    rarity: "common",
    cost: 1,
    power: 7,
    counter: { ratio: 50 },
    description:
      "获得 {power} 点护甲并摆出反击姿态：敌方下次攻击被护甲挡下时，按 50% 被挡伤害还击（穿甲不触发）。"
  }
];
