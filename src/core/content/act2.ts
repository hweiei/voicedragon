/**
 * 第二幕内容包：雾海码头（渡轮夜航 / 咸鱼市灯 / 龙王庙埗头）。
 * 以第一幕为模板的数值/文案差分：敌人更重节奏惩罚（吞音/虚弱更多），
 * Boss 体量略增。技能/遗物机制全部复用既有 SkillType 与遗物钩子，零新内核机制。
 */

import type { ActContentPack } from "./types";

export const ACT2_CONTENT: ActContentPack = {
  act: 2,
  theme: "雾海码头",
  subtitle: "汽笛压着潮声，字音要稳过浪",
  notice: "第二幕 · 雾海码头：潮雾更重，对手更懂听你破绽。",
  floorNames: [
    "潮门雾栅",
    "渡口石栈",
    "咸鱼市灯",
    "缆桩暗角",
    "雾笛浮台",
    "舢板横水",
    "灯塔基座",
    "货仓夹层",
    "锚链深廊",
    "龙王庙埗头",
    "风暴栈桥",
    "引航灯室",
    "沉钟海穴",
    "雾海天台",
    "九龙灯楼"
  ],
  fallbackName: "雾海航路",
  victoryText: "雾海龙王沉回潮底，汽笛重新亮起引航的调子。",
  skills: [
    {
      id: "gaau-dim-saai",
      name: "搞掂晒",
      phrase: "搞掂晒",
      alternatives: ["搞掂晒", "全部搞定", "都搞定了"],
      jyutping: "gaau2 dim6 saai3",
      lesson: "全部办妥了",
      type: "attack",
      rarity: "common",
      cost: 1,
      power: 11,
      description: "造成 {power} 点伤害。发音越准，事情越快搞掂。"
    },
    {
      id: "sing-deng-di",
      name: "醒定啲",
      phrase: "醒定啲",
      alternatives: ["醒定啲", "醒定D", "打起精神"],
      jyutping: "sing2 deng6 di1",
      lesson: "打起精神、小心一点",
      type: "guard",
      rarity: "common",
      cost: 1,
      power: 10,
      description: "获得 {power} 点护甲；良好发音可再获得 2 点。"
    },
    {
      id: "m-hou-ji-si",
      name: "唔好意思",
      phrase: "唔好意思",
      alternatives: ["唔好意思", "不好意思"],
      jyutping: "m4 hou2 ji3 si1",
      lesson: "不好意思；打扰别人时说",
      type: "weaken",
      rarity: "common",
      cost: 1,
      power: 6,
      description: "造成 {power} 点伤害，并令敌人虚弱 2 回合。"
    },
    {
      id: "taan-sai-gaai",
      name: "叹世界",
      phrase: "叹世界",
      alternatives: ["叹世界", "嘆世界", "享受生活"],
      jyutping: "taan3 sai3 gaai3",
      lesson: "好好享受生活",
      type: "heal",
      rarity: "rare",
      cost: 2,
      power: 8,
      description: "回复 {power} 点生命，并获得 5 点护甲。"
    },
    {
      id: "sik-ngaang-keoi",
      name: "食硬佢",
      phrase: "食硬佢",
      alternatives: ["食硬佢", "吃定它", "拿下它"],
      jyutping: "sik6 ngaang6 keoi5",
      lesson: "吃定它、势在必得",
      type: "attack",
      rarity: "rare",
      cost: 2,
      power: 20,
      description: "造成 {power} 点伤害。优秀或正音时额外获得 4 点护甲。"
    }
  ],
  enemies: [
    {
      id: "fog-deckhand",
      name: "雾甲板手",
      epithet: "在湿甲板上拖出长长的回声",
      glyph: "水",
      hue: "teal",
      hp: 32,
      attack: 8,
      pattern: [
        { type: "attack", amount: 1, label: "缆绳抽击" },
        { type: "guardAttack", amount: 0.7, guard: 6, label: "湿帆压顶" },
        { type: "attack", amount: 1.3, label: "雾里荡桨" }
      ]
    },
    {
      id: "saltfish-monger",
      name: "咸鱼档主",
      epithet: "嘴上抹盐，专腌含糊的尾音",
      glyph: "咸",
      hue: "gold",
      hp: 34,
      attack: 8,
      pattern: [
        { type: "debuff", amount: 1, label: "腌声盐雾" },
        { type: "attack", amount: 1.25, label: "秤砣横扫" },
        { type: "attack", amount: 0.85, hits: 2, label: "双鲫拍台" }
      ]
    },
    {
      id: "storm-lantern",
      name: "风灯魅影",
      epithet: "灯芯一晃，调子就跟着跑",
      glyph: "灯",
      hue: "violet",
      hp: 37,
      attack: 9,
      pattern: [
        { type: "attack", amount: 0.75, hits: 2, label: "灯影双闪" },
        { type: "guard", guard: 8, label: "罩灯" },
        { type: "attack", amount: 1.45, label: "风暴提灯" }
      ]
    },
    {
      id: "iron-crane",
      name: "货吊铁臂",
      epithet: "吊得起整箱货，也吊得住话头",
      glyph: "吊",
      hue: "crimson",
      hp: 44,
      attack: 10,
      pattern: [
        { type: "guard", guard: 10, label: "锁钩" },
        { type: "attack", amount: 1.5, label: "吊臂回旋" },
        { type: "guardAttack", amount: 0.8, guard: 6, label: "货箱下压" }
      ]
    },
    {
      id: "tide-siren",
      name: "潮汐歌妖",
      epithet: "跟错它一句，就被浪带走半层",
      glyph: "妖",
      hue: "cyan",
      hp: 40,
      attack: 9,
      pattern: [
        { type: "silence", amount: 9, label: "哑潮" },
        { type: "attack", amount: 1.15, label: "浪舌卷" },
        { type: "attack", amount: 1.6, label: "夜潮拍岸" }
      ]
    }
  ],
  elites: [
    {
      id: "lighthouse-keeper",
      name: "灯塔守夜人",
      epithet: "灯转一圈，就要听清一句",
      glyph: "守",
      hue: "gold",
      hp: 79,
      attack: 12,
      pattern: [
        { type: "guardAttack", amount: 0.85, guard: 10, label: "旋灯扫照" },
        { type: "attack", amount: 1.75, label: "光柱贯夜" },
        { type: "debuff", amount: 2, label: "雾号催眠" }
      ]
    },
    {
      id: "temple-oracle",
      name: "龙王庙祝",
      epithet: "香灰写字，卜签先卜你的声",
      glyph: "祝",
      hue: "crimson",
      hp: 76,
      attack: 13,
      pattern: [
        { type: "attack", amount: 1.2, label: "签筒摇喝" },
        { type: "silence", amount: 10, label: "封口符" },
        { type: "attack", amount: 0.75, hits: 3, label: "三炷断香" }
      ]
    }
  ],
  boss: {
    id: "fog-dragon-king",
    name: "雾海龙王",
    epithet: "码头之巅，潮声与汽笛都是它的鳞",
    glyph: "潮",
    hue: "teal",
    hp: 150,
    attack: 14,
    pattern: [
      { type: "attack", amount: 0.64, hits: 3, label: "三叠浪喝" },
      { type: "debuff", amount: 2, label: "浓雾锁喉" },
      { type: "guardAttack", amount: 1.1, guard: 12, label: "龙鳞潮盾" },
      { type: "attack", amount: 2.1, label: "海啸合鸣" }
    ]
  },
  relics: [
    {
      id: "ferry-lantern",
      name: "引航纱灯",
      short: "灯",
      description: "每场战斗开始时获得 4 点护甲。"
    },
    {
      id: "harbor-bell",
      name: "泊港铜铃",
      short: "铃",
      description: "每回合第一次施法获得 2 点护甲。"
    },
    {
      id: "salty-lemon",
      name: "咸柠茶盅",
      short: "柠",
      description: "声韵 70 分以上的施法回复 2 点生命，每回合最多一次。"
    },
    {
      id: "old-compass",
      name: "老船罗盘",
      short: "盘",
      description: "每场战斗第 1 回合声气 +1。"
    },
    {
      id: "night-market-vip",
      name: "夜市贵宾牌",
      short: "宾",
      description: "夜市所有商品价格降低 15%。"
    }
  ],
  events: [
    {
      id: "midnight-ferry",
      title: "夜渡船舱",
      kicker: "雾海夜航",
      text: "老船家递来一杯热姜茶：‘坐稳啲，雾大，声要放慢。’",
      lesson: { phrase: "坐稳啲", jyutping: "co5 wan2 di1", meaning: "坐稳一点" },
      choices: [
        { id: "rest", label: "饮杯姜茶", hint: "回复 20 点生命", action: "heal", value: 20 },
        {
          id: "learn",
          label: "同船家学句口诀",
          hint: "获得随机技能，失去 10 两",
          action: "buySkill",
          value: 10
        }
      ]
    },
    {
      id: "fish-market-quiz",
      title: "咸鱼市口诀",
      kicker: "识讲识赚",
      text: "档主把秤一横：‘讲对呢句，斤两足啲——咸鱼翻生，系咩意思？’",
      lesson: {
        phrase: "咸鱼翻生",
        jyutping: "haam4 jyu2 faan1 sang1",
        meaning: "翻生=重新振作、死灰复燃"
      },
      choices: [
        {
          id: "correct",
          label: "重新振作",
          hint: "答对可提升声韵",
          action: "quizCorrect",
          value: 1
        },
        { id: "wrong", label: "咸鱼发臭", hint: "答错会失去生命", action: "quizWrong", value: 7 }
      ]
    },
    {
      id: "typhoon-shelter",
      title: "避风塘",
      kicker: "风急浪高",
      text: "塘里灯火通明，艇家粥档冒着白气。有人叫你帮手收缆，也有人请你食碗艇仔粥。",
      lesson: {
        phrase: "食碗粥先",
        jyutping: "sik6 wun2 zuk1 sin1",
        meaning: "先吃碗粥（歇一歇）"
      },
      choices: [
        { id: "eat", label: "食碗艇仔粥", hint: "最大生命 +6", action: "maxHp", value: 6 },
        { id: "work", label: "帮手收缆", hint: "获得 20 两", action: "gold", value: 20 }
      ]
    },
    {
      id: "sea-gamble",
      title: "海雾赌航",
      kicker: "搏一搏",
      text: "雾里两条水路：一条有灯，一条更快但看不清底。老舵手说：‘搏唔搏由你。’",
      lesson: { phrase: "搏一搏", jyutping: "bok3 jat1 bok3", meaning: "赌一把、试一试" },
      choices: [
        { id: "wait", label: "跟灯走", hint: "获得随机消耗品", action: "item", value: 1 },
        {
          id: "shortcut",
          label: "搏一搏雾路",
          hint: "50% 得 36 两；50% 受伤",
          action: "gamble",
          value: 36
        }
      ]
    }
  ]
};
