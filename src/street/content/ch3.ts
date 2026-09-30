/** 第 3 章「唐楼·邻里」内容表（纯数据）。重点：请求与投诉 · 体貌助词 咗／紧。 */
import type { CardDef, EventDef, NpcDef, RelicDef } from "../types";

export const CH3_CARDS: Record<string, CardDef> = {
  cankau: {
    id: "cankau",
    phrase: "可唔可以帮手？",
    jp: "ho2 m4 ho2 bong1 sau2",
    meaning: "能不能帮个忙？",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["help"],
    rarity: "starter"
  },
  mgoibong: {
    id: "mgoibong",
    phrase: "唔该帮我一把",
    jp: "m4 goi1 bong4 ngo5 jat1 baa2",
    meaning: "请帮我一把",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["help"],
    rarity: "starter"
  },
  zebou6syun1: {
    id: "zebou6syun1",
    phrase: "可唔可以借阵部钻？",
    jp: "ho2 m4 ho2 ze3 zan6 bou6 syun1",
    meaning: "能借一下电钻吗？",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["borrow"],
    rarity: "starter"
  },
  saiseng: {
    id: "saiseng",
    phrase: "细声啲啦，有人瞓紧",
    jp: "sai3 seng1 di1 laa1 jau5 jan4 fan3 gan2",
    meaning: "小声点啦，有人在睡觉",
    kind: "calm",
    cost: 1,
    calm: 6,
    tags: ["noise"],
    rarity: "starter"
  },
  ngaam1ngaam1: {
    id: "ngaam1ngaam1",
    phrase: "我啱啱返嚟㗎",
    jp: "ngo5 ngaam1 ngaam1 faan1 lai4 gaa3",
    meaning: "我刚回来的",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["sorry"],
    rarity: "starter"
  },
  bungei: {
    id: "bungei",
    phrase: "部机坏咗好耐㖎",
    jp: "bou6 ge1 waai6 zo2 hou2 noi3 me1",
    meaning: "机器坏了好久啦",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["repair"],
    rarity: "starter"
  },
  gaautin: {
    id: "gaautin",
    phrase: "搞掂咗喇，唔使惊",
    jp: "gaau2 din6 zo2 laa3 m4 sai2 geng1",
    meaning: "搞定了，别担心",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 3,
    tags: ["confused"],
    rarity: "starter"
  },
  gaau1bei2: {
    id: "gaau1bei2",
    phrase: "交畀我啦",
    jp: "gaau1 bei2 ngo5 laa1",
    meaning: "交给我吧",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["help"],
    rarity: "starter"
  },
  jam2caa4: {
    id: "jam2caa4",
    phrase: "得闲饮杯茶先啦",
    jp: "dak1 haan4 jam2 bui1 caa4 sin1 laa1",
    meaning: "有空先喝杯茶吧",
    kind: "calm",
    cost: 1,
    calm: 3,
    persuade: 3,
    tags: ["order"],
    rarity: "starter"
  },
  tau4sin1: {
    id: "tau4sin1",
    phrase: "头先唔系我整㗎",
    jp: "tau4 sin1 m4 hai6 ngo5 zing2 gaa3",
    meaning: "刚才不是我弄的",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["sorry", "confused"],
    rarity: "starter"
  },
  cing1jat6: {
    id: "cing1jat6",
    phrase: "成日咁嘈，顶唔顺",
    jp: "cing4 jat1 gam3 cou4 deng2 m4 seon6",
    meaning: "天天这么吵，受不了",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["noise"],
    rarity: "common"
  },
  zap1hou2: {
    id: "zap1hou2",
    phrase: "帮你执好啲啦",
    jp: "bong4 nei5 zap1 hou2 di1 laa1",
    meaning: "帮你收拾好了",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["help"],
    rarity: "common"
  },
  bou1waan4: {
    id: "bou1waan4",
    phrase: "波还畀你㖎",
    jp: "bo1 waan4 bei2 nei5 me1",
    meaning: "球还给你啦",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["borrow"],
    rarity: "common"
  },
  haaci3je6: {
    id: "haaci3je6",
    phrase: "下次唔好咁夜啦",
    jp: "haa6 ci3 m4 hou2 gam3 je6 laa1",
    meaning: "下次别这么晚啦",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["noise", "rush"],
    rarity: "common"
  },
  tintoim4: {
    id: "tintoim4",
    phrase: "天台唔畀摆嘢",
    jp: "tin1 toi2 m4 bei2 baai2 je5 gaa3",
    meaning: "天台不能放东西的",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["repair"],
    rarity: "common"
  },
  seoifai3: {
    id: "seoifai3",
    phrase: "水费我交咗㗎",
    jp: "seoi2 fai3 ngo5 gaau1 zo2 gaa3",
    meaning: "水费我交过了",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["bill"],
    rarity: "common"
  },
  jau5je5: {
    id: "jau5je5",
    phrase: "有嘢叫我㖎",
    jp: "jau5 je5 giu3 ngo5 me1",
    meaning: "有事叫我啦",
    kind: "calm",
    cost: 1,
    calm: 3,
    persuade: 4,
    tags: ["help"],
    rarity: "common"
  },
  gaap3cin2: {
    id: "gaap3cin2",
    phrase: "大家夹啲钱整部机啦",
    jp: "daai6 gaa1 gaap3 di1 cin2 zing2 bou6 ge1 laa1",
    meaning: "大家凑点钱修机器吧",
    kind: "persuade",
    cost: 2,
    persuade: 15,
    tags: ["help", "bill"],
    rarity: "rare"
  }
};

export const CH3_STARTER = [
  "cankau",
  "mgoibong",
  "zebou6syun1",
  "saiseng",
  "ngaam1ngaam1",
  "bungei",
  "gaautin",
  "gaau1bei2",
  "jam2caa4",
  "tau4sin1"
];

export const CH3_NPCS: Record<string, NpcDef> = {
  neibour: {
    id: "neibour",
    name: "隔篱陈伯",
    img: "neibour.png",
    bg: "bg/tonglau.jpg",
    sign: "隔篱",
    target: 60,
    intro: "陈伯企喺门口摇住扇：「后生仔，你嚟㗎？」",
    win: "得你咁讲，把镬气都消晒！",
    intents: [
      {
        line: "部钻用一日就还，得唔得？",
        jp: "bou6 syun1 jung6 jat1 zik6 zau6 waan4 dak1 m4 dak1",
        gloss: "电钻用一天就还，行不行？",
        label: "借嘢",
        loss: 11,
        need: "borrow"
      },
      {
        line: "夜晚打边个波咁嘈呀！",
        jp: "je6 maan5 daa2 bin1 go3 bo1 gam3 cou4 aa3",
        gloss: "晚上打什么球这么吵！",
        label: "投诉噪音",
        loss: 12,
        need: "noise"
      },
      {
        line: "帮我抬张梳化落楼好唔好？",
        jp: "bong4 ngo5 toi4 zoeng1 so1 faa4 lok6 lau4 hou2 m4 hou2",
        gloss: "帮我搬张沙发下楼好不好？",
        label: "请托",
        loss: 10,
        need: "help"
      }
    ]
  },
  kid: {
    id: "kid",
    name: "楼梯仔",
    img: "kid.png",
    bg: "bg/tonglau.jpg",
    sign: "楼梯",
    target: 54,
    intro: "一个细路哥抱住只波，眼白白望住你：「咦，你系我哋栋楼㗎？」",
    win: "哗，你咁好人！下次帮你拍波！",
    intents: [
      {
        line: "波唔小心入咗你屋企㖎…",
        jp: "bo1 m4 siu1 sam1 jap6 zo2 nei5 uk1 kei2 me1",
        gloss: "球不小心飞进你家了……",
        label: "闯祸",
        loss: 9,
        need: "sorry"
      },
      {
        line: "可唔可以帮我执返只波？",
        jp: "ho2 m4 ho2 bong4 ngo5 zap1 faan1 zek3 bo1",
        gloss: "能不能帮我把球捡回来？",
        label: "央求",
        loss: 10,
        need: "help"
      },
      {
        line: "你识唔识整呢啲嘢？",
        jp: "nei5 sak1 m4 sak1 zing2 ni1 di1 ge3 me1",
        gloss: "你会不会修这些东西呀？",
        label: "询问",
        loss: 9,
        need: "repair"
      }
    ]
  },
  faan: {
    id: "faan",
    name: "唐楼芳姐",
    img: "faan.png",
    bg: "bg/tonglau.jpg",
    sign: "闸门",
    target: 64,
    intro: "芳姐喺闸门度睇住本薄，见到你即係举起支笔：「就等紧你。」",
    win: "搞掂！你系我见过最识做嘅租客！",
    intents: [
      {
        line: "水费到期未交㖎！",
        jp: "seoi2 fai3 dou6 kei4 m4 gaau1 zo2 me1",
        gloss: "水费到期没交了！",
        label: "追数",
        loss: 12,
        need: "bill"
      },
      {
        line: "天台堆满晒嘢，快执走！",
        jp: "tin1 toi2 deoi1 mun5 saai3 je5 faai3 di1 zap1 zau2",
        gloss: "天台堆满东西，快点清理！",
        label: "投诉",
        loss: 11,
        need: "repair"
      },
      {
        line: "三楼渠塞咗，边个帮手？",
        jp: "saam1 lau2 cuk1 sak1 zo2 bin1 go3 bong1 sau2",
        gloss: "三楼下水道堵了，谁来帮忙？",
        label: "求援",
        loss: 11,
        need: "help"
      }
    ]
  },
  chair: {
    id: "chair",
    name: "法团强叔",
    img: "chair.png",
    bg: "bg/rooftop.jpg",
    sign: "天台",
    target: 98,
    boss: true,
    intro: "天台业主大会，强叔攥住一叠投诉信企喺水缸旁边：「今日讲清楚每单数！」",
    win: "得你哋呢啲街坊，唐楼有运行！下次大会你坐第一排！",
    intents: [
      {
        line: "夜晚黑吵到瞓唔着，你话点算！",
        jp: "je6 maan5 hak1 caau2 dou3 fan3 m4 zeok3 nei5 gong2 dim2 syun3",
        gloss: "大晚上吵得睡不着，你说怎么办！",
        label: "噪音发难",
        loss: 13,
        need: "noise"
      },
      {
        line: "维修基金你供咗未呀？",
        jp: "wai4 sou1 gam1 gaan1 nei5 gung3 zo2 mei6 aa3",
        gloss: "维修基金你交了吗？",
        label: "追款",
        loss: 13,
        need: "bill"
      },
      {
        line: "业主大会嚟唔嚟㗎？",
        jp: "jau5 sip6 daai6 wui6 lai4 m4 lai4 gaa3",
        gloss: "业主大会来不来？",
        label: "问出席",
        loss: 11,
        need: "seats"
      },
      {
        line: "新电梯几时夹得成钱？",
        jp: "san1 dim6 lau5 gei2 si4 gaap3 dak1 sing4 cin2",
        gloss: "新电梯什么时候筹得到钱？",
        label: "问进度",
        loss: 12,
        need: "help"
      }
    ]
  }
};

/** 普粤密码卡（第三章语法点：体貌助词） */
export const CH3_RELICS: Record<string, RelicDef> = {
  zorelic: {
    id: "zorelic",
    glyph: "咗",
    name: "咗＝完成",
    desc: "「咗」表示做完咗。句子含「咗」，说服 +2。"
  },
  ganrelic: {
    id: "ganrelic",
    glyph: "紧",
    name: "紧＝进行",
    desc: "「紧」表示正喺做。句子含「紧」，稳住 +2。"
  }
};

export const CH3_EVENTS: EventDef[] = [
  {
    title: "麻将三缺一",
    text: "地下大堂四阿伯打麻将三缺一，拉你顶脚，你随手糊咗张自摸。",
    reward: "card"
  },
  {
    title: "通渠义举",
    text: "你帮炳叔通咗成条渠，佢执咗罐暖嘅柠檬茶俾你，话下次成日都找你。",
    reward: "gold"
  },
  {
    title: "天台凉风",
    text: "上天台帮邻居收衫，遇到陈伯递过嚟一个月饼：「食啲嘢，唔使赶。」",
    reward: "heal"
  }
];
