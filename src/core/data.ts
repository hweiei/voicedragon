/**
 * 内容数据层：纯数据 + 类型。技能/敌人/事件/遗物/道具全部由数据表驱动，
 * 后续关卡包（第二、三幕）只需新增同构文件，无需改引擎。
 */

export const GAME_TITLE = "声震龙楼";
export const MAX_FLOOR = 10;

export type SkillType =
  | "attack"
  | "multi"
  | "guard"
  | "hybrid"
  | "cleanse"
  | "strength"
  | "tempo"
  | "heal"
  | "weaken";

export type SkillRarity = "basic" | "common" | "rare";

export interface Skill {
  id: string;
  name: string;
  phrase: string;
  alternatives: string[];
  jyutping: string;
  lesson: string;
  type: SkillType;
  rarity: SkillRarity;
  cost: number;
  power: number;
  hits?: number;
  description: string;
  /** P9 反击姿态；仅 counterVersion 内容使用，缺省表示无（旧内容逐位不变）。 */
  counter?: { ratio: number };
}

export type IntentType = "attack" | "guardAttack" | "guard" | "debuff" | "silence" | "charge";

export interface EnemyIntent {
  /** P8-B 穿甲及行动后露隙（轮数）；仅新版本内容使用。 */
  pierce?: boolean;
  selfVulnerable?: number;
  type: IntentType;
  amount?: number;
  label: string;
  hits?: number;
  guard?: number;
}

export interface EnemyBlueprint {
  id: string;
  name: string;
  epithet: string;
  glyph: string;
  hue: string;
  hp: number;
  attack: number;
  pattern: EnemyIntent[];
}

export interface Relic {
  id: string;
  name: string;
  short: string;
  description: string;
}

export type ItemEffect =
  | "heal"
  | "voiceBoost"
  | "weakenEnemy"
  | "armor"
  | "cleanse"
  | "energy"
  | "redraw"
  | "expose";

export interface Item {
  id: string;
  name: string;
  short: string;
  description: string;
  effect: ItemEffect;
  power: number;
}

export type EventAction =
  | "heal"
  | "buySkill"
  | "quizCorrect"
  | "quizWrong"
  | "maxHp"
  | "gold"
  | "relicForHp"
  | "item"
  | "gamble";

export interface EventChoice {
  id: string;
  label: string;
  hint: string;
  action: EventAction;
  value: number;
}

export interface Lesson {
  phrase: string;
  jyutping: string;
  meaning: string;
}

export interface GameEventContent {
  id: string;
  title: string;
  kicker: string;
  text: string;
  lesson: Lesson;
  choices: EventChoice[];
}

export const SKILLS: Skill[] = [
  {
    id: "ding-ngang-soeng",
    name: "顶硬上",
    phrase: "顶硬上",
    alternatives: ["顶硬上", "頂硬上"],
    jyutping: "ding2 ngaang6 soeng6",
    lesson: "迎难而上，坚持住",
    type: "attack",
    rarity: "basic",
    cost: 1,
    power: 8,
    description: "造成 {power} 点伤害；正音时额外获得 3 点护甲。"
  },
  {
    id: "m-sai-geng",
    name: "唔使惊",
    phrase: "唔使惊",
    alternatives: ["唔使惊", "唔使驚", "不用怕"],
    jyutping: "m4 sai2 geng1",
    lesson: "不用怕",
    type: "guard",
    rarity: "basic",
    cost: 1,
    power: 9,
    description: "获得 {power} 点护甲；良好发音可再获得 2 点。"
  },
  {
    id: "hou-sai-lei",
    name: "好犀利",
    phrase: "好犀利",
    alternatives: ["好犀利", "很厉害", "真厉害"],
    jyutping: "hou2 sai1 lei6",
    lesson: "很厉害",
    type: "attack",
    rarity: "basic",
    cost: 1,
    power: 10,
    description: "造成 {power} 点伤害。发音越准，喝彩越响。"
  },
  {
    id: "jat-cai-soeng",
    name: "一齐上",
    phrase: "一齐上",
    alternatives: ["一齐上", "一齊上", "一起上"],
    jyutping: "jat1 cai4 soeng6",
    lesson: "一起上",
    type: "multi",
    rarity: "common",
    cost: 1,
    power: 4,
    hits: 3,
    description: "连续攻击 3 次，每次造成 {power} 点伤害。"
  },
  {
    id: "zap-saang-laa",
    name: "执生啦",
    phrase: "执生啦",
    alternatives: ["执生啦", "執生啦", "随机应变"],
    jyutping: "zap1 saang1 laa1",
    lesson: "随机应变、见机行事",
    type: "hybrid",
    rarity: "common",
    cost: 1,
    power: 6,
    description: "造成 {power} 点伤害并获得 {power} 点护甲。"
  },
  {
    id: "mou-man-tai",
    name: "冇问题",
    phrase: "冇问题",
    alternatives: ["冇问题", "冇問題", "没有问题"],
    jyutping: "mou5 man6 tai4",
    lesson: "没有问题",
    type: "cleanse",
    rarity: "common",
    cost: 1,
    power: 6,
    description: "获得 {power} 点护甲，并清除 1 层虚弱或破绽。"
  },
  {
    id: "gaa-jau",
    name: "加油",
    phrase: "加油",
    alternatives: ["加油"],
    jyutping: "gaa1 jau4",
    lesson: "鼓励别人继续努力",
    type: "strength",
    rarity: "common",
    cost: 1,
    power: 2,
    description: "本场战斗获得 {power} 点声势，之后攻击更强。"
  },
  {
    id: "faai-di-zau",
    name: "快啲走",
    phrase: "快啲走",
    alternatives: ["快啲走", "快点走", "快啲行"],
    jyutping: "faai3 di1 zau2",
    lesson: "快点走",
    type: "tempo",
    rarity: "common",
    cost: 1,
    power: 7,
    description: "获得 {power} 点护甲，并立刻换 1 张技能。"
  },
  {
    id: "sik-zo-faan-mei",
    name: "食咗饭未",
    phrase: "食咗饭未",
    alternatives: ["食咗饭未", "食咗飯未", "吃饭了吗"],
    jyutping: "sik6 zo2 faan6 mei6",
    lesson: "吃饭了吗；常见问候",
    type: "heal",
    rarity: "rare",
    cost: 2,
    power: 7,
    description: "回复 {power} 点生命，并获得 5 点护甲。"
  },
  {
    id: "dim-gwo-luk-ze",
    name: "掂过碌蔗",
    phrase: "掂过碌蔗",
    alternatives: ["掂过碌蔗", "掂過碌蔗", "非常顺利"],
    jyutping: "dim6 gwo3 luk6 ze3",
    lesson: "事情非常顺利、稳妥",
    type: "attack",
    rarity: "rare",
    cost: 2,
    power: 18,
    description: "造成 {power} 点伤害；优秀或正音时无视护甲。"
  },
  {
    id: "dak-haan-jam-caa",
    name: "得闲饮茶",
    phrase: "得闲饮茶",
    alternatives: ["得闲饮茶", "得閒飲茶", "有空喝茶"],
    jyutping: "dak1 haan4 jam2 caa4",
    lesson: "有空一起喝茶",
    type: "guard",
    rarity: "rare",
    cost: 2,
    power: 15,
    description: "获得 {power} 点护甲，并回复 3 点生命。"
  },
  {
    id: "jau-mou-gaau-co",
    name: "有冇搞错",
    phrase: "有冇搞错",
    alternatives: ["有冇搞错", "有冇搞錯", "有没有搞错"],
    jyutping: "jau5 mou5 gaau2 co3",
    lesson: "有没有弄错；表示惊讶",
    type: "weaken",
    rarity: "rare",
    cost: 1,
    power: 5,
    description: "造成 {power} 点伤害，并令敌人虚弱 2 回合。"
  }
];

export const SKILL_INDEX: Record<string, Skill> = Object.fromEntries(
  SKILLS.map((skill) => [skill.id, skill])
);

export const ENEMIES: EnemyBlueprint[] = [
  {
    id: "paper-scout",
    name: "纸扎巡卒",
    epithet: "风一吹就散，嘴却很硬",
    glyph: "卒",
    hue: "crimson",
    hp: 34,
    attack: 6,
    pattern: [
      { type: "attack", amount: 1, label: "竹枪突刺" },
      { type: "guardAttack", amount: 0.65, guard: 5, label: "纸盾压阵" },
      { type: "attack", amount: 1.35, label: "扎纸连挑" }
    ]
  },
  {
    id: "alley-shadow",
    name: "雾巷影贼",
    epithet: "躲在骑楼阴影里听声辨位",
    glyph: "影",
    hue: "violet",
    hp: 38,
    attack: 7,
    pattern: [
      { type: "debuff", amount: 1, label: "封喉灰" },
      { type: "attack", amount: 1.2, label: "短刃回声" },
      { type: "attack", amount: 0.75, hits: 2, label: "双影掠" }
    ]
  },
  {
    id: "stone-lion",
    name: "醒狮石灵",
    epithet: "门环震动时，它便睁眼",
    glyph: "狮",
    hue: "gold",
    hp: 48,
    attack: 8,
    pattern: [
      { type: "guard", guard: 9, label: "镇门" },
      { type: "attack", amount: 1.45, label: "狮首撞" },
      { type: "guardAttack", amount: 0.75, guard: 5, label: "踏桩" }
    ]
  },
  {
    id: "opera-mask",
    name: "戏棚魅影",
    epithet: "每换一张脸，招式也会改变",
    glyph: "伶",
    hue: "cyan",
    hp: 44,
    attack: 8,
    pattern: [
      { type: "attack", amount: 0.8, hits: 2, label: "水袖双击" },
      { type: "debuff", amount: 1, label: "倒嗓" },
      { type: "attack", amount: 1.5, label: "花面喝破" }
    ]
  },
  {
    id: "bronze-bell",
    name: "铜钟噬音兽",
    epithet: "专吞含糊不清的尾音",
    glyph: "钟",
    hue: "teal",
    hp: 56,
    attack: 9,
    pattern: [
      { type: "attack", amount: 1, label: "钟摆横扫" },
      { type: "silence", amount: 8, label: "吞音" },
      { type: "attack", amount: 1.55, label: "暮鼓震荡" }
    ]
  }
];

export const ELITES: EnemyBlueprint[] = [
  {
    id: "red-lion",
    name: "赤鬃醒狮王",
    epithet: "踏七星桩而来",
    glyph: "王",
    hue: "crimson",
    hp: 82,
    attack: 11,
    pattern: [
      { type: "guardAttack", amount: 0.8, guard: 10, label: "采青试探" },
      { type: "attack", amount: 1.7, label: "凌空采青" },
      { type: "debuff", amount: 2, label: "鼓点乱心" }
    ]
  },
  {
    id: "night-ferry",
    name: "夜渡无灯客",
    epithet: "只问来处，不问归途",
    glyph: "渡",
    hue: "violet",
    hp: 76,
    attack: 12,
    pattern: [
      { type: "attack", amount: 1.2, label: "船篙点水" },
      { type: "guard", guard: 14, label: "雾锁横江" },
      { type: "attack", amount: 0.7, hits: 3, label: "三叠浪" }
    ]
  }
];

export const BOSS: EnemyBlueprint = {
  id: "nine-tone-dragon",
  name: "九龙声煞",
  epithet: "第十层守关者，九声皆成刃",
  glyph: "龙",
  hue: "gold",
  hp: 138,
  attack: 13,
  pattern: [
    { type: "attack", amount: 0.62, hits: 3, label: "三声叠浪" },
    { type: "debuff", amount: 2, label: "错调迷障" },
    { type: "guardAttack", amount: 1.05, guard: 14, label: "龙鳞回响" },
    { type: "attack", amount: 2.05, label: "九龙合音" }
  ]
};

export const RELICS: Relic[] = [
  {
    id: "metronome",
    name: "南音节拍器",
    short: "拍",
    description: "每次语音判定的最终分数 +5。"
  },
  {
    id: "lion-ribbon",
    name: "醒狮红绸",
    short: "绸",
    description: "每场战斗第一次攻击额外造成 5 点伤害。"
  },
  {
    id: "tea-cup",
    name: "粤韵茶盅",
    short: "茶",
    description: "正音释放技能时回复 2 点生命，每回合最多一次。"
  },
  {
    id: "old-radio",
    name: "骑楼旧收音机",
    short: "声",
    description: "每场战斗开始时获得 1 点声势。"
  },
  {
    id: "jade-token",
    name: "街坊玉牌",
    short: "玉",
    description: "进入事件层时额外获得 6 两。"
  }
];

export const ITEMS: Item[] = [
  {
    id: "herbal-tea",
    name: "廿四味凉茶",
    short: "凉",
    description: "立即回复 15 点生命。",
    effect: "heal",
    power: 15
  },
  {
    id: "throat-candy",
    name: "老字号喉糖",
    short: "糖",
    description: "下一次语音判定分数 +18。",
    effect: "voiceBoost",
    power: 18
  },
  {
    id: "small-gong",
    name: "开场小铜锣",
    short: "锣",
    description: "敌人下次攻击伤害降低 35%。",
    effect: "weakenEnemy",
    power: 1
  }
];

export const EVENTS: GameEventContent[] = [
  {
    id: "tea-house",
    title: "半山茶楼",
    kicker: "一盅两件",
    text: "掌柜把滚烫的茶推到你面前：‘行咁耐，唞阵先啦。’",
    lesson: { phrase: "唞阵先", jyutping: "tau2 zan6 sin1", meaning: "先休息一会儿" },
    choices: [
      { id: "rest", label: "饮杯热茶", hint: "回复 18 点生命", action: "heal", value: 18 },
      {
        id: "learn",
        label: "同掌柜倾偈",
        hint: "获得随机技能，失去 8 两",
        action: "buySkill",
        value: 8
      }
    ]
  },
  {
    id: "word-wall",
    title: "骑楼字墙",
    kicker: "识字亦识声",
    text: "斑驳墙面亮起一道题：粤语‘冇问题’最接近哪种意思？",
    lesson: { phrase: "冇问题", jyutping: "mou5 man6 tai4", meaning: "没有问题" },
    choices: [
      { id: "correct", label: "没有问题", hint: "答对可提升声韵", action: "quizCorrect", value: 1 },
      { id: "wrong", label: "不要提问", hint: "答错会失去生命", action: "quizWrong", value: 6 }
    ]
  },
  {
    id: "record-shop",
    title: "旧唱片铺",
    kicker: "落针有声",
    text: "一张南音唱片反复播放短句。店主说，听懂的人会走得更稳。",
    lesson: { phrase: "慢慢嚟", jyutping: "maan6 maan6 lai4", meaning: "慢慢来" },
    choices: [
      { id: "listen", label: "静心听一遍", hint: "最大生命 +6", action: "maxHp", value: 6 },
      { id: "sell", label: "帮手整理唱片", hint: "获得 18 两", action: "gold", value: 18 }
    ]
  },
  {
    id: "lion-workshop",
    title: "醒狮工坊",
    kicker: "扎作传承",
    text: "老师傅正在修补一只旧狮头。他愿意用一件随身物换你的帮忙。",
    lesson: { phrase: "唔该晒", jyutping: "m4 goi1 saai3", meaning: "非常感谢" },
    choices: [
      {
        id: "help",
        label: "帮手扎狮头",
        hint: "失去 8 点生命，获得遗物",
        action: "relicForHp",
        value: 8
      },
      { id: "leave", label: "讲声唔该离开", hint: "回复 6 点生命", action: "heal", value: 6 }
    ]
  },
  {
    id: "rain-alley",
    title: "骤雨窄巷",
    kicker: "落狗屎",
    text: "骤雨封路。檐下有人招手，也有一条更短但漆黑的近道。",
    lesson: { phrase: "落狗屎", jyutping: "lok6 gau2 si2", meaning: "形容雨下得很大" },
    choices: [
      { id: "wait", label: "檐下等雨停", hint: "获得随机消耗品", action: "item", value: 1 },
      {
        id: "shortcut",
        label: "抄黑巷近道",
        hint: "50% 得 30 两；50% 受伤",
        action: "gamble",
        value: 30
      }
    ]
  }
];

export const FLOOR_NAMES: string[] = [
  "骑楼初阶",
  "茶香回廊",
  "雨巷石阶",
  "花牌暗门",
  "醒狮试桩",
  "渡口风廊",
  "戏棚后台",
  "铜钟声室",
  "九龙云阶",
  "天台声阵"
];

// ─── 问答节点题库（P2）：粤语常识 / 粤拼 / 用法，评星加分 ─────────────────────

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explain: string;
  /** P13 听音题：需要 TTS 朗读的汉字（无则普通文字题） */
  audio?: string;
  /** P13 听音题标记：无粤语音色的设备上整题跳过（诚实降级） */
  requiresAudio?: boolean;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q-zousan",
    question: "粤语日常打招呼的「早晨」，到底是什么意思？",
    options: ["吃早餐", "早上好", "晨练", "早点出发"],
    answerIndex: 1,
    explain: "「早晨」是粤语早上见面的问候语，相当于“早上好”。"
  },
  {
    id: "q-mgoi",
    question: "什么时候说「唔该」最自然？",
    options: ["麻烦别人帮忙或道谢时", "与人吵架时", "考试成绩公布后", "签合同的时候"],
    answerIndex: 0,
    explain: "「唔该」既可表示“劳驾/麻烦你”，也可用来道谢（唔该晒 = 非常感谢）。"
  },
  {
    id: "q-jyutping-j",
    question: "粤拼方案中，声母 j 的发音最接近下面哪一个？",
    options: [
      "普通话拼音的 j（鸡）",
      "英语 yes 开头的 y 音",
      "普通话拼音的 zh（知）",
      "普通话拼音的 r（日）"
    ],
    answerIndex: 1,
    explain: "粤拼的 j 是滑音 /j/，如「日 jat6」「人 jan4」的开头，接近英语 yes 的 y。"
  },
  {
    id: "q-entering-tone",
    question: "粤语保留、而普通话已基本消失的「入声」，特点是？",
    options: ["音又平又长", "以 -p / -t / -k 急促收尾", "声调一定上扬", "必须带鼻音"],
    answerIndex: 1,
    explain: "入声字以不除阻的 -p/-t/-k 收尾，短促急收藏，是粤语九声六调的重要组成。"
  },
  {
    id: "q-lengzai",
    question: "街市档主笑着叫你「靓仔」，他的意思是？",
    options: ["帅哥 / 年轻男子", "你欠他钱", "请你让开", "你挑货太慢"],
    answerIndex: 0,
    explain: "「靓仔」是对年轻男性的客气称呼，靓（leng3）指好看。"
  },
  {
    id: "q-aa-a",
    question: "粤拼中 aa 与 a 的区别是？",
    options: ["只是声调不同", "发音完全没区别", "长短/音质不同的两个元音", "a 是鼻音"],
    answerIndex: 2,
    explain: "aa 是长元音（如「花 faa1」），a 是短元音（如「歇脚」里的短促 a），混淆会影响听懂。"
  },
  {
    id: "q-hea",
    question: "粤语俗写「Hea」通常用来形容什么状态？",
    options: ["拼命加班", "懒散晃荡、无所事事", "跑得飞快", "特别精明"],
    answerIndex: 1,
    explain: "「Hea」形容漫无目的、悠闲到发懒的状态，常见于年轻人口语。"
  },
  {
    id: "q-faanmei",
    question: "「食咗饭未呀？」在粤语里最接近什么功能？",
    options: ["质问对方为什么吃饭", "日常寒暄：吃饭了吗", "餐厅催单用语", "宣布开饭"],
    answerIndex: 1,
    explain: "这是广府最常见的寒暄之一，重点不在“饭”，在于打招呼。"
  }
];

export function getSkill(id: string): Skill | undefined {
  return SKILL_INDEX[id];
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
