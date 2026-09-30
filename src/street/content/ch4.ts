/** 第 4 章「写字楼·搵工」内容表（纯数据）。重点：礼貌用语 · 日程 · 可以／识／要。 */
import type { CardDef, EventDef, NpcDef, RelicDef } from "../types";

export const CH4_CARDS: Record<string, CardDef> = {
  mingsan: {
    id: "mingsan",
    phrase: "早晨，我系嚟面试㗎",
    jp: "zou2 san4 ngo5 hai6 lai4 min6 sau3 gaa3",
    meaning: "早上好，我是来面试的",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["polite"],
    rarity: "starter"
  },
  mgoineoi: {
    id: "mgoineoi",
    phrase: "麻烦晒，唔该你",
    jp: "maa1 faan6 saai3 m4 goi1 nei5",
    meaning: "麻烦你了，多谢",
    kind: "calm",
    cost: 1,
    calm: 6,
    tags: ["polite"],
    rarity: "starter"
  },
  sakdak1: {
    id: "sakdak1",
    phrase: "我识得处理报表",
    jp: "ngo5 sak1 dak1 cyu5 lei5 bou2 biu3",
    meaning: "我会处理报表",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["skill"],
    rarity: "starter"
  },
  gaapsi4: {
    id: "gaapsi4",
    phrase: "夹下时间得唔得？",
    jp: "gaap3 haa5 si4 gaan1 dak1 m4 dak1",
    meaning: "对一下时间行不行？",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["schedule"],
    rarity: "starter"
  },
  wunsoeng5: {
    id: "wunsoeng5",
    phrase: "可唔可以听日先返？",
    jp: "ho2 m4 ho2 han1 jat6 sin1 faan1",
    meaning: "可以明天再来吗？",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 3,
    tags: ["schedule"],
    rarity: "starter"
  },
  geidonim2: {
    id: "geidonim2",
    phrase: "我有几多日假㗎？",
    jp: "ngo5 jau5 gei2 do1 jat6 gaa3 gaa3",
    meaning: "我有几天假期？",
    kind: "skill",
    cost: 0,
    draw: 2,
    tags: ["schedule"],
    rarity: "starter"
  },
  dim2soeng5: {
    id: "dim2soeng5",
    phrase: "我几点开始上班好？",
    jp: "ngo5 gei2 dim2 hoi1 ci2 soeng1 baan1 hou2",
    meaning: "我几点开始上班好？",
    kind: "calm",
    cost: 1,
    calm: 3,
    persuade: 4,
    tags: ["schedule"],
    rarity: "starter"
  },
  m4haai3: {
    id: "m4haai3",
    phrase: "唔使客气，大家同事",
    jp: "m4 sai2 haai3 hei3 daai6 gaa1 tung4 si5",
    meaning: "别客气，大家都是同事",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 3,
    tags: ["polite"],
    rarity: "starter"
  },
  jau5seoi1: {
    id: "jau5seoi1",
    phrase: "有冇需要帮手？",
    jp: "jau5 mou5 seoi1 jiu3 bong1 sau2",
    meaning: "有需要帮忙吗？",
    kind: "persuade",
    cost: 1,
    persuade: 5,
    tags: ["skill", "help"],
    rarity: "starter"
  },
  tai2fan6: {
    id: "tai2fan6",
    phrase: "得闲帮你睇下份文件",
    jp: "dak1 haan4 bong4 nei5 tai2 haa5 fan6 man4 gin2",
    meaning: "有空帮你看看那份文件",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 3,
    tags: ["docs"],
    rarity: "starter"
  },
  dang6jat6: {
    id: "dang6jat6",
    phrase: "等阵，我睇下日历先",
    jp: "dang2 zan6 ngo5 tai2 haa5 jat6 nang6 sin1",
    meaning: "等等，我先看一下日历",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["schedule"],
    rarity: "common"
  },
  zing3geoi3: {
    id: "zing3geoi3",
    phrase: "证据同文件我带咗㗎",
    jp: "zing3 geoi3 tung4 man4 gin2 ngo5 daai3 zo2 gaa3",
    meaning: "证据和文件我带来了",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["docs"],
    rarity: "common"
  },
  zyun3zing3: {
    id: "zyun3zing3",
    phrase: "我想转做正职",
    jp: "ngo5 soeng2 zyun2 zou6 zing3 zik1",
    meaning: "我想转为正职",
    kind: "persuade",
    cost: 1,
    persuade: 7,
    tags: ["skill"],
    rarity: "common"
  },
  hei2caau2: {
    id: "hei2caau2",
    phrase: "呢份系我起草㗎",
    jp: "ni1 fan6 hai6 ngo5 hei2 caau2 gaa3",
    meaning: "这份是我起草的",
    kind: "calm",
    cost: 1,
    calm: 4,
    persuade: 4,
    tags: ["docs"],
    rarity: "common"
  },
  ceot1loeng4: {
    id: "ceot1loeng4",
    phrase: "出粮日系星期几㗎？",
    jp: "ceot1 loeng4 jat6 hai6 sing1 kei4 gei2 gaa3",
    meaning: "发薪日是星期几？",
    kind: "persuade",
    cost: 1,
    persuade: 6,
    tags: ["schedule"],
    rarity: "common"
  },
  m4gam3ji3: {
    id: "m4gam3ji3",
    phrase: "唔系咁意思㗎",
    jp: "m4 hai6 gam3 ji3 si1 gaa3",
    meaning: "不是这个意思啦",
    kind: "calm",
    cost: 1,
    calm: 5,
    tags: ["polite", "confused"],
    rarity: "common"
  },
  sik1sin1: {
    id: "sik1sin1",
    phrase: "我帮你引荐，包喺我",
    jp: "ngo5 bong4 nei5 jan5 gin6 baau1 hei2 ngo5 san1",
    meaning: "我帮你引荐，包在我身上",
    kind: "persuade",
    cost: 2,
    persuade: 15,
    tags: ["skill", "polite"],
    rarity: "rare"
  },
  gaau2din6: {
    id: "gaau2din6",
    phrase: "成份计划书一日搞掂",
    jp: "cing4 fan6 gek3 zing3 syu1 jat1 zik6 gaau2 din6",
    meaning: "整份计划书一天搞定",
    kind: "persuade",
    cost: 2,
    persuade: 16,
    tags: ["skill", "docs"],
    rarity: "rare"
  }
};

export const CH4_STARTER = [
  "mingsan",
  "mgoineoi",
  "sakdak1",
  "gaapsi4",
  "wunsoeng5",
  "geidonim2",
  "dim2soeng5",
  "m4haai3",
  "jau5seoi1",
  "tai2fan6"
];

export const CH4_NPCS: Record<string, NpcDef> = {
  staff: {
    id: "staff",
    name: "人事陈姑娘",
    img: "staff.png",
    bg: "bg/rush.jpg",
    sign: "前台",
    target: 92,
    intro: "前台后面，陈姑娘望住你张简历，眉头谂住谂落。",
    win: "得，你下礼拜返嚟试工！",
    intents: [
      {
        line: "你介绍下自己先啦。",
        jp: "nei5 gai3 siu6 haa5 zi6 gei2 sin1 laa1",
        gloss: "你先介绍一下自己吧。",
        label: "问介绍",
        loss: 14,
        need: "polite"
      },
      {
        line: "你有咩专长呀？",
        jp: "nei5 jau5 mat1 zyun1 ceng4 aa3",
        gloss: "你有什么专长？",
        label: "问专长",
        loss: 15,
        need: "skill"
      },
      {
        line: "几时可以到职呀？",
        jp: "gei2 si4 ho2 ji5 dou3 zik1 aa3",
        gloss: "什么时候可以到岗？",
        label: "问到职",
        loss: 14,
        need: "schedule"
      }
    ]
  },
  clerk: {
    id: "clerk",
    name: "文员阿表",
    img: "clerk.png",
    bg: "bg/rush.jpg",
    sign: "文员",
    target: 88,
    intro: "隔篱位嘅阿表摆住三份文件望住你：「帮眼睇睇？」",
    win: "得晒！你系新同事之中最叻嗰个！",
    intents: [
      {
        line: "份报表我搵唔到。",
        jp: "fan6 bou2 biu3 ngo5 wan2 m4 dou3 wo3",
        gloss: "那份报表我找不到了。",
        label: "揾文件",
        loss: 13,
        need: "docs"
      },
      {
        line: "听日个会帮帮手啦。",
        jp: "han1 jat6 go3 wui6 bong1 bong1 sau2 laa1",
        gloss: "明天那个会帮帮忙啦。",
        label: "央帮忙",
        loss: 13,
        need: "help"
      },
      {
        line: "出粮单你有冇睇过？",
        jp: "ceot1 loeng4 daan1 nei5 jau5 mou5 tai2 gwo3",
        gloss: "工资单你有没有看过？",
        label: "问出粮",
        loss: 14,
        need: "schedule"
      }
    ]
  },
  chief: {
    id: "chief",
    name: "主管田力叔",
    img: "chief.png",
    bg: "bg/rush.jpg",
    sign: "主管",
    target: 104,
    intro: "玻璃房入面，田力叔招招手：「入嚟倾两句。」",
    win: "得！你份嘢我钟意，继续做！",
    intents: [
      {
        line: "份案改咗三次未得。",
        jp: "fan6 on3 goi2 zo2 saam1 ci3 mei6 dak1",
        gloss: "方案改了三次还不行。",
        label: "改稿",
        loss: 15,
        need: "skill"
      },
      {
        line: "进度表几时俾到？",
        jp: "zing6 dou3 biu2 gei2 si4 bei2 dou3",
        gloss: "进度表什么时候给？",
        label: "催进度",
        loss: 15,
        need: "schedule"
      },
      {
        line: "唔好成日迟到㖎。",
        jp: "m4 hou2 cing4 jat6 ci4 dou3 me1",
        gloss: "不要整天迟到啦。",
        label: "话唔勤力",
        loss: 16,
        need: "polite"
      }
    ]
  },
  director: {
    id: "director",
    name: "总监狄生",
    img: "director.png",
    bg: "bg/rush.jpg",
    sign: "顶层",
    target: 144,
    boss: true,
    intro: "最顶一层，狄生企喺落地玻璃前面：「我啲时间好贵㗎。」",
    win: "得你！以后电梯你坐私人嗰部！",
    intents: [
      {
        line: "公司最紧要睇效率。",
        jp: "gung1 si1 zoei3 can5 jiu6 tai2 hau6 leon6",
        gloss: "公司最看重效率。",
        label: "讲效率",
        loss: 15,
        need: "skill"
      },
      {
        line: "你份简报做得麻麻地。",
        jp: "nei5 fan6 gam2 bou3 zou6 dak1 maa4 maa4 dei4",
        gloss: "你的简报做得一般。",
        label: "弹简报",
        loss: 14,
        need: "docs"
      },
      {
        line: "新人培训你带住先。",
        jp: "san1 jan4 pan1 fan3 nei5 daai3 zyu6 sin1",
        gloss: "新人培训你先带一下。",
        label: "分派任务",
        loss: 14,
        need: "help"
      },
      {
        line: "年底花红睇你表现。",
        jp: "nin4 dai2 faa1 fung4 tai2 nei5 biu2 jin6",
        gloss: "年底奖金看你的表现。",
        label: "讲奖金",
        loss: 16,
        need: "schedule"
      }
    ]
  }
};

/** 写字楼语法密码：可／识 */
export const CH4_RELICS: Record<string, RelicDef> = {
  sikfan: {
    id: "sikfan",
    glyph: "识",
    name: "识＝会做",
    desc: "「识」表示识做。句子含「识」，说服 +2。"
  },
  hoifan: {
    id: "hoifan",
    glyph: "可",
    name: "可＝肯商量",
    desc: "「可」字打头冇凶气。句子含「可」，稳住 +2。"
  }
};

export const CH4_EVENTS: EventDef[] = [
  {
    title: "茶水间咖啡",
    text: "茶水间部旧机仲有机，你斟多杯，成层楼嘅瞌眼瞓一扫而空。",
    reward: "heal"
  },
  {
    title: "楼下拼单",
    text: "全层夹钱外卖，你帮手写单，同事请你食咗份西多士，仲教多你两句。",
    reward: "card"
  },
  {
    title: "OT 的士单",
    text: "主管帮你批咗加班的士飞，返屋企唔使行夜路。",
    reward: "gold"
  }
];
