/**
 * P15 铸剑炉 · 锻造内容包（构建期 AI 起草 → 人工审校 → 版本化入池）。
 *
 * 纪律（docs/P15-FORGE-PLAN.md §3）：
 * - 本文件**只有静态数据**——运行时零 AI 推理；
 * - 三类内容只经 `eventsFor / relicsFor / quizPoolFor` 的 `forgeVersion` 参数进入
 *   `ruleset === "p7"` 且 `forgeVersion === 1` 的新局；缺失即与 P14 逐位一致；
 * - 不改基础内容表、不替换基础池、不新增事件效果类型（全部复用既有 `EventAction`）；
 * - 遗物的 `school` 是**展示字段**（呼应 P8-A 构筑流派），战斗判定只看引擎既有钩子。
 */

import type { GameEventContent, QuizQuestion, Relic } from "../data";

// ─── 锻造事件：每幕 4 则（粤剧行话 / 戏棚民俗 / 岭南生活）─────────────────────

export const FORGE_EVENTS: Record<number, GameEventContent[]> = {
  1: [
    {
      id: "p15-blacksmith",
      title: "铁匠炉火",
      kicker: "趁热打铁",
      text: "铁匠拉动风箱，火星四溅：「打铁趁热，冷咗就整唔返。」他缺个帮手抡锤淬火。",
      lesson: {
        phrase: "打铁趁热",
        jyutping: "daa2 tit3 can3 jit6",
        meaning: "时机正合适时要抓紧行动"
      },
      choices: [
        { id: "hammer", label: "帮手抡锤", hint: "获得 15 两", action: "gold", value: 15 },
        { id: "quench", label: "炉边取暖歇息", hint: "回复 12 点生命", action: "heal", value: 12 }
      ]
    },
    {
      id: "p15-yumcha",
      title: "茶楼偶遇",
      kicker: "得闲饮茶",
      text: "邻桌老伯向你招手：「得闲饮茶，多倾下偈。」他说想听戏棚的新鲜事，就请你饮茶。",
      lesson: {
        phrase: "得闲饮茶",
        jyutping: "dak1 haan4 jam3 caa4",
        meaning: "有空一起喝茶——保持来往的客套与真心"
      },
      choices: [
        {
          id: "tale",
          label: "讲戏棚故事",
          hint: "老伯高兴，塞来 12 两",
          action: "gold",
          value: 12
        },
        { id: "dimsum", label: "叹茶食点心", hint: "回复 12 点生命", action: "heal", value: 12 }
      ]
    },
    {
      id: "p15-apprentice",
      title: "学徒鞠躬",
      kicker: "好嘢",
      text: "小学徒刚练完第一遍功，手心冒汗。老师傅鼓掌：「好嘢！」他转头问你可愿指点一句。",
      lesson: {
        phrase: "好嘢",
        jyutping: "hou2 je5",
        meaning: "称赞对方「干得漂亮」"
      },
      choices: [
        {
          id: "coach",
          label: "指点一句",
          hint: "说到点子上：永久声韵加成 +2",
          action: "quizCorrect",
          value: 0
        },
        { id: "tip", label: "打赏鼓励", hint: "获得 12 两", action: "gold", value: 12 }
      ]
    },
    {
      id: "p15-auction",
      title: "旧摊赌眼力",
      kicker: "手快有",
      text: "摊主摆出两箱旧唱片：「手快有，手慢无！」你可以赌一把真假，也可以替他看摊稳赚一笔。",
      lesson: {
        phrase: "手快有，手慢无",
        jyutping: "sau2 faai3 jau5 sau2 maan6 mou4",
        meaning: "机会稍纵即逝，犹豫就会错过"
      },
      choices: [
        {
          id: "bet",
          label: "赌一箱真假",
          hint: "一半机会得 24 两，否则失 11 点生命",
          action: "gamble",
          value: 24
        },
        { id: "watch", label: "替他看摊", hint: "获得 14 两", action: "gold", value: 14 }
      ]
    }
  ],
  2: [
    {
      id: "p15-redboat",
      title: "红船泊岸",
      kicker: "同舟共济",
      text: "红船戏班要过江，风急浪高，船工不够。船老大喊：「同舟共济，一齐撑过去！」",
      lesson: {
        phrase: "同舟共济",
        jyutping: "tung4 zau1 gung6 zai3",
        meaning: "同心协力共渡难关"
      },
      choices: [
        { id: "sail", label: "帮忙撑船", hint: "体魄锻炼：最大生命 +5", action: "maxHp", value: 5 },
        { id: "share", label: "分粮给大家", hint: "回复 15 点生命", action: "heal", value: 15 }
      ]
    },
    {
      id: "p15-makeup",
      title: "镜前开面",
      kicker: "慢慢嚟",
      text: "花脸师傅对镜描画，笔法极慢：「慢慢嚟，心急就花面。」他请你帮忙研墨扶笔。",
      lesson: {
        phrase: "慢慢嚟",
        jyutping: "maan6 maan6 lai4",
        meaning: "别急，一步一步来"
      },
      choices: [
        { id: "ink", label: "研墨扶笔", hint: "获得一件道具", action: "item", value: 0 },
        { id: "watch", label: "静观养神", hint: "回复 12 点生命", action: "heal", value: 12 }
      ]
    },
    {
      id: "p15-script",
      title: "剧本念白",
      kicker: "有商有量",
      text: "两位老倌为一段念白争执不下，各说各的理。班主看向你：「有商有量，你话点就点。」",
      lesson: {
        phrase: "有商有量",
        jyutping: "jau5 soeng1 jau5 loeng6",
        meaning: "互相商量、好声好气地谈"
      },
      choices: [
        {
          id: "judge",
          label: "给出读法",
          hint: "说得在理：永久声韵加成 +2",
          action: "quizCorrect",
          value: 0
        },
        { id: "smooth", label: "两边圆场", hint: "获得 16 两", action: "gold", value: 16 }
      ]
    },
    {
      id: "p15-pillars",
      title: "六柱谢台",
      kicker: "辛苦晒",
      text: "台柱们唱罢谢幕，班底伙计汗透衣衫。管箱派发利是：「辛苦晒！」又问你可愿再帮一程。",
      lesson: {
        phrase: "辛苦晒",
        jyutping: "san1 fu2 saai3",
        meaning: "慰劳他人辛苦的道谢话"
      },
      choices: [
        {
          id: "help",
          label: "帮手收台",
          hint: "失去 9 点生命，换一件未拥有的遗物",
          action: "relicForHp",
          value: 9
        },
        { id: "laisee", label: "接过利是", hint: "获得 18 两", action: "gold", value: 18 }
      ]
    }
  ],
  3: [
    {
      id: "p15-blessing",
      title: "台口祈福",
      kicker: "家和万事兴",
      text: "大戏开锣前，全班人在台口上香祈福。老话说：「家和万事兴」——戏棚也是一个家。",
      lesson: {
        phrase: "家和万事兴",
        jyutping: "gaa1 wo4 maan6 si6 hing1",
        meaning: "和睦团结，诸事兴旺"
      },
      choices: [
        { id: "incense", label: "上香祈愿", hint: "最大生命 +6", action: "maxHp", value: 6 },
        { id: "wine", label: "饮祈福酒", hint: "回复 16 点生命", action: "heal", value: 16 }
      ]
    },
    {
      id: "p15-lion",
      title: "醒狮采青",
      kicker: "一步一脚印",
      text: "狮队要在高桩上采青，狮头师傅绑紧脚带：「一步一脚印，高桩冇捷径。」他请你助阵擂鼓。",
      lesson: {
        phrase: "一步一脚印",
        jyutping: "jat1 bou6 jat1 goek3 jan3",
        meaning: "踏踏实实做事，不走捷径"
      },
      choices: [
        { id: "drum", label: "擂鼓助阵", hint: "获得一件道具", action: "item", value: 0 },
        {
          id: "climb",
          label: "上桩喝彩",
          hint: "一半机会得 28 两，否则失 11 点生命",
          action: "gamble",
          value: 28
        }
      ]
    },
    {
      id: "p15-encore",
      title: "安可声浪",
      kicker: "知足常乐",
      text: "观众不散，高呼安可。台柱已汗湿重衫，气喘未定。管箱望着你：唱多一支，还是圆满收锣？",
      lesson: {
        phrase: "知足常乐",
        jyutping: "zi1 zuk1 soeng4 lok6",
        meaning: "懂得满足，快乐常在"
      },
      choices: [
        {
          id: "learn",
          label: "花钱学艺",
          hint: "花 13 两学一招新腔",
          action: "buySkill",
          value: 13
        },
        { id: "bow", label: "圆满收锣", hint: "回复 13 点生命", action: "heal", value: 13 }
      ]
    },
    {
      id: "p15-finalgong",
      title: "落幕锣鼓",
      kicker: "饮水思源",
      text: "压轴戏罢，台柱先谢观众，再转身向后台深深一揖：「饮水思源，冇大家就冇大戏。」",
      lesson: {
        phrase: "饮水思源",
        jyutping: "jam2 seoi2 si1 jyun4",
        meaning: "享受成果时不忘来处与功臣"
      },
      choices: [
        {
          id: "teach",
          label: "替师傅传话",
          hint: "传得到位：永久声韵加成 +2",
          action: "quizCorrect",
          value: 0
        },
        {
          id: "gong",
          label: "帮忙收锣",
          hint: "失去 10 点生命，换一件未拥有的遗物",
          action: "relicForHp",
          value: 10
        }
      ]
    }
  ]
};

// ─── 锻造遗物：6 件，带构筑流派标签（school 为展示字段，不参与判定）─────────

export const FORGE_RELICS: Relic[] = [
  {
    id: "p15-sing-tung-ling",
    name: "醒狮铜铃",
    short: "铃",
    description: "每场战斗首次多段招式，该次每段伤害 +1。流派：连击增势。",
    school: "连击增势"
  },
  {
    id: "p15-tit-paai",
    name: "守夜铁牌",
    short: "牌",
    description: "每场战斗首次护甲招式额外 +2 护甲。流派：守势攻防。",
    school: "守势攻防"
  },
  {
    id: "p15-cean-bei-wu",
    name: "陈皮老壶",
    short: "壶",
    description: "每场战斗首次治疗招式多回复 4 点生命。流派：调息周转。",
    school: "调息周转"
  },
  {
    id: "p15-zan-lou-gu",
    name: "镇楼老鼓",
    short: "鼓",
    description: "每场战斗首次正音（≥85）施法后追加 1 点伤害。流派：连击增势。",
    school: "连击增势"
  },
  {
    id: "p15-gam-noung",
    name: "戏班锦囊",
    short: "囊",
    description: "每场战斗开始时获得 4 两。百搭行头，不属任何流派。"
  },
  {
    id: "p15-gaa-haak-wo",
    name: "街客茶壶",
    short: "茶",
    description: "歇脚回复时额外回复 4 点生命。流派：调息周转。",
    school: "调息周转"
  }
];

// ─── 锻造题集：30 道粤语文化题（典故/民俗/俗语/地标，非听音题）──────────────

export const FORGE_QUIZ: QuizQuestion[] = [
  {
    id: "p15-q-sihpaang",
    question: "昔日粤剧在神诞节庆搭竹木棚演出，这种临时戏台俗称什么？",
    options: ["戏棚", "祠堂", "茶楼", "武馆"],
    answerIndex: 0,
    explain: "「戏棚」用竹木葵叶搭成，演完即拆，是神功戏的传统舞台。"
  },
  {
    id: "p15-q-manmou",
    question: "粤剧里既能演武打又能担纲文唱的男主角行当叫什么？",
    options: ["伙计", "文武生", "师爷", "掌柜"],
    answerIndex: 1,
    explain: "文武生是粤剧独有的行当，文武双全，常担正印。"
  },
  {
    id: "p15-q-hungsyun",
    question: "旧时粤剧戏班水路巡回演出乘坐的红漆木船叫什么？",
    options: ["渡船", "商船", "红船", "花艇"],
    answerIndex: 2,
    explain: "戏班乘红船沿珠三角水网巡演，粤剧艺人故称「红船子弟」。"
  },
  {
    id: "p15-q-hoimin",
    question: "粤剧演员上台前在脸上勾画图案的化妆技艺称为什么？",
    options: ["易容", "画皮", "贴面", "开面"],
    answerIndex: 3,
    explain: "「开面」即粤剧面谱化妆，不同颜色图案标示人物忠奸性格。"
  },
  {
    id: "p15-q-sangung",
    question: "粤剧「神功戏」主要在什么场合演出？",
    options: ["神诞与传统节庆", "商铺开张剪彩", "科举考试放榜", "婚丧嫁娶司仪"],
    answerIndex: 0,
    explain: "神功戏为酬神而演，常见于神诞、盂兰节等传统节庆。"
  },
  {
    id: "p15-q-tongsui",
    question: "广府人把芝麻糊、红豆沙这类饭后甜汤统称为什么？",
    options: ["蜜水", "糖水", "凉茶", "老火汤"],
    answerIndex: 1,
    explain: "「糖水」是广式甜品甜汤的总称，样式繁多。"
  },
  {
    id: "p15-q-tongfu",
    question: "粤剧行话「六柱」指的是什么？",
    options: ["六件伴奏乐器", "六出首本名剧", "戏班六个主要行当", "戏棚六根支柱"],
    answerIndex: 2,
    explain: "六柱制指文武生、正印花旦、小生、二帮花旦、丑生、武生六个主要行当。"
  },
  {
    id: "p15-q-lukcing",
    question: "粤语声调按传统说法有几声？",
    options: ["三声", "四声", "八声", "六声"],
    answerIndex: 3,
    explain: "粤语常说「九声六调」，日常口语区分的是六个声调。"
  },
  {
    id: "p15-q-jyutping",
    question: "由香港语言学学会制定、现时学界通用的粤语拼音方案叫什么？",
    options: ["粤拼", "注音", "威妥玛拼音", "耶鲁拼音"],
    answerIndex: 0,
    explain: "「粤拼」（jyutping）1993 年发布，是现时最通用的粤语罗马化方案。"
  },
  {
    id: "p15-q-jamsing",
    question: "广府人饮宴举杯时最地道的一声吆喝是？",
    options: ["得闲", "饮胜", "食饭", "行快啲"],
    answerIndex: 1,
    explain: "「饮胜」取「胜」的好意头，是干杯时最地道的喊法。"
  },
  {
    id: "p15-q-jatzung",
    question: "老广叹早茶说的「一盅两件」指的是什么？",
    options: ["一杯酒配两碟小菜", "一笼包配两笼饺", "一壶茶配两件点心", "一碗粥配两根油条"],
    answerIndex: 2,
    explain: "「一盅两件」：一盅茶、两件点心，就是最写意的早茶标配。"
  },
  {
    id: "p15-q-laisee",
    question: "过年时广东人说的「派利是」是什么意思？",
    options: ["发放工钱", "派发年货", "请客吃饭", "派发红包"],
    answerIndex: 3,
    explain: "「利是」（利市）即红包，取利利是是、好运之意。"
  },
  {
    id: "p15-q-zungzi",
    question: "端午节广府人家的应节食品是什么？",
    options: ["裹蒸粽", "月饼", "汤圆", "煎堆"],
    answerIndex: 0,
    explain: "端午食粽，肇庆裹蒸粽是广府名物。"
  },
  {
    id: "p15-q-baausaan",
    question: "长洲「太平清醮」最受瞩目的传统活动是什么？",
    options: ["放河灯", "抢包山", "赛龙舟", "舞火龙"],
    answerIndex: 1,
    explain: "抢包山是长洲太平清醮的压轴，攀包山抢「平安包」。"
  },
  {
    id: "p15-q-folung",
    question: "大坑中秋时节的传统习俗是什么？",
    options: ["烧番塔", "打小人", "舞火龙", "赏花灯"],
    answerIndex: 2,
    explain: "大坑舞火龙是国家级非遗，中秋连舞三晚。"
  },
  {
    id: "p15-q-zicaai",
    question: "下列哪一出是粤剧经典剧目？",
    options: ["霸王别姬", "贵妃醉酒", "四郎探母", "紫钗记"],
    answerIndex: 3,
    explain: "《紫钗记》是唐涤生改编的粤剧名作，其余三出是京剧名剧。"
  },
  {
    id: "p15-q-tongdiksang",
    question: "被誉为「粤剧莎士比亚」的著名编剧家是谁？",
    options: ["唐涤生", "薛觉先", "马师曾", "红线女"],
    answerIndex: 0,
    explain: "唐涤生编剧无数名作；薛觉先、马师曾、红线女是表演大家。"
  },
  {
    id: "p15-q-boubouhou",
    question: "名曲《步步高》属于哪一类乐种？",
    options: ["北方鼓吹", "广东音乐", "江南丝竹", "京剧曲牌"],
    answerIndex: 1,
    explain: "《步步高》是吕文成创作的广东音乐（粤乐）名曲。"
  },
  {
    id: "p15-q-keilau",
    question: "骑楼建筑最大的特色是什么？",
    options: ["圆楼聚族而居", "临水吊脚而建", "楼身跨骑人行道，遮阳挡雨", "四面围合成院"],
    answerIndex: 2,
    explain: "骑楼二层以上跨出人行道成廊，宜商宜居，是岭南街市标配。"
  },
  {
    id: "p15-q-saigwan",
    question: "旧广州西关一带的传统民居大宅叫什么？",
    options: ["四合院", "土楼", "窑洞", "西关大屋"],
    answerIndex: 3,
    explain: "西关大屋青砖石脚、趟栊门，是西关富商的传统宅第。"
  },
  {
    id: "p15-q-sikaan",
    question: "粤语「食晏」是什么意思？",
    options: ["吃午饭", "吃早饭", "吃宵夜", "吃下午茶"],
    answerIndex: 0,
    explain: "「晏」是中午，「食晏」即吃午饭。"
  },
  {
    id: "p15-q-haanggaai",
    question: "粤语「行街」是什么意思？",
    options: ["赶集摆档", "逛街", "跑步", "搬家"],
    answerIndex: 1,
    explain: "「行街」即逛街、上街走走。"
  },
  {
    id: "p15-q-kinggai",
    question: "粤语「倾偈」是什么意思？",
    options: ["谈判", "唱歌", "聊天", "吵架"],
    answerIndex: 2,
    explain: "「倾偈」就是聊天闲谈。"
  },
  {
    id: "p15-q-tinsing",
    question: "往来维港两岸的经典渡轮叫什么？",
    options: ["红船", "花艇", "快艇", "天星小轮"],
    answerIndex: 3,
    explain: "天星小轮自 1888 年起航行维港，是标志性海上交通工具。"
  },
  {
    id: "p15-q-caaicing",
    question: "醒狮表演的高潮环节——狮子咬取悬吊的青菜红包——叫什么？",
    options: ["采青", "踏青", "抢炮", "拜山"],
    answerIndex: 0,
    explain: "「采青」寓意生财纳福，是醒狮表演的例牌高潮。"
  },
  {
    id: "p15-q-gonggu",
    question: "广东人把说书讲古的民间曲艺叫什么？",
    options: ["讲经", "讲古", "讲数", "讲笑"],
    answerIndex: 1,
    explain: "「讲古」即用粤语说书，电台讲古曾是几代人的集体回忆。"
  },
  {
    id: "p15-q-gongsou",
    question: "粤语「讲数」是什么意思？",
    options: ["讲故事", "算账", "谈判、讲条件", "数钱"],
    answerIndex: 2,
    explain: "「讲数」指双方谈判、讲条件。"
  },
  {
    id: "p15-q-lokjyu",
    question: "粤语「落雨」是什么意思？",
    options: ["刮风", "打雷", "起雾", "下雨"],
    answerIndex: 3,
    explain: "「落雨」即下雨，如童谣「落雨大，水浸街」。"
  },
  {
    id: "p15-q-daaidik",
    question: "粤语「搭的士」是什么意思？",
    options: ["乘出租车", "搭地铁", "坐渡轮", "骑自行车"],
    answerIndex: 0,
    explain: "「的士」是 taxi 的音译，「搭的士」即乘出租车。"
  },
  {
    id: "p15-q-daidaipei",
    question: "唐涤生笔下，讲述长平公主与驸马故事的名剧是哪一出？",
    options: ["牡丹亭惊梦", "帝女花", "紫钗记", "再世红梅记"],
    answerIndex: 1,
    explain: "《帝女花》之「香夭」一曲家喻户晓，其余三出同为唐涤生名作。"
  }
];
