/**
 * 第三幕内容包：云顶声窟（断鸢天空 / 雷鼓回廊 / 九龙天阙）。
 * 终幕差分：敌人普遍带吞音/连击，Boss 是九龙真形——声煞的本体。
 * 数值以仿真校准（docs/BALANCE-REPORT.md），使三幕贪心 Bot 胜率落在 45–65% 区间。
 */

import type { ActContentPack } from "./types";

export const ACT3_CONTENT: ActContentPack = {
  act: 3,
  theme: "云顶声窟",
  subtitle: "云上有云，声外有声",
  notice: "第三幕 · 云顶声窟：最后一程，九声归一。",
  floorNames: [
    "云阶初段",
    "风铃栈道",
    "霓虹残巷",
    "断鸢天空",
    "雷鼓回廊",
    "云雀驿站",
    "玉箫云台",
    "声窟外厅",
    "回声石阵",
    "九霄雷池",
    "龙鳞幕墙",
    "雷鼓之心",
    "云海天梯",
    "声煞巢口",
    "九龙天阙"
  ],
  fallbackName: "云顶深处",
  victoryText: "九龙真形散作满城灯火。你的声音，从此在云上也有回音。",
  skills: [
    {
      id: "ding-zyu-lau",
      name: "顶得住",
      phrase: "顶得住",
      alternatives: ["顶得住", "撐得住", "撑得住"],
      jyutping: "ding2 zyu6",
      lesson: "撑得住、经受得起",
      type: "guard",
      rarity: "common",
      cost: 1,
      power: 11,
      description: "获得 {power} 点护甲；良好发音可再获得 2 点。"
    },
    {
      id: "hou-je",
      name: "好嘢",
      phrase: "好嘢",
      alternatives: ["好嘢", "好野", "太棒了"],
      jyutping: "hou2 je5",
      lesson: "好东西；表示赞叹",
      type: "hybrid",
      rarity: "common",
      cost: 1,
      power: 6,
      description: "造成 {power} 点伤害并获得 {power} 点护甲。"
    },
    {
      id: "sau-gung-laa",
      name: "收工喇",
      phrase: "收工喇",
      alternatives: ["收工喇", "收工啦", "下班了"],
      jyutping: "sau1 gung1 laa3",
      lesson: "下班了、收工了",
      type: "heal",
      rarity: "common",
      cost: 1,
      power: 5,
      description: "回复 {power} 点生命，并获得 5 点护甲。"
    },
    {
      id: "bok-zeun-keoi",
      name: "搏尽佢",
      phrase: "搏尽佢",
      alternatives: ["搏尽佢", "拼尽全力", "搏尽佢啦"],
      jyutping: "bok3 zeon6 keoi5",
      lesson: "拼尽全力",
      type: "multi",
      rarity: "rare",
      cost: 2,
      power: 7,
      hits: 3,
      description: "连续攻击 3 次，每次造成 {power} 点伤害。"
    },
    {
      id: "mou-jau-paa",
      name: "冇有怕",
      phrase: "冇有怕",
      alternatives: ["冇有怕", "有咩好怕", "无所畏惧"],
      jyutping: "mou5 jau5 paa3",
      lesson: "无所畏惧、不用怕",
      type: "strength",
      rarity: "rare",
      cost: 1,
      power: 3,
      description: "本场战斗获得 {power} 点声势，之后攻击更强。"
    }
  ],
  enemies: [
    {
      id: "cloud-sparrow",
      name: "云雀信使",
      epithet: "报信快过你换气",
      glyph: "雀",
      hue: "cyan",
      hp: 36,
      attack: 9,
      pattern: [
        { type: "attack", amount: 1.05, label: "疾哨" },
        { type: "attack", amount: 0.7, hits: 2, label: "双翎剪" },
        { type: "guard", guard: 7, label: "入云" }
      ]
    },
    {
      id: "neon-wraith",
      name: "霓虹残影",
      epithet: "招牌熄了半边，它还亮着",
      glyph: "虹",
      hue: "violet",
      hp: 40,
      attack: 9,
      pattern: [
        { type: "debuff", amount: 2, label: "残光晃眼" },
        { type: "attack", amount: 1.3, label: "灯管横扫" },
        { type: "attack", amount: 0.8, hits: 2, label: "霓虹双闪" }
      ]
    },
    {
      id: "thunder-drummer",
      name: "雷鼓童子",
      epithet: "鼓点抢在你的字头",
      glyph: "鼓",
      hue: "crimson",
      hp: 42,
      attack: 10,
      pattern: [
        { type: "attack", amount: 0.85, hits: 2, label: "双槌连擂" },
        { type: "silence", amount: 9, label: "闷鼓吞音" },
        { type: "attack", amount: 1.5, label: "雷鼓轰顶" }
      ]
    },
    {
      id: "kite-wraith",
      name: "断线纸鸢",
      epithet: "线断了，调子还挂着",
      glyph: "鸢",
      hue: "gold",
      hp: 47,
      attack: 10,
      pattern: [
        { type: "guardAttack", amount: 0.8, guard: 8, label: "剪风" },
        { type: "attack", amount: 1.55, label: "断线俯冲" },
        { type: "guard", guard: 12, label: "盘旋" }
      ]
    },
    {
      id: "bell-echo",
      name: "钟楼回声",
      epithet: "你说过的话，它原样砸回来",
      glyph: "回",
      hue: "teal",
      hp: 50,
      attack: 11,
      pattern: [
        { type: "silence", amount: 10, label: "空钟" },
        { type: "attack", amount: 1.2, label: "撞钟" },
        { type: "attack", amount: 1.7, label: "暮钟长鸣" }
      ]
    }
  ],
  elites: [
    {
      id: "thunder-duke",
      name: "九霄雷公",
      epithet: "每句尾音都劈一道闪",
      glyph: "雷",
      hue: "crimson",
      hp: 82,
      attack: 13,
      pattern: [
        { type: "attack", amount: 1.3, label: "雷斧劈" },
        { type: "attack", amount: 0.8, hits: 3, label: "连环落雷" },
        { type: "debuff", amount: 2, label: "雷鸣震耳" }
      ]
    },
    {
      id: "phoenix-diva",
      name: "凤冠花旦",
      epithet: "一句花腔，戏棚都要让路",
      glyph: "凤",
      hue: "gold",
      hp: 78,
      attack: 14,
      pattern: [
        { type: "guardAttack", amount: 0.9, guard: 2, label: "水袖回风" },
        { type: "attack", amount: 1.85, label: "凤鸣穿云" },
        { type: "silence", amount: 11, label: "假嗓封喉" }
      ]
    }
  ],
  boss: {
    id: "nine-dragon-true",
    name: "九龙真形",
    epithet: "声煞本体，九声六调皆为其爪牙",
    glyph: "真",
    hue: "violet",
    hp: 152,
    attack: 14,
    pattern: [
      { type: "attack", amount: 0.66, hits: 3, label: "九声连环" },
      { type: "debuff", amount: 2, label: "错调天罗" },
      { type: "guardAttack", amount: 1.05, guard: 12, label: "龙鳞音障" },
      { type: "attack", amount: 2.0, label: "真形咆哮" }
    ]
  },
  relics: [
    {
      id: "dragon-scale",
      name: "龙鳞音甲",
      short: "鳞",
      description: "受到攻击时若没有护甲，先获得 3 点护甲。"
    },
    {
      id: "thunder-drum",
      name: "雷音大鼓",
      short: "雷",
      description: "声势类技能提供的声势 +50%。"
    },
    {
      id: "jade-flute",
      name: "碧玉洞箫",
      short: "箫",
      description: "你的手牌数量 +1（每回合 4 张）。"
    },
    {
      id: "cloud-herb",
      name: "凌云香囊",
      short: "香",
      description: "每场战斗胜利后回复 5 点生命。"
    },
    {
      id: "nine-tone-pearl",
      name: "九音骊珠",
      short: "珠",
      description: "正音（85 分以上）施法后，下一次判定 +6 分。"
    }
  ],
  events: [
    {
      id: "cloud-teahouse",
      title: "云顶茶居",
      kicker: "云端一盅两件",
      text: "云上居然有间老茶居，伙记隔雾招呼：‘先生几位？饮啖茶先啦。’",
      lesson: { phrase: "饮啖茶先", jyutping: "jam2 daam6 caa4 sin1", meaning: "先喝口茶（别急）" },
      choices: [
        { id: "rest", label: "饮啖热茶", hint: "回复 22 点生命", action: "heal", value: 22 },
        {
          id: "trade",
          label: "用气力换旧物",
          hint: "失去 9 点生命，获得遗物",
          action: "relicForHp",
          value: 9
        }
      ]
    },
    {
      id: "sky-quiz",
      title: "天阶问对",
      kicker: "云上出题",
      text: "石阶尽头的老人只问一句：‘「顶硬上」最接近哪种心境？’",
      lesson: {
        phrase: "顶硬上",
        jyutping: "ding2 ngaang6 soeng6",
        meaning: "迎难而上、硬着头皮上"
      },
      choices: [
        {
          id: "correct",
          label: "迎难而上",
          hint: "答对可提升声韵",
          action: "quizCorrect",
          value: 1
        },
        { id: "wrong", label: "向上顶东西", hint: "答错会失去生命", action: "quizWrong", value: 7 }
      ]
    },
    {
      id: "kite-master",
      title: "纸鸢匠铺",
      kicker: "云顶手艺",
      text: "老师傅在修一只九龙大风筝。他说：‘筝要顶得住风，人要顶得住声。’",
      lesson: { phrase: "饮头啖汤", jyutping: "jam2 tau4 daam6 tong1", meaning: "抢先得到好处" },
      choices: [
        { id: "learn", label: "听师傅讲古", hint: "最大生命 +7", action: "maxHp", value: 7 },
        { id: "sell", label: "帮手扎风筝", hint: "获得 22 两", action: "gold", value: 22 }
      ]
    },
    {
      id: "cloud-gamble",
      title: "云海赌风",
      kicker: "风眼一瞬",
      text: "云裂开一道缝，有人说缝里有宝，也有人说那是风眼。‘去唔去啊？’",
      lesson: { phrase: "有得震", jyutping: "jau5 dak1 zan3", meaning: "吓得发抖、这次惨了" },
      choices: [
        { id: "safe", label: "稳阵行云路", hint: "获得随机消耗品", action: "item", value: 1 },
        {
          id: "risk",
          label: "冲入风眼",
          hint: "50% 得 40 两；50% 受伤",
          action: "gamble",
          value: 40
        }
      ]
    }
  ]
};
