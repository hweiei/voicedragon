/** 第 5 章「办事·睇医生」内容表（纯数据）。重点：描述问题 · 因为／所以 · 比较。 */
import type { CardDef, EventDef, NpcDef, RelicDef } from "../types";

export const CH5_CARDS: Record<string, CardDef> = {
  ho2lung4: {
    id: "ho2lung4",
    phrase: "喉嚨痛，可唔可以睇下？",
    jp: "hou4 lung4 tung6 ho2 m4 ho2 tai2 haa5",
    meaning: "喉咙痛，可以看下吗？",
    kind: "calm",
    cost: 1,
    calm: 3,
    persuade: 4,
    tags: ["symptom", "polite"],
    rarity: "starter"
  },
  gaau1mun5: {
    id: "gaau1mun5",
    phrase: "咳到成晚瞓唔着",
    jp: "gaau1 dou3 cing4 mun5 fan3 m4 zoek3",
    meaning: "咳得整晚睡不着",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 3,
    tags: ["symptom"],
    rarity: "starter"
  },
  tau4faat1: {
    id: "tau4faat1",
    phrase: "我頭痛兼發燒",
    jp: "ngo5 tau4 tung3 gim1 faat3 siu1",
    meaning: "我头痛还发烧",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["symptom"],
    rarity: "starter"
  },
  jan1wai4: {
    id: "jan1wai4",
    phrase: "因為塞車，所以我遲咗",
    jp: "jan1 wai4 sak1 ce1 so2 ji5 ngo5 ci4 zo2",
    meaning: "因为堵车，所以我迟到了",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["reason"],
    rarity: "starter"
  },
  m5gaa3: {
    id: "m5gaa3",
    phrase: "我冇假，請唔到手",
    jp: "ngo5 m5 gaa3 cing2 m4 dou2 sau2",
    meaning: "我没有假，请不到手",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["reason"],
    rarity: "starter"
  },
  lo2zi2: {
    id: "lo2zi2",
    phrase: "可唔可以攞張紙俾我？",
    jp: "ho2 m4 ho2 lo2 zoeng1 zi2 bei2 ngo5",
    meaning: "可以拿张纸给我吗？",
    kind: "calm",
    cost: 1,
    calm: 3,
    persuade: 4,
    tags: ["docs"],
    rarity: "starter"
  },
  ji1sang1: {
    id: "ji1sang1",
    phrase: "醫生話凍嘢食唔得",
    jp: "ji1 sang1 waa6 dung3 je5 sik6 m4 dak1",
    meaning: "医生说冷的不能吃",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["symptom"],
    rarity: "starter"
  },
  ting1bei2: {
    id: "ting1bei2",
    phrase: "聽日比今日貴啲定平啲？",
    jp: "ting1 jat6 bei2 gam1 jat6 gwai3 di1 ting6 peng4 di1",
    meaning: "明天比今天贵点还是便宜点？",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["compare"],
    rarity: "starter"
  },
  daai6zi6: {
    id: "daai6zi6",
    phrase: "你寫大字少少，我睇唔清",
    jp: "nei5 se2 daai6 zi6 siu2 siu2 ngo5 tai2 m4 cing1",
    meaning: "你写大字一点，我看不清",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["polite", "confused"],
    rarity: "starter"
  },
  m4zung1: {
    id: "m4zung1",
    phrase: "唔使催，愈急愈亂",
    jp: "m4 sai2 ceoi1 jyu6 gap1 jyu6 lyun6",
    meaning: "别催，越急越乱",
    kind: "calm",
    cost: 1,
    calm: 6,
    tags: ["confused"],
    rarity: "common"
  },
  tou5ngo6: {
    id: "tou5ngo6",
    phrase: "肚餓就痛啲，食飯就冇",
    jp: "tou5 ngo6 zau6 tung3 di1 sik6 faan6 zau6 mou5",
    meaning: "饿了就痛些，吃饭就没事",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["compare", "symptom"],
    rarity: "common"
  },
  bei2jung6: {
    id: "bei2jung6",
    phrase: "呢隻藥比上次有用",
    jp: "ni1 zek3 joek6 bei2 soeng5 ci3 jau5 jung6",
    meaning: "这药比上次的有用",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["compare"],
    rarity: "common"
  },
  sin1waak6: {
    id: "sin1waak6",
    phrase: "先劃數，後至睇醫生",
    jp: "sin1 waak6 sou3 hau6 zi3 tai2 ji1 sang1",
    meaning: "先付款，才看医生",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["queue"],
    rarity: "starter"
  },
  sau1geoi3: {
    id: "sau1geoi3",
    phrase: "張收據有冇批咗？",
    jp: "zoeng1 sau1 geoi3 jau5 mou5 bei1 zo2",
    meaning: "收据盖了章没？",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["docs"],
    rarity: "common"
  },
  zing2ming6: {
    id: "zing2ming6",
    phrase: "張證明書有冇即場批？",
    jp: "zoeng1 zing3 ming6 syu1 jau5 mou5 zap1 coeng4 bei1",
    meaning: "证明能当场盖章吗？",
    kind: "skill",
    cost: 0,
    draw: 2,
    tags: ["docs"],
    rarity: "common"
  },
  gap1zuk1: {
    id: "gap1zuk1",
    phrase: "我唔係嗰個意思㖎",
    jp: "ngo5 m4 hai6 go2 de3 ji3 si1 me1",
    meaning: "我不是那个意思啦",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["polite", "confused"],
    rarity: "common"
  },
  gaa1bun2: {
    id: "gaa1bun2",
    phrase: "加個位可唔得？",
    jp: "gaa1 zo3 bun2 ho2 m4 dak1",
    meaning: "加个位置行不行？",
    kind: "persuade",
    cost: 2,
    persuade: 13,
    tags: ["queue"],
    rarity: "rare"
  },
  cing1co2: {
    id: "cing1co2",
    phrase: "你講清楚啲，大家先唔亂",
    jp: "nei5 gong2 cing1 co2 di1 daai6 gaa1 sin1 m4 lyun6",
    meaning: "你说清楚点，大家才不乱",
    kind: "calm",
    cost: 2,
    calm: 7,
    persuade: 8,
    tags: ["reason", "compare"],
    rarity: "rare"
  }
};

export const CH5_STARTER = [
  "ho2lung4",
  "gaau1mun5",
  "tau4faat1",
  "jan1wai4",
  "m5gaa3",
  "lo2zi2",
  "ji1sang1",
  "ting1bei2",
  "daai6zi6",
  "sin1waak6"
];

export const CH5_NPCS: Record<string, NpcDef> = {
  doctor: {
    id: "doctor",
    name: "西医陈医生",
    img: "doctor.png",
    bg: "bg/clinic.jpg",
    sign: "診所",
    target: 82,
    intro: "陳醫生推推眼鏡：「邊度唔舒服？慢慢講，我喺度。」",
    win: "得！照我單捉藥，兩日好返七七八。",
    intents: [
      {
        line: "你邊度唔舒服先？",
        jp: "nei5 bin1 dou6 m4 syu1 fuk6 sin1",
        gloss: "你哪里不舒服？",
        label: "問病徵",
        loss: 12,
        need: "symptom"
      },
      {
        line: "幾時開始㗎？",
        jp: "gei2 si4 hoi1 ci2 gaa3",
        gloss: "什么时候开始的？",
        label: "問緣由",
        loss: 11,
        need: "reason"
      },
      {
        line: "有預約單未呀？",
        jp: "jau5 jyu6 yok6 daan1 mei6 aa3",
        gloss: "有预约单吗？",
        label: "問單據",
        loss: 11,
        need: "docs"
      }
    ]
  },
  counter: {
    id: "counter",
    name: "收銀芳姐",
    img: "counter.png",
    bg: "bg/clinic.jpg",
    sign: "收銀",
    target: 74,
    intro: "芳姐隔住玻璃窓彈彈筆：「先搞清楚程序，唔好喺度嘈。」",
    win: "得！下次識路數喇，早去早回。",
    intents: [
      {
        line: "先劃數，後至入面。",
        jp: "sin1 waak6 sou3 hau6 zi3 yap6 min6",
        gloss: "先付款，才进去。",
        label: "講程序",
        loss: 11,
        need: "queue"
      },
      {
        line: "收據使唔要印㗎？",
        jp: "sau1 geoi3 sai2 m4 jiu3 jan3 gaa3",
        gloss: "收据要不要盖章？",
        label: "問收據",
        loss: 10,
        need: "docs"
      },
      {
        line: "證明書要即場批㗎。",
        jp: "zing3 ming6 syu1 jiu3 zap1 coeng4 bei1 gaa3",
        gloss: "证明书要当场盖章。",
        label: "講規矩",
        loss: 11,
        need: "docs"
      }
    ]
  },
  ticket: {
    id: "ticket",
    name: "飛票強哥",
    img: "ticket.png",
    bg: "bg/clinic.jpg",
    sign: "籌辦",
    target: 70,
    intro: "派號嘅強哥摇摇手中飛：「而家亂糟糟，你睇點算好？」",
    win: "搞掂！你喺前面第三個，就輪到你。",
    intents: [
      {
        line: "嗰個號去咗邊？",
        jp: "go2 de3 hou6 heoi3 zo2 bin1",
        gloss: "那个号去哪了？",
        label: "問號碼",
        loss: 10,
        need: "queue"
      },
      {
        line: "你排喺我前面定後面？",
        jp: "nei5 paai4 hai2 ngo5 cin4 min6 ting6 hau6 min6",
        gloss: "你排在我前面还是后面？",
        label: "論前後",
        loss: 11,
        need: "compare"
      },
      {
        line: "加唔到飛，規矩係咁。",
        jp: "gaa1 m4 dou2 fei1 gwai1 geoi2 hai6 gam2",
        gloss: "加不了号，规矩如此。",
        label: "講原因",
        loss: 12,
        need: "reason"
      }
    ]
  },
  yuen: {
    id: "yuen",
    name: "院長芬姑娘",
    img: "yuen.png",
    bg: "bg/clinic.jpg",
    sign: "院長辦",
    target: 120,
    boss: true,
    intro: "院長辦公室，芬姑娘雙手按實夾板望住你：「有乜，講啦。」",
    win: "好！你講得清楚，我哋即日改。",
    intents: [
      {
        line: "我哋診所唔興插隊。",
        jp: "ngo5 dei6 zam3 so2 m4 hing1 caap3 deoi6",
        gloss: "我们诊所不兴插队。",
        label: "講規矩",
        loss: 13,
        need: "queue"
      },
      {
        line: "你個病歷寫到好亂。",
        jp: "nei5 de3 beng6 lek6 se2 dou3 hou2 lyun6",
        gloss: "你的病历写得很乱。",
        label: "彈病歷",
        loss: 14,
        need: "docs"
      },
      {
        line: "貴定平，自己揀啦。",
        jp: "gwai3 ting6 peng4 zi6 gei2 gaan2 laa1",
        gloss: "贵还是便宜，自己选吧。",
        label: "論貴平",
        loss: 13,
        need: "compare"
      },
      {
        line: "有乜意見，留低講。",
        jp: "jau5 mat1 ji3 gin3 lau4 hai4 gong2",
        gloss: "有什么意见，留下来说。",
        label: "收意見",
        loss: 14,
        need: "reason"
      }
    ]
  }
};

/** 办事章语法密码：因／比 */
export const CH5_RELICS: Record<string, RelicDef> = {
  jan2relic: {
    id: "jan2relic",
    glyph: "因",
    name: "因＝有來由",
    desc: "「因為」講原因唔係唔講理。句子含「因」，稳住 +2。"
  },
  bei2relic: {
    id: "bei2relic",
    glyph: "比",
    name: "比＝有參照",
    desc: "「A 比 B…」一比就清楚。句子含「比」，说服 +2。"
  }
};

export const CH5_EVENTS: EventDef[] = [
  {
    title: "義診日",
    text: "今日診所義診，陳醫生免費幫你睇咗兩句，仲送咗包傷風藥。",
    reward: "card"
  },
  {
    title: "完診送熱茶",
    text: "芳姐喺收銀枱面擺住壺熱茶，斟一杯俾你，個人即刻鬆咗啲。",
    reward: "heal"
  },
  {
    title: "隔籬漢讓位",
    text: "隔籬個漢起身執位俾你：「你病緊，你坐。」你趁多兩分鐘寫低想問嘅嘢。",
    reward: "gold"
  }
];
