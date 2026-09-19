/** P8-B 新对手数据：只供 encounterVersion=1 的战役使用，基础三幕包不改。 */
import type { EnemyBlueprint, EnemyIntent } from "../data";

export interface BossEvolution {
  phaseName: string;
  threshold: number;
  description: string;
  counterplay: string;
  pattern: EnemyIntent[];
}
export const BOSS_EVOLUTIONS: Readonly<Record<string, BossEvolution>> = {
  "nine-tone-dragon": {
    phaseName: "裂甲连鸣",
    threshold: 0.5,
    description: "第二阶段以蓄势开场，随后三连击与护鳞交替。",
    counterplay: "露隙时集中输出，连击前补甲或施加虚弱。",
    pattern: [
      { type: "charge", label: "裂鳞蓄势", selfVulnerable: 1 },
      { type: "attack", amount: 0.68, hits: 3, label: "三叠龙吟" },
      { type: "guardAttack", amount: 0.9, guard: 8, label: "回声护鳞" },
      { type: "attack", amount: 1.6, label: "九声重奏" }
    ]
  },
  "fog-dragon-king": {
    phaseName: "潮汐回流",
    threshold: 0.5,
    description: "第二阶段出现固定伤害吞音，潮退护湾后露隙。",
    counterplay: "用辅助招承接下一句干扰；潮退露隙时再集中输出。",
    pattern: [
      { type: "charge", label: "吸潮蓄势", selfVulnerable: 1 },
      { type: "silence", amount: 8, label: "雾笛封喉" },
      { type: "attack", amount: 1.7, label: "决堤拍岸" },
      { type: "guard", guard: 12, label: "潮退护湾", selfVulnerable: 1 }
    ]
  },
  "nine-dragon-true": {
    phaseName: "破云独唱",
    threshold: 0.5,
    description: "第二阶段以蓄势预告穿甲，随后穿甲与双击交替。",
    counterplay: "穿甲不受护甲抵挡；用虚弱减伤，或利用蓄势窗口抢攻。",
    pattern: [
      { type: "charge", label: "凝声蓄势", selfVulnerable: 1 },
      { type: "attack", amount: 0.95, pierce: true, label: "破云独唱" },
      { type: "attack", amount: 0.65, hits: 2, label: "双声回旋" },
      { type: "guard", guard: 10, label: "收翼音障" }
    ]
  }
};

export const EVOLVED_ELITES: Readonly<Record<number, EnemyBlueprint>> = {
  1: {
    id: "p8b-armored-master",
    name: "钉甲武师",
    epithet: "架甲起势，三拳之后必有破绽",
    glyph: "钉",
    hue: "crimson",
    hp: 78,
    attack: 11,
    pattern: [
      { type: "guard", guard: 6, label: "钉甲起架" },
      { type: "attack", amount: 0.55, hits: 3, label: "三连快打" },
      { type: "charge", selfVulnerable: 1, label: "收招调息" }
    ]
  },
  2: {
    id: "p8b-tide-watchman",
    name: "引潮巡夜人",
    epithet: "雾笛乱声，潮棍随后，换气可乘",
    glyph: "巡",
    hue: "teal",
    hp: 82,
    attack: 12,
    pattern: [
      { type: "silence", amount: 6, label: "雾笛噤声" },
      { type: "attack", amount: 1.35, label: "引潮长棍" },
      { type: "charge", selfVulnerable: 1, label: "临潮换气" }
    ]
  },
  3: {
    id: "p8b-cloud-duelist",
    name: "破云剑客",
    epithet: "亮刃一息，剑锋穿甲，回剑双鸣",
    glyph: "剑",
    hue: "violet",
    hp: 86,
    attack: 13,
    pattern: [
      { type: "charge", selfVulnerable: 1, label: "亮刃凝声" },
      { type: "attack", amount: 0.9, pierce: true, label: "破云穿甲剑" },
      { type: "attack", amount: 0.65, hits: 2, label: "双声回剑" }
    ]
  }
};
