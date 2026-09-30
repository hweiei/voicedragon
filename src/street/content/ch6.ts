/** 第 6 章「节庆·饮宴」内容表（纯数据）。重点：祝福语 · 情绪 · 人情世故。 */
import type { CardDef, EventDef, NpcDef, RelicDef } from "../types";

export const CH6_CARDS: Record<string, CardDef> = {
  koi1sun1: {
    id: "koi1sun1",
    phrase: "恭喜恭喜，新年快樂",
    jp: "hung1 hei2 hung1 hei2 san1 nin4 faai3 lok6",
    meaning: "恭喜恭喜，新年快乐",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["bless"],
    rarity: "starter"
  },
  tai2tai2: {
    id: "tai2tai2",
    phrase: "太太，你食多啲嘢",
    jp: "taai3 taai2 nei5 sik6 do1 di1 je5",
    meaning: "太太，你多吃点东西",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 3,
    tags: ["eat", "polite"],
    rarity: "starter"
  },
  hou2ji6: {
    id: "hou2ji6",
    phrase: "身體健康，最緊要啦",
    jp: "san1 tai2 gin6 hong1 zoei3 gan2 jiu6 laa1",
    meaning: "身体健康，最重要啦",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["bless"],
    rarity: "starter"
  },
  bing5siu4: {
    id: "bing5siu4",
    phrase: "好耐冇見，你好嗎？",
    jp: "hou2 noi6 mou5 gin3 nei5 hou2 maa3",
    meaning: "好久不见，你好吗？",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["chat"],
    rarity: "starter"
  },
  zik1sau2: {
    id: "zik1sau2",
    phrase: "你煮嘢真一絕，我想添碗",
    jp: "nei5 zy2 je5 zan1 jat1 zyut6 ngo5 soeng2 tim4 wun2",
    meaning: "你煮的菜一流，我想添饭",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["eat"],
    rarity: "starter"
  },
  jat1bun1: {
    id: "jat1bun1",
    phrase: "一杯清茶，心意到就得",
    jp: "jat1 bui1 cing1 caa4 sam1 ji3 dou3 zau6 dak1",
    meaning: "一杯清茶，心意到了就好",
    kind: "calm",
    cost: 1,
    calm: 5,
    persuade: 3,
    tags: ["polite", "gift"],
    rarity: "starter"
  },
  m4hak1: {
    id: "m4hak1",
    phrase: "唔使唔客氣，先至係自己人",
    jp: "m4 sai2 m4 haak3 hei3 sin1 zi3 hai6 zi6 gei2 jan4",
    meaning: "别客气，才是自己人",
    kind: "calm",
    cost: 1,
    calm: 6,
    tags: ["polite"],
    rarity: "starter"
  },
  tai2sai2: {
    id: "tai2sai2",
    phrase: "啲心意，你哋唔好推",
    jp: "di1 sam1 ji3 nei5 dei6 m4 hou2 teoi1",
    meaning: "这点心意，你们别推",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["gift"],
    rarity: "starter"
  },
  sau6m4kam4: {
    id: "sau6m4kam4",
    phrase: "細個先收得，大個就唔敢",
    jp: "sai3 go3 sin1 sau1 dak1 daai6 go3 zau6 m4 gam2",
    meaning: "小时候才敢收，长大了不敢",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["gift", "polite"],
    rarity: "starter"
  },
  ngo5ngo5: {
    id: "ngo5ngo5",
    phrase: "醒獅到，大家齊歡笑",
    jp: "sing2 si1 dou3 daai6 gaa1 cai4 fun1 siu3",
    meaning: "醒狮到，大家一起欢笑",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["bless", "emo"],
    rarity: "starter"
  },
  saai1ngo5: {
    id: "saai1ngo5",
    phrase: "今晚真開心，有說有笑",
    jp: "gam1 maan5 zan1 hoi1 sam1 jau5 syut3 jau5 siu3",
    meaning: "今晚真开心，有说有笑",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["emo"],
    rarity: "common"
  },
  jau1seng1: {
    id: "jau1seng1",
    phrase: "有少少唔捨得，下次再聚",
    jp: "jau5 siu2 siu2 m4 se2 dak1 haa6 ci3 zoi3 zyun6",
    meaning: "有点舍不得，下次再聚",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["emo", "chat"],
    rarity: "common"
  },
  tung4sai2: {
    id: "tung4sai2",
    phrase: "做嘢你唔使比心機",
    jp: "zou6 je5 nei5 m4 sai2 bei2 sam1 gei1",
    meaning: "做事你不用费心机",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["chat"],
    rarity: "common"
  },
  mun4cyun4: {
    id: "mun4cyun4",
    phrase: "飲宴最齊人，滿座晒㗎",
    jp: "jam2 jin3 zoei3 cai4 jan4 mun5 zo3 saai3 gaa3",
    meaning: "宴席最齐人，满座了",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["emo", "eat"],
    rarity: "common"
  },
  gai2zeng6: {
    id: "gai2zeng6",
    phrase: "話得唔好，大家體會下",
    jp: "waa6 dak1 m4 hou2 daai6 gaa1 tai2 wui6 haa5",
    meaning: "说得不好，大家体谅下",
    kind: "calm",
    cost: 1,
    calm: 6,
    tags: ["polite"],
    rarity: "common"
  },
  ping2bun6: {
    id: "ping2bun6",
    phrase: "後生仔手勢比我哋好",
    jp: "au6 saang1 zai2 sau2 sai3 bei2 ngo5 dei6 hou2",
    meaning: "年轻人手法比我们好",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["chat"],
    rarity: "common"
  },
  zaam1jan4: {
    id: "zaam1jan4",
    phrase: "祝你家發財，日日有歡喜",
    jp: "zuk1 nei5 gaa1 faat3 coi4 jat6 jat6 jau5 fun1 hei2",
    meaning: "祝你家发财，天天有欢喜",
    kind: "persuade",
    cost: 2,
    persuade: 15,
    tags: ["bless"],
    rarity: "rare"
  },
  cing4sau2: {
    id: "cing4sau2",
    phrase: "呢一餐人情，我記實咗",
    jp: "ni1 jat1 caan1 jan4 cing4 ngo5 gei3 sat6 zo2",
    meaning: "这一餐人情，我记实了",
    kind: "calm",
    cost: 2,
    calm: 7,
    persuade: 8,
    tags: ["emo", "chat"],
    rarity: "rare"
  }
};

export const CH6_STARTER = [
  "koi1sun1",
  "tai2tai2",
  "hou2ji6",
  "bing5siu4",
  "zik1sau2",
  "jat1bun1",
  "m4hak1",
  "tai2sai2",
  "sau6m4kam4",
  "ngo5ngo5"
];

export const CH6_NPCS: Record<string, NpcDef> = {
  mc: {
    id: "mc",
    name: "司儀全叔",
    img: "mc.png",
    bg: "bg/banquet.jpg",
    sign: "司儀",
    target: 78,
    intro: "全叔執咪行埋嚟：「後生，陣間到你講兩句啫。」",
    win: "好口彩！主家聽咗都笑見牙唔見眼。",
    intents: [
      {
        line: "吉慶話，你講兩句先？",
        jp: "gat1 hing3 waa6 nei5 gong2 loeng5 gei2 sin1",
        gloss: "吉祥话，你先说两句？",
        label: "討吉利",
        loss: 13,
        need: "bless"
      },
      {
        line: "大家等緊邊個開聲？",
        jp: "daai6 gaa1 dang2 gan2 bin1 go3 hoi1 seng1",
        gloss: "大家在等谁开口？",
        label: "冷場",
        loss: 12,
        need: "chat"
      },
      {
        line: "飲多杯係唔係先？",
        jp: "jam2 do1 bui1 hai6 m4 hai6 sin1",
        gloss: "是不是再多喝一杯？",
        label: "勸飲",
        loss: 12,
        need: "eat"
      }
    ]
  },
  cook2: {
    id: "cook2",
    name: "掌勺英姐",
    img: "cook2.png",
    bg: "bg/banquet.jpg",
    sign: "廚房",
    target: 72,
    intro: "英姐由廚房探半個身：「試啖湯話畀我聽，啱唔啱？」",
    win: "得！你話好，即係今晚晒足面。",
    intents: [
      {
        line: "啖湯够唔夠味？",
        jp: "daam6 tong1 gau3 m4 gau3 mei6",
        gloss: "这汤够不够味？",
        label: "問口味",
        loss: 11,
        need: "eat"
      },
      {
        line: "係唔係淡咗啲？",
        jp: "hai6 m4 hai6 daam6 zo2 di1 gaa3",
        gloss: "是不是淡了点？",
        label: "心虛",
        loss: 10,
        need: "polite"
      }
    ]
  },
  lion: {
    id: "lion",
    name: "醒獅阿威",
    img: "lion.png",
    bg: "bg/banquet.jpg",
    sign: "醒獅",
    target: 80,
    intro: "鼓樂停下，阿威舉起獅頭：「接唔接彩頭？一句話啫！」",
    win: "旺！你呢句吉利，我哋記住㗎。",
    intents: [
      {
        line: "鑼鼓響，人人企起身。",
        jp: "lo4 gu2 hoeng2 jan4 jan4 kei2 san1 san1",
        gloss: "锣鼓响，人人站起来。",
        label: "造勢",
        loss: 12,
        need: "emo"
      },
      {
        line: "門口接個彩，去定留？",
        jp: "mun4 hau2 zip3 go3 coi2 heoi3 ting6 lau4",
        gloss: "门口接个彩头，去还是留？",
        label: "問心意",
        loss: 12,
        need: "bless"
      }
    ]
  },
  saicing: {
    id: "saicing",
    name: "主家賽靚婆婆",
    img: "saicing.png",
    bg: "bg/banquet.jpg",
    sign: "主家",
    target: 124,
    boss: true,
    intro: "賽靚婆婆企定喺圓枱主位：「今晚辛苦你哋，來，坐低講。」",
    win: "呢個後生仔，識食識講識體面！",
    intents: [
      {
        line: "飲宴最講舌頭甜。",
        jp: "jam2 jin3 zoei3 gaau2 sit3 tau4 tim4",
        gloss: "宴席最会说话。",
        label: "考口彩",
        loss: 14,
        need: "bless"
      },
      {
        line: "食多啲，唔好同我客氣。",
        jp: "sik6 do1 di1 m4 hou2 tung4 ngo5 haak3 hei3",
        gloss: "多吃点，别跟我客气。",
        label: "勸食",
        loss: 15,
        need: "eat"
      },
      {
        line: "呢封利是，派畀細路。",
        jp: "ni1 fung1 lei6 si6 paai3 bei2 sai3 lou4",
        gloss: "这封利是，发给小孩。",
        label: "派利是",
        loss: 14,
        need: "gift"
      },
      {
        line: "下次幾時再聚㗎？",
        jp: "haa6 ci3 gei2 si4 zoi3 zyun6 gaa3",
        gloss: "下次什么时候再聚？",
        label: "問下期",
        loss: 15,
        need: "chat"
      }
    ]
  }
};

/** 节庆章语法密码：句末「嘛／哋」语气 */
export const CH6_RELICS: Record<string, RelicDef> = {
  maa2relic: {
    id: "maa2relic",
    glyph: "嘛",
    name: "嘛＝軟口吻",
    desc: "句尾帶「嘛」，問話唔兇。句子含「嗎/嘛」，稳住 +2。"
  },
  laa1relic: {
    id: "laa1relic",
    glyph: "啦",
    name: "啦＝落定音",
    desc: "句尾一個「啦」，講完唔冚巴。句子含「啦」，说服 +2。"
  }
};

export const CH6_EVENTS: EventDef[] = [
  {
    title: "封利是",
    text: "婆婆派完後生派，你接咗一封，利是封厚過往常。",
    reward: "gold"
  },
  {
    title: "打包剩餸",
    text: "食唔晒，英姐話：「打包返屋企加餸。」你肚同眼都飽晒。",
    reward: "heal"
  },
  {
    title: "獅入定宅",
    text: "醒獅行入你嗰邊，咬咗啖生菜頭俾你，全場拍晒掌。",
    reward: "card"
  }
];
