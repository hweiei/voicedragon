/** 第 2 章「出行·问路」内容表（纯数据）。 */
import type { CardDef, EventDef, NpcDef } from "../types";

export const CH2_CARDS: Record<string, CardDef> = {
  heobin: {
    id: "heobin",
    phrase: "去边度呀？",
    jp: "heoi3 bin1 dou6 aa3",
    meaning: "去哪里呀？",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["where"],
    rarity: "starter"
  },
  hainei: {
    id: "hainei",
    phrase: "喺边度？",
    jp: "hai2 bin1 dou6",
    meaning: "在哪里？",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["where"],
    rarity: "starter"
  },
  lokcebin: {
    id: "lokcebin",
    phrase: "边度落车？",
    jp: "bin1 dou6 lok6 ce1",
    meaning: "哪里下车？",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["where"],
    rarity: "starter"
  },
  zyunce: {
    id: "zyunce",
    phrase: "要转车㗎",
    jp: "jiu3 zyun3 ce1 gaa3",
    meaning: "要转车的",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 3,
    tags: ["direction"],
    rarity: "starter"
  },
  hongloengfan: {
    id: "hongloengfan",
    phrase: "你行两分钟就去到",
    jp: "nei5 hong4 loeng5 fan1 zung1 zau6 heoi3 dou6",
    meaning: "你走两分钟就到",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["direction"],
    rarity: "starter"
  },
  saidin88: {
    id: "saidin88",
    phrase: "沙田坐八十八号车",
    jp: "saa1 din6 zo2 baat3 sap6 baat3 hou6 ce1",
    meaning: "沙田坐 88 号线",
    kind: "persuade",
    cost: 2,
    persuade: 9,
    tags: ["transport", "direction"],
    rarity: "starter"
  },
  jungbatdaatung: {
    id: "jungbatdaatung",
    phrase: "我用八达通",
    jp: "ngo5 jung6 baat3 daat6 tung1",
    meaning: "我用八达通（交通卡）",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["fare"],
    rarity: "starter"
  },
  siceigei: {
    id: "siceigei",
    phrase: "细车几钱？",
    jp: "sai3 ce1 gei2 cin2",
    meaning: "小巴多少钱？",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["fare"],
    rarity: "starter"
  },
  manlou: {
    id: "manlou",
    phrase: "唔该，问下路",
    jp: "m4 goi1 man6 haa5 lou6",
    meaning: "请问，想问一下路",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 3,
    tags: ["where", "confused"],
    rarity: "starter"
  },
  maangong: {
    id: "maangong",
    phrase: "我未识讲，唔该你慢慢讲",
    jp: "ngo5 mei6 sak1 gong2 m4 goi1 nei5 maan6 maan2 gong2",
    meaning: "我还不太会说，请你说慢一点",
    kind: "calm",
    cost: 1,
    calm: 6,
    tags: ["confused", "rush"],
    rarity: "starter"
  },
  gwozaam: {
    id: "gwozaam",
    phrase: "头先过咗站啦",
    jp: "tau4 sin1 gwo3 zo2 zaam3 laa1",
    meaning: "刚才坐过站了",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["transport"],
    rarity: "common"
  },
  zyunzuifaai: {
    id: "zyunzuifaai",
    phrase: "呢度转线最快",
    jp: "ni1 dou6 zyun3 lin6 zeoi3 faai3",
    meaning: "这里转线最快",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["direction", "transport"],
    rarity: "common"
  },
  meibaance: {
    id: "meibaance",
    phrase: "尾班车几时走？",
    jp: "mei5 baan1 ce1 gei2 si4 zau2",
    meaning: "末班车几点开？",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["time"],
    rarity: "common"
  },
  gonsigan: {
    id: "gonsigan",
    phrase: "我赶时间呀",
    jp: "ngo5 gon2 si4 gaan1 aa3",
    meaning: "我赶时间啊",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    calm: 3,
    tags: ["rush", "time"],
    rarity: "common"
  },
  mhaiban: {
    id: "mhaiban",
    phrase: "唔系呢班车",
    jp: "m4 hai6 ni1 baan1 ce1",
    meaning: "不是这班车",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["transport"],
    rarity: "common"
  },
  moungaangbei: {
    id: "moungaangbei",
    phrase: "我冇硬币",
    jp: "ngo5 mou5 ngaang6 bei6",
    meaning: "我没有硬币",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["fare"],
    rarity: "common"
  },
  hoisoeng: {
    id: "hoisoeng",
    phrase: "几时开船？",
    jp: "gei2 si4 hoi1 syun4",
    meaning: "渡轮几点开？",
    kind: "skill",
    cost: 0,
    draw: 1,
    energy: 1,
    tags: ["time", "transport"],
    rarity: "common"
  },
  saamgodis: {
    id: "saamgodis",
    phrase: "麻烦你，我哋三个去海洋公园",
    jp: "maa1 faan4 nei5 ngo5 dei6 saam1 go3 heoi3 hoi2 joeng4 gung1 jyun2",
    meaning: "麻烦你，我们三个去海洋公园",
    kind: "persuade",
    cost: 2,
    persuade: 16,
    tags: ["where", "transport"],
    rarity: "rare"
  }
};

export const CH2_STARTER = [
  "heobin",
  "hainei",
  "lokcebin",
  "zyunce",
  "hongloengfan",
  "saidin88",
  "jungbatdaatung",
  "siceigei",
  "manlou",
  "maangong"
];

export const CH2_NPCS: Record<string, NpcDef> = {
  mtrstaff: {
    id: "mtrstaff",
    name: "客务主任",
    img: "mtrstaff.png",
    bg: "bg/mtr.jpg",
    sign: "站台",
    target: 30,
    intro: "站务员企喺闸机旁边：「有咩可以帮到你？」",
    win: "小心月台空隙，祝你一路顺风！",
    intents: [
      {
        line: "你要去边度呀？",
        jp: "nei5 jiu3 heoi3 bin1 dou6 aa3",
        gloss: "你要去哪里呀？",
        label: "问目的地",
        loss: 5,
        need: "where"
      },
      {
        line: "转线喺下一站。",
        jp: "zyun3 lin6 hai2 haa6 jat1 zaam3 gaa3",
        gloss: "转线在下一站哦。",
        label: "讲转线",
        loss: 6,
        need: "direction"
      },
      {
        line: "尾班车十一点㗎。",
        jp: "mei5 baan1 ce1 sap6 jat1 dim2 gaa3",
        gloss: "末班车十一点。",
        label: "讲时间",
        loss: 5,
        need: "time"
      }
    ]
  },
  grandpa: {
    id: "grandpa",
    name: "指路伯父",
    img: "grandpa.png",
    bg: "bg/busstop.jpg",
    sign: "街口",
    target: 28,
    intro: "一位拿报纸嘅伯父行埋嚟，好似好热心的样子……但要你讲清楚先去帮你。",
    win: "后生仔肯开口讲粤语，好！直行就得！",
    intents: [
      {
        line: "你行边度去呀？",
        jp: "nei5 hong4 bin1 dou6 heoi3 aa3",
        gloss: "你去哪儿呀？",
        label: "问去向",
        loss: 5,
        need: "where"
      },
      {
        line: "你讲快咗，我听唔明㖎。",
        jp: "nei5 gong2 faai3 zo2, ngo5 teng1 m4 ming2 me1",
        gloss: "你说太快了，我听不明白。",
        label: "听唔明",
        loss: 5,
        need: "confused"
      },
      {
        line: "行出去，左转定右转呀？",
        jp: "hong4 ceot1 heoi3, zo2 dzun3 ding6 jau6 dzun3 aa3",
        gloss: "走出去，左转还是右转？",
        label: "问方位",
        loss: 6,
        need: "direction"
      }
    ]
  },
  minibus: {
    id: "minibus",
    name: "红色小巴司机",
    img: "minibus.png",
    bg: "bg/taxi.jpg",
    sign: "小巴",
    target: 34,
    intro: "司机师傅手揸方向盘，眼望倒后镜：「快啲啦，赶住开啦。」",
    win: "得！坐稳啦，几分钟就到！",
    intents: [
      {
        line: "车费八蚊，有冇硬币？",
        jp: "ce1 fai3 baat3 man1, jau5 mou5 ngaang6 bei6",
        gloss: "车费八块，有硬币吗？",
        label: "问零钱",
        loss: 7,
        need: "fare"
      },
      {
        line: "上唔上车呀？快啲啦！",
        jp: "soeng5 m4 soeng5 ce1 aa3? faai3 di1 laa1",
        gloss: "上不上车？快点啦！",
        label: "催促",
        loss: 6,
        need: "rush"
      },
      {
        line: "落车记得按钟呀喂！",
        jp: "lok6 ce1 ge3 dak1 on3 zung1 aa3 wai6",
        gloss: "下车记得按铃啊喂！",
        label: "吩咐落车",
        loss: 6,
        need: "where"
      }
    ]
  },
  buscaptain: {
    id: "buscaptain",
    name: "巴士车长",
    img: "buscaptain.png",
    bg: "bg/busstop.jpg",
    sign: "巴士",
    target: 55,
    boss: true,
    intro: "总站开蓬前一分钟，车长托住时间表望住你：上唔到呢班，就要等半个钟。",
    win: "好嘢！呢个乘客识听识讲，下次坐你坐最前排！",
    intents: [
      {
        line: "去边度落车呀？",
        jp: "heoi3 bin1 dou6 lok6 ce1 aa3",
        gloss: "去哪里下车？",
        label: "问落车",
        loss: 7,
        need: "where"
      },
      {
        line: "八达通拍咗未呀？",
        jp: "baat3 daat6 tung1 paak3 zo2 mei6 aa3",
        gloss: "八达通刷了没有？",
        label: "查拍卡",
        loss: 7,
        need: "fare"
      },
      {
        line: "呢班唔去迪士尼㗎！",
        jp: "ni1 baan1 m4 heoi3 dik1 sau4 lei4 gaa3",
        gloss: "这班不去迪士尼！",
        label: "查线路",
        loss: 8,
        need: "transport"
      },
      {
        line: "尾班喇，仲唔快手！",
        jp: "mei5 baan1 laa3, zung6 m4 fai3 sau2",
        gloss: "末班车了，还不快点！",
        label: "赶时间",
        loss: 7,
        need: "time"
      }
    ]
  }
};

export const CH2_EVENTS: EventDef[] = [
  {
    title: "失物登记",
    text: "你喺客务中心认领返部电话，姑娘教你多一句：「捡返嘢，开心。」",
    reward: "card"
  },
  {
    title: "赶上尾班渡轮",
    text: "你同渡轮开离岸嘅汽笛声赛跑，刚好企喺甲板度。海风一吹，嗰口气顺晒。",
    reward: "heal"
  },
  {
    title: "入钱机蚀咗张拾蚊",
    text: "增值机「咔」一声食咗你十蚊，然后先肯吐张票出嚟。",
    reward: "gold"
  }
];
