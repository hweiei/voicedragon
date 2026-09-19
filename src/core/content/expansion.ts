/** P7 增量包：基础表只读；新局显式启用 p7。粤拼为人工编写，仍需母语审校。 */
import type { GameEventContent, Item, Skill } from "../data";

export const EXPANSION_SKILLS: Record<number, Skill[]> = {
  "1": [
    {
      id: "p7-jat-bou-jat-bou",
      name: "一步一步",
      phrase: "一步一步",
      alternatives: ["一步一步"],
      jyutping: "jat1 bou6 jat1 bou6",
      lesson: "一步一步来，稳住节奏",
      type: "hybrid",
      rarity: "common",
      cost: 1,
      power: 5,
      description: "造成 {power} 点伤害，并获得等量护甲。"
    },
    {
      id: "p7-zoi-lai-jat-ci",
      name: "再嚟一次",
      phrase: "再嚟一次",
      alternatives: ["再嚟一次"],
      jyutping: "zoi3 lai4 jat1 ci3",
      lesson: "再来一次",
      type: "multi",
      rarity: "common",
      cost: 1,
      power: 4,
      description: "连续攻击 2 次，每次造成 {power} 点伤害；声势对每一击生效。",
      hits: 2
    },
    {
      id: "p7-man-man-lai",
      name: "慢慢嚟",
      phrase: "慢慢嚟",
      alternatives: ["慢慢嚟"],
      jyutping: "maan6 maan6 lai4",
      lesson: "慢慢来，换个节奏",
      type: "tempo",
      rarity: "common",
      cost: 1,
      power: 6,
      description: "获得 {power} 点护甲，并重新抽取一组手牌。"
    },
    {
      id: "p7-zung-jau-gei-wui",
      name: "仲有机会",
      phrase: "仲有机会",
      alternatives: ["仲有机会", "仲有機會"],
      jyutping: "zung6 jau5 gei1 wui6",
      lesson: "还有机会，恢复再战",
      type: "heal",
      rarity: "rare",
      cost: 2,
      power: 11,
      description: "回复 {power} 点生命，并获得 5 点护甲。"
    }
  ],
  "2": [
    {
      id: "p7-wan-jyu-sin",
      name: "稳住先",
      phrase: "稳住先",
      alternatives: ["稳住先", "穩住先"],
      jyutping: "wan2 zyu6 sin1",
      lesson: "先稳住，不要急",
      type: "cleanse",
      rarity: "common",
      cost: 1,
      power: 8,
      description: "获得 {power} 点护甲，清除发音干扰与易伤。"
    },
    {
      id: "p7-zip-zyu-lai",
      name: "接住嚟",
      phrase: "接住嚟",
      alternatives: ["接住嚟"],
      jyutping: "zip3 zyu6 lai4",
      lesson: "接着来，连贯出招",
      type: "multi",
      rarity: "rare",
      cost: 2,
      power: 4,
      description: "连续攻击 3 次，每次造成 {power} 点伤害；声势逐击叠加。",
      hits: 3
    },
    {
      id: "p7-m-hou-gam-gap",
      name: "唔好咁急",
      phrase: "唔好咁急",
      alternatives: ["唔好咁急"],
      jyutping: "m4 hou2 gam3 gap1",
      lesson: "不要那么急",
      type: "weaken",
      rarity: "common",
      cost: 1,
      power: 6,
      description: "造成 {power} 点伤害，使敌人虚弱 2 回合。"
    },
    {
      id: "p7-jau-lik-sai-lik",
      name: "有力使力",
      phrase: "有力使力",
      alternatives: ["有力使力"],
      jyutping: "jau5 lik6 sai2 lik6",
      lesson: "有力量就使出来",
      type: "strength",
      rarity: "rare",
      cost: 1,
      power: 2,
      description: "提升声势：基础 {power} 点，随发音档位提高；本场每段攻击都受益。"
    },
    {
      id: "p7-deng-zyu-sin",
      name: "顶住先",
      phrase: "顶住先",
      alternatives: ["顶住先", "頂住先"],
      jyutping: "ding2 zyu6 sin1",
      lesson: "先撑住，留力反击",
      type: "guard",
      rarity: "common",
      cost: 2,
      power: 20,
      description: "获得 {power} 点护甲，本回合抵挡来袭。"
    }
  ],
  "3": [
    {
      id: "p7-jat-gu-zok-hei",
      name: "一鼓作气",
      phrase: "一鼓作气",
      alternatives: ["一鼓作气", "一鼓作氣"],
      jyutping: "jat1 gu2 zok3 hei3",
      lesson: "一口气冲过去",
      type: "attack",
      rarity: "rare",
      cost: 2,
      power: 21,
      description: "造成 {power} 点伤害。"
    },
    {
      id: "p7-m-hou-fong-hei",
      name: "唔好放弃",
      phrase: "唔好放弃",
      alternatives: ["唔好放弃", "唔好放棄"],
      jyutping: "m4 hou2 fong3 hei3",
      lesson: "不要放弃",
      type: "heal",
      rarity: "rare",
      cost: 2,
      power: 13,
      description: "回复 {power} 点生命，并获得 5 点护甲。"
    },
    {
      id: "p7-waan-gwo-gok-dou",
      name: "换个角度",
      phrase: "换个角度",
      alternatives: ["换个角度", "換個角度"],
      jyutping: "wun6 go3 gok3 dou6",
      lesson: "换个角度想办法",
      type: "tempo",
      rarity: "common",
      cost: 1,
      power: 8,
      description: "获得 {power} 点护甲，并重新抽取一组手牌。"
    },
    {
      id: "p7-cing-cing-co-co",
      name: "清清楚楚",
      phrase: "清清楚楚",
      alternatives: ["清清楚楚"],
      jyutping: "cing1 cing1 co2 co2",
      lesson: "清楚明白，不受干扰",
      type: "cleanse",
      rarity: "common",
      cost: 1,
      power: 10,
      description: "获得 {power} 点护甲，清除发音干扰与易伤。"
    },
    {
      id: "p7-jau-gung-jau-sau",
      name: "有攻有守",
      phrase: "有攻有守",
      alternatives: ["有攻有守"],
      jyutping: "jau5 gung1 jau5 sau2",
      lesson: "进退有度，攻守兼备",
      type: "hybrid",
      rarity: "rare",
      cost: 2,
      power: 11,
      description: "造成 {power} 点伤害，并获得等量护甲。"
    }
  ]
};

export const EXPANSION_EVENTS: Record<number, GameEventContent[]> = {
  "1": [
    {
      id: "p7-breakfast-stall",
      title: "粥档晨光",
      kicker: "骑楼早餐",
      text: "阿姐把热粥推过来：食饱先有力。旁边的街坊正招人帮手搬凳。",
      lesson: {
        phrase: "食饱先",
        jyutping: "sik6 baau2 sin1",
        meaning: "先吃饱"
      },
      choices: [
        {
          id: "eat",
          label: "坐低食粥",
          hint: "回复 14 点生命",
          action: "heal",
          value: 14
        },
        {
          id: "help",
          label: "帮手搬凳",
          hint: "获得 18 两",
          action: "gold",
          value: 18
        }
      ]
    },
    {
      id: "p7-tailor",
      title: "裁缝铺灯",
      kicker: "针脚旧事",
      text: "师傅穿针引线：慢工出细货。帮他整理布料能换学艺钱，磨针却可能磨破手。",
      lesson: {
        phrase: "慢工出细货",
        jyutping: "maan6 gung1 ceot1 sai3 fo3",
        meaning: "细致做事才出好成品"
      },
      choices: [
        {
          id: "sort",
          label: "整理布料",
          hint: "获得 16 两",
          action: "gold",
          value: 16
        },
        {
          id: "needle",
          label: "帮手磨针",
          hint: "失去 9 点生命，换一件未拥有的遗物",
          action: "relicForHp",
          value: 9
        }
      ]
    },
    {
      id: "p7-opera-rehearsal",
      title: "戏棚试声",
      kicker: "后台学艺",
      text: "花旦请你听完一句再接。她说：唔使心急。你可以学新腔，也可以留在后台调匀气息。",
      lesson: {
        phrase: "唔使心急",
        jyutping: "m4 sai2 sam1 gap1",
        meaning: "不必着急"
      },
      choices: [
        {
          id: "learn",
          label: "跟班学腔",
          hint: "花 12 两学会随机技能；不足则回复 4 生命",
          action: "buySkill",
          value: 12
        },
        {
          id: "rest",
          label: "调匀气息",
          hint: "最大生命 +4，并回复等量生命",
          action: "maxHp",
          value: 4
        }
      ]
    },
    {
      id: "p7-street-direction",
      title: "转角问路",
      kicker: "街坊考口",
      text: "卖报伯问你：「行先」系咩意思？别只看汉字，想想街坊告别时怎样说。",
      lesson: {
        phrase: "行先",
        jyutping: "haang4 sin1",
        meaning: "先走一步"
      },
      choices: [
        {
          id: "right",
          label: "先走一步",
          hint: "答对：永久声韵 +2（上限 15）",
          action: "quizCorrect",
          value: 0
        },
        {
          id: "wrong",
          label: "走到最前面",
          hint: "答错：失去 6 生命，并看解释",
          action: "quizWrong",
          value: 6
        }
      ]
    },
    {
      id: "p7-rain-awning",
      title: "檐下避雨",
      kicker: "雨声慢拍",
      text: "雨点敲着铁皮。店家说：等阵先。你是留下整理货架，还是抄小巷碰碰运气？",
      lesson: {
        phrase: "等阵先",
        jyutping: "dang2 zan6 sin1",
        meaning: "先等一会儿"
      },
      choices: [
        {
          id: "wait",
          label: "等雨停，整理货架",
          hint: "获得一件随机道具",
          action: "item",
          value: 0
        },
        {
          id: "shortcut",
          label: "抄近路",
          hint: "一半概率得 26 两，否则失去 11 生命",
          action: "gamble",
          value: 26
        }
      ]
    }
  ],
  "2": [
    {
      id: "p7-tide-clock",
      title: "潮汐钟房",
      kicker: "守时守信",
      text: "守钟人叫你：睇住个钟。修钟要磨手，但学会听潮也能稳定呼吸。",
      lesson: {
        phrase: "睇住个钟",
        jyutping: "tai2 zyu6 go3 zung1",
        meaning: "留意时间"
      },
      choices: [
        {
          id: "repair",
          label: "协助修钟",
          hint: "失去 12 生命，换一件未拥有的遗物",
          action: "relicForHp",
          value: 12
        },
        {
          id: "listen",
          label: "听潮调息",
          hint: "最大生命 +5，并回复等量生命",
          action: "maxHp",
          value: 5
        }
      ]
    },
    {
      id: "p7-dock-noodles",
      title: "码头面摊",
      kicker: "一碗暖汤",
      text: "船工把最后一张凳子让给你：趁热食。掌柜也愿意用一道新口诀换几两茶钱。",
      lesson: {
        phrase: "趁热食",
        jyutping: "can3 jit6 sik6",
        meaning: "趁热吃"
      },
      choices: [
        {
          id: "eat",
          label: "饮汤食面",
          hint: "回复 18 点生命",
          action: "heal",
          value: 18
        },
        {
          id: "learn",
          label: "向掌柜学口诀",
          hint: "花 14 两学随机技能；不足则回复 4 生命",
          action: "buySkill",
          value: 14
        }
      ]
    },
    {
      id: "p7-lost-ticket",
      title: "遗落船票",
      kicker: "雾里一声",
      text: "售票员说：「冇所谓」唔系话冇道理。你听得明吗？",
      lesson: {
        phrase: "冇所谓",
        jyutping: "mou5 so2 wai6",
        meaning: "无所谓，不介意"
      },
      choices: [
        {
          id: "right",
          label: "不介意",
          hint: "答对：永久声韵 +2（上限 15）",
          action: "quizCorrect",
          value: 0
        },
        {
          id: "wrong",
          label: "没有道理",
          hint: "答错：失去 7 生命，并看解释",
          action: "quizWrong",
          value: 7
        }
      ]
    },
    {
      id: "p7-night-cargo",
      title: "夜航货仓",
      kicker: "互相照应",
      text: "搬运工递来绳头：搭把手。帮忙能赚工钱，也能换一份行路补给。",
      lesson: {
        phrase: "搭把手",
        jyutping: "daap3 baa2 sau2",
        meaning: "帮个忙"
      },
      choices: [
        {
          id: "pay",
          label: "帮忙清点",
          hint: "获得 22 两",
          action: "gold",
          value: 22
        },
        {
          id: "supply",
          label: "帮忙扎绳",
          hint: "获得一件随机道具",
          action: "item",
          value: 0
        }
      ]
    }
  ],
  "3": [
    {
      id: "p7-cloud-steps",
      title: "云阶歇脚",
      kicker: "高处慢行",
      text: "老行者拍拍石阶：唔好逞强。你愿意停下来喝口水，还是在薄雾中重练呼吸？",
      lesson: {
        phrase: "唔好逞强",
        jyutping: "m4 hou2 cing2 koeng4",
        meaning: "不要勉强自己"
      },
      choices: [
        {
          id: "rest",
          label: "坐低饮水",
          hint: "回复 20 点生命",
          action: "heal",
          value: 20
        },
        {
          id: "breathe",
          label: "重练呼吸",
          hint: "最大生命 +5，并回复等量生命",
          action: "maxHp",
          value: 5
        }
      ]
    },
    {
      id: "p7-echo-cave",
      title: "回音问心",
      kicker: "空谷答话",
      text: "岩壁传来一句「谂清楚」。每道回声都有方向，别急着回答。",
      lesson: {
        phrase: "谂清楚",
        jyutping: "nam2 cing1 co2",
        meaning: "想清楚"
      },
      choices: [
        {
          id: "right",
          label: "想清楚再决定",
          hint: "答对：永久声韵 +2（上限 15）",
          action: "quizCorrect",
          value: 0
        },
        {
          id: "wrong",
          label: "把声音说大一点",
          hint: "答错：失去 8 生命，并看解释",
          action: "quizWrong",
          value: 8
        }
      ]
    },
    {
      id: "p7-kite-line",
      title: "断线纸鸢",
      kicker: "云顶来客",
      text: "纸鸢挂在石缝里。孩子说：帮下手。攀过去会磨伤手，留下补线也能得到谢礼。",
      lesson: {
        phrase: "帮下手",
        jyutping: "bong1 haa5 sau2",
        meaning: "帮一下忙"
      },
      choices: [
        {
          id: "climb",
          label: "攀石取鸢",
          hint: "失去 14 生命，换一件未拥有的遗物",
          action: "relicForHp",
          value: 14
        },
        {
          id: "mend",
          label: "留下补线",
          hint: "获得 24 两",
          action: "gold",
          value: 24
        }
      ]
    },
    {
      id: "p7-last-lantern",
      title: "最后一盏灯",
      kicker: "登顶之前",
      text: "守灯人说：行得正，企得正。最后一段路，你选择学一招，还是收下他的补给？",
      lesson: {
        phrase: "行得正",
        jyutping: "haang4 dak1 zing3",
        meaning: "行事正直"
      },
      choices: [
        {
          id: "learn",
          label: "灯下学艺",
          hint: "花 16 两学随机技能；不足则回复 4 生命",
          action: "buySkill",
          value: 16
        },
        {
          id: "supply",
          label: "收下补给",
          hint: "获得一件随机道具",
          action: "item",
          value: 0
        }
      ]
    }
  ]
};

export const EXPANSION_ITEMS: Item[] = [
  {
    id: "p7-bamboo-shield",
    name: "竹编护身符",
    short: "竹",
    description: "战斗中立即获得 12 点护甲；下回合清零。",
    effect: "armor",
    power: 12
  },
  {
    id: "p7-salt-rinse",
    name: "淡盐润喉水",
    short: "盐",
    description: "战斗中清除发音干扰与易伤，获得 4 点护甲。",
    effect: "cleanse",
    power: 4
  },
  {
    id: "p7-ginger-shot",
    name: "姜汁提气饮",
    short: "姜",
    description: "战斗中补充 1 点声气，最多补至 3；声气已满时不消耗。",
    effect: "energy",
    power: 1
  },
  {
    id: "p7-fan",
    name: "醒神折扇",
    short: "扇",
    description: "战斗中重新抽取一组手牌，不消耗声气。",
    effect: "redraw",
    power: 1
  },
  {
    id: "p7-crack-bell",
    name: "破阵响板",
    short: "板",
    description: "令敌人易伤 2 回合：所受攻击伤害 +25%。",
    effect: "expose",
    power: 2
  }
];
