/** 第 1 章「街市·茶餐厅」内容表（纯数据）。 */
import type { CardDef, EventDef, NpcDef, RelicDef } from "../types";

export const CH1_CARDS: Record<string, CardDef> = {
  peng: {
    id: "peng",
    phrase: "平啲啦",
    jp: "peng4 di1 laa1",
    meaning: "便宜点吧",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["raise"],
    rarity: "starter"
  },
  mgoi: {
    id: "mgoi",
    phrase: "唔该晒",
    jp: "m4 goi1 saai3",
    meaning: "非常感谢／麻烦你了",
    kind: "calm",
    cost: 1,
    calm: 5,
    rarity: "starter"
  },
  zousan: {
    id: "zousan",
    phrase: "早晨",
    jp: "zou2 san4",
    meaning: "早上好",
    kind: "calm",
    cost: 0,
    calm: 3,
    rarity: "starter"
  },
  geido: {
    id: "geido",
    phrase: "几多钱？",
    jp: "gei2 do1 cin2",
    meaning: "多少钱？",
    kind: "skill",
    cost: 0,
    draw: 2,
    rarity: "starter"
  },
  loengwai: {
    id: "loengwai",
    phrase: "两位",
    jp: "loeng5 wai2",
    meaning: "两位（人数）",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["seats"],
    rarity: "starter"
  },
  naaicaa: {
    id: "naaicaa",
    phrase: "我要一杯冻奶茶",
    jp: "ngo5 jiu3 jat1 bui1 dung3 naai5 caa4",
    meaning: "我要一杯冰奶茶",
    kind: "persuade",
    cost: 2,
    persuade: 10,
    tags: ["order"],
    rarity: "starter"
  },
  wonggok: {
    id: "wonggok",
    phrase: "去旺角",
    jp: "heoi3 wong6 gok3",
    meaning: "去旺角",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["where"],
    rarity: "starter"
  },
  dangzan: {
    id: "dangzan",
    phrase: "等阵先",
    jp: "dang2 zan6 sin1",
    meaning: "等一下",
    kind: "calm",
    cost: 1,
    calm: 6,
    tags: ["rush"],
    rarity: "starter"
  },

  mganjiu: {
    id: "mganjiu",
    phrase: "唔紧要",
    jp: "m4 gan2 jiu3",
    meaning: "没关系",
    kind: "calm",
    cost: 1,
    calm: 8,
    rarity: "common"
  },
  zaubing: {
    id: "zaubing",
    phrase: "走冰",
    jp: "zau2 bing1",
    meaning: "去冰",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["order"],
    rarity: "common"
  },
  maaidaan: {
    id: "maaidaan",
    phrase: "埋单",
    jp: "maai4 daan1",
    meaning: "结账",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["bill"],
    rarity: "common"
  },
  lokce: {
    id: "lokce",
    phrase: "喺呢度落车",
    jp: "hai2 ni1 dou6 lok6 ce1",
    meaning: "在这里下车",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["where"],
    rarity: "common"
  },
  pinji: {
    id: "pinji",
    phrase: "算便宜啲啦",
    jp: "syun3 pin4 ji4 di1 laa1",
    meaning: "算便宜点吧",
    kind: "persuade",
    cost: 1,
    persuade: 9,
    tags: ["raise"],
    rarity: "common"
  },
  houmei: {
    id: "houmei",
    phrase: "好好味",
    jp: "hou2 hou2 mei6",
    meaning: "很好吃",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    calm: 3,
    rarity: "common"
  },
  doze: {
    id: "doze",
    phrase: "多谢",
    jp: "do1 ze6",
    meaning: "谢谢（收到礼物、帮助）",
    kind: "calm",
    cost: 0,
    calm: 4,
    rarity: "common"
  },
  mhouji: {
    id: "mhouji",
    phrase: "唔好意思",
    jp: "m4 hou2 ji3 si1",
    meaning: "不好意思",
    kind: "calm",
    cost: 1,
    calm: 7,
    tags: ["sorry", "confused"],
    rarity: "common"
  },
  maanmaan: {
    id: "maanmaan",
    phrase: "慢慢嚟",
    jp: "maan6 maan2 lai4",
    meaning: "慢慢来",
    kind: "calm",
    cost: 1,
    calm: 4,
    draw: 1,
    tags: ["rush", "confused"],
    rarity: "common"
  },
  moumantai: {
    id: "moumantai",
    phrase: "冇问题",
    jp: "mou5 man6 tai4",
    meaning: "没问题",
    kind: "skill",
    cost: 0,
    energy: 1,
    rarity: "common"
  },
  sengjat: {
    id: "sengjat",
    phrase: "我成日嚟㗎",
    jp: "ngo5 seng4 jat6 lai4 gaa3",
    meaning: "我经常来的",
    kind: "persuade",
    cost: 2,
    persuade: 13,
    rarity: "rare"
  },
  gaaifong: {
    id: "gaaifong",
    phrase: "我哋系街坊嚟㗎",
    jp: "ngo5 dei6 hai6 gaai1 fong1 lai4 gaa3",
    meaning: "我们是街坊啊",
    kind: "persuade",
    cost: 2,
    persuade: 15,
    tags: ["raise"],
    rarity: "rare"
  }
};

export const CH1_STARTER = [
  "peng",
  "peng",
  "mgoi",
  "mgoi",
  "zousan",
  "geido",
  "loengwai",
  "naaicaa",
  "wonggok",
  "dangzan"
];

export const CH1_NPCS: Record<string, NpcDef> = {
  auntie: {
    id: "auntie",
    name: "街市阿婶",
    img: "auntie.png",
    bg: "bg/market.jpg",
    sign: "街市",
    target: 46,
    intro: "生果档阿婶笑眯眯望住你……个价好似有啲贵。",
    win: "好啦好啦，八蚊俾你！",
    intents: [
      {
        line: "靓仔，呢啲十蚊一斤㗎！",
        jp: "leng3 zai2 ni1 di1 sap6 man1 jat1 gan1 gaa3",
        gloss: "帅哥，这些十块一斤的！",
        label: "抬价",
        loss: 12,
        need: "raise"
      },
      {
        line: "要唔要呀？快啲啦！",
        jp: "jiu3 m4 jiu3 aa3 faai3 di1 laa1",
        gloss: "要不要啊？快点啦！",
        label: "催促",
        loss: 11,
        need: "rush"
      },
      {
        line: "睇啱就买啦！",
        jp: "tai2 ngaam1 zau6 maai5 laa1",
        gloss: "看中就买吧！",
        label: "施压",
        loss: 10
      }
    ]
  },
  waiter: {
    id: "waiter",
    name: "茶餐厅伙计",
    img: "waiter.png",
    bg: "bg/cafe.jpg",
    sign: "冰室",
    target: 44,
    intro: "伙计拎住张单，眼都唔抬：「几位？」",
    win: "得，即刻嚟！",
    intents: [
      {
        line: "几多位呀？",
        jp: "gei2 do1 wai2 aa3",
        gloss: "几位？",
        label: "问人数",
        loss: 11,
        need: "seats"
      },
      {
        line: "饮乜嘢呀？",
        jp: "jam2 mat1 je5 aa3",
        gloss: "喝什么？",
        label: "问饮品",
        loss: 12,
        need: "order"
      },
      {
        line: "快啲落单啦！",
        jp: "faai3 di1 lok6 daan1 laa1",
        gloss: "快点下单！",
        label: "催促",
        loss: 11,
        need: "rush"
      }
    ]
  },
  taxi: {
    id: "taxi",
    name: "的士司机",
    img: "taxi.png",
    bg: "bg/taxi.jpg",
    sign: "的士",
    target: 48,
    intro: "司机回头望你：「去边？」",
    win: "明白晒，坐稳啦！",
    intents: [
      {
        line: "去边度呀？",
        jp: "heoi3 bin1 dou6 aa3",
        gloss: "去哪里？",
        label: "问目的地",
        loss: 12,
        need: "where"
      },
      {
        line: "你讲乜嘢话？",
        jp: "nei5 gong2 mat1 je5 waa2",
        gloss: "你说什么？",
        label: "听唔明",
        loss: 11,
        need: "confused"
      },
      {
        line: "喺边度落车？",
        jp: "hai2 bin1 dou6 lok6 ce1",
        gloss: "在哪里下车？",
        label: "问落车",
        loss: 12,
        need: "where"
      }
    ]
  },
  landlady: {
    id: "landlady",
    name: "包租婆",
    img: "landlady.png",
    bg: "bg/tonglau.jpg",
    sign: "唐楼",
    target: 50,
    intro: "包租婆揸住一大串锁匙，企喺门口。",
    win: "算你识做，今个月唔加住！",
    intents: [
      { line: "交租啦！", jp: "gaau1 zou1 laa1", gloss: "交房租啦！", label: "施压", loss: 14 },
      {
        line: "下个月加租！",
        jp: "haa6 go3 jyut6 gaa1 zou1",
        gloss: "下个月涨房租！",
        label: "加价",
        loss: 13,
        need: "raise"
      },
      {
        line: "咁夜仲咁嘈！",
        jp: "gam3 je6 zung6 gam3 cou4",
        gloss: "这么晚还这么吵！",
        label: "投诉",
        loss: 12,
        need: "sorry"
      }
    ]
  },
  boss: {
    id: "boss",
    name: "午市高峰",
    img: "boss.png",
    bg: "bg/rush.jpg",
    sign: "茶餐厅",
    target: 78,
    boss: true,
    intro: "十二点半，成间茶餐厅坐满人。部长姐托住一大盘嘢冲埋嚟！",
    win: "好！你呢位客，我记住咗！",
    intents: [
      {
        line: "快啲！后面好多人等紧！",
        jp: "faai3 di1 hau6 min6 hou2 do1 jan4 dang2 gan2",
        gloss: "快点！后面很多人在等！",
        label: "催促",
        loss: 13,
        need: "rush"
      },
      {
        line: "饮乜嘢？",
        jp: "jam2 mat1 je5",
        gloss: "喝什么？",
        label: "问饮品",
        loss: 13,
        need: "order"
      },
      {
        line: "几多位？",
        jp: "gei2 do1 wai2",
        gloss: "几位？",
        label: "问人数",
        loss: 12,
        need: "seats"
      },
      {
        line: "埋唔埋单？",
        jp: "maai4 m4 maai4 daan1",
        gloss: "结不结账？",
        label: "问埋单",
        loss: 14,
        need: "bill"
      }
    ]
  }
};

/** 普粤密码卡：用普通话规律帮你学粤语。 */
export const CH1_RELICS: Record<string, RelicDef> = {
  rusheng: {
    id: "rusheng",
    glyph: "入",
    name: "入声密码",
    desc: "普通话冇嘅 -p/-t/-k 收尾（如 jat1、lok6）。句子含入声字，说服 +2。"
  },
  mtail: {
    id: "mtail",
    glyph: "m",
    name: "m 尾密码",
    desc: "普通话 -n 嘅部分字，粤语收 -m（如 gam3、jam2）。句子含 -m 尾，稳住 +2。"
  },
  dung: {
    id: "dung",
    glyph: "冻",
    name: "冻＝冰",
    desc: "茶餐厅讲「冻」即系加冰。每场对话第一回合，底气 +1。"
  }
};

export const CH1_EVENTS: EventDef[] = [
  { title: "街口老伯", text: "老伯坐喺凉茶铺门口，话要教你一句：", reward: "card" },
  {
    title: "执到银包",
    text: "你喺地下执到个银包，交还俾失主，佢塞咗啲港纸俾你。",
    reward: "gold"
  },
  { title: "大排档", text: "大排档老板请你饮碗糖水，你个人放松晒。", reward: "heal" }
];
