/**
 * P17 词海 · 问答题扩容（+80：词义 / 场景 / 拼音语音）。
 * 仅经 quizPoolFor 第四参 lexiconVersion=1 进入新战役问答池；文字题，不依赖 TTS。
 * 粤拼为 LSHK 方案人工编写，待母语审校。
 */
import type { QuizQuestion } from "../../data";

export const P17_QUIZ: QuizQuestion[] = [
  // ── 词义（30）──────────────────────────────────────────────
  {
    id: "q17-gam3",
    question: "「咁」（gam3）在「咁大」里的意思是？",
    options: ["这么、那么", "的", "了", "在"],
    answerIndex: 0,
    explain: "「咁」是程度副词：咁大 = 这么大；咁贵 = 这么贵。"
  },
  {
    id: "q17-ge3",
    question: "「我嘅书」里的「嘅」（ge3）相当于普通话的？",
    options: ["了", "的", "吗", "呢"],
    answerIndex: 1,
    explain: "「嘅」是结构助词，我嘅书 = 我的书。"
  },
  {
    id: "q17-hai2",
    question: "「我喺屋企」的意思是？",
    options: ["我回家里", "我在家", "我去他家", "我想家"],
    answerIndex: 1,
    explain: "「喺」（hai2）表示“在”：我喺屋企 = 我在家。"
  },
  {
    id: "q17-lai4",
    question: "「嚟」（lai4）的意思是？",
    options: ["来", "去", "拿", "给"],
    answerIndex: 0,
    explain: "「嚟」= 来：过嚟 = 过来；嚟紧 = 接下来。"
  },
  {
    id: "q17-tai2",
    question: "「睇戏」是什么意思？",
    options: ["演戏", "看电影/看戏", "唱戏", "导戏"],
    answerIndex: 1,
    explain: "「睇」（tai2）= 看：睇戏、睇书、睇电视。"
  },
  {
    id: "q17-gui6",
    question: "广东人说「我好攰」，他的状态是？",
    options: ["很生气", "很累", "很饿", "很困倦烦躁"],
    answerIndex: 1,
    explain: "「攰」（gui6）= 累：行咗一日好攰 = 走了一天好累。"
  },
  {
    id: "q17-nau2",
    question: "「嬲」（nau2）的意思是？",
    options: ["开心", "生气", "害羞", "惊讶"],
    answerIndex: 1,
    explain: "「嬲」= 生气：我好嬲 = 我很生气；嬲到你 = 气死你。"
  },
  {
    id: "q17-dim6",
    question: "「搞掂」（gaau2 dim6）的意思是？",
    options: ["搞砸了", "办妥了", "搞卫生", "搞对象"],
    answerIndex: 1,
    explain: "「掂」= 妥当：搞掂 = 搞定。引申「掂过碌蔗」= 顺顺利利。"
  },
  {
    id: "q17-leng3",
    question: "「靓」（leng3）的意思是？",
    options: ["安静", "好看", "清凉", "灵巧"],
    answerIndex: 1,
    explain: "「靓」= 好看：靓女、靓仔、呢件衫好靓。"
  },
  {
    id: "q17-lek1",
    question: "夸小朋友「好叻」（hou2 lek1），是在夸他？",
    options: ["跑得快", "聪明能干", "长得高", "嘴巴甜"],
    answerIndex: 1,
    explain: "「叻」= 聪明、能干：叻仔 = 能干的小伙子。"
  },
  {
    id: "q17-sap1-sap1-seoi3",
    question: "「湿湿碎」形容什么？",
    options: ["淋湿了", "小意思", "琐碎八卦", "天气潮湿"],
    answerIndex: 1,
    explain: "「湿湿碎」= 小意思、不成问题：呢啲湿湿碎啦 = 这些小意思。"
  },
  {
    id: "q17-gu1-hung4",
    question: "说人「孤寒」（gu1 hung4）是说他？",
    options: ["怕冷", "小气吝啬", "孤独", "性格冷淡"],
    answerIndex: 1,
    explain: "「孤寒」= 吝啬：孤寒鬼 = 小气鬼。出手大方则叫「疏爽」。"
  },
  {
    id: "q17-leon6-zeon6",
    question: "「论尽」（leon6 zeon6）的意思是？",
    options: ["讨论完毕", "笨手笨脚", "啰啰嗦嗦", "精打细算"],
    answerIndex: 1,
    explain: "「论尽」= 笨手笨脚、不灵便：佢好论尽 = 他笨手笨脚。"
  },
  {
    id: "q17-mai5",
    question: "「咪住」（mai5 zyu6）的意思是？",
    options: ["别停下", "站住别动", "闭上嘴", "快点"],
    answerIndex: 1,
    explain: "「咪」= 别：咪住 = 先别动/等等；咪走 = 别走。"
  },
  {
    id: "q17-si6-daan6",
    question: "点菜时说「是但」（si6 daan6），意思是？",
    options: ["随便", "认真挑", "等一下", "反对"],
    answerIndex: 0,
    explain: "「是但」= 随便：是但啦 = 随便啦；近义「求其」偏马虎。"
  },
  {
    id: "q17-jat1-jyu1",
    question: "「一于」（jat1 jyu1）表达的语气是？",
    options: ["犹豫", "就这么办（下定决心）", "推迟", "无奈"],
    answerIndex: 1,
    explain: "「一于」= 干脆、就这么：一于去 = 干脆去。"
  },
  {
    id: "q17-sam1-sap1",
    question: "「心噏」（sam1 sap1）的意思是？",
    options: ["心里一惊", "心里憋闷", "心里喜欢", "心里盘算"],
    answerIndex: 1,
    explain: "「噏」本义是吸入，心噏 = 心里憋闷不痛快。"
  },
  {
    id: "q17-mou5-ngaan5-tai2",
    question: "「冇眼睇」表达的情绪是？",
    options: ["困得睁不开眼", "看不下去、无语", "目瞪口呆", "视而不见"],
    answerIndex: 1,
    explain: "「冇眼睇」= 看不下去：佢做嘢咁论尽，冇眼睇。"
  },
  {
    id: "q17-tau2",
    question: "「早啲唞」（zou2 di1 tau2）的意思是？",
    options: ["早点出发", "早点休息", "早点起床", "早点下班"],
    answerIndex: 1,
    explain: "「唞」= 休息：唞下 = 歇会儿；早啲唞 = 早点休息（晚安用语）。"
  },
  {
    id: "q17-fan3",
    question: "「瞓觉」（fan3 gaau3）的意思是？",
    options: ["睡觉", "发呆", "翻身", "打盹"],
    answerIndex: 0,
    explain: "「瞓」= 睡：瞓觉 = 睡觉；瞓过头 = 睡过头。"
  },
  {
    id: "q17-hei2-san1",
    question: "「起身」（hei2 san1）的意思是？",
    options: ["起立", "起床", "起风", "起步"],
    answerIndex: 1,
    explain: "「起身」= 起床：听日八点起身 = 明天八点起床。"
  },
  {
    id: "q17-hou2-noi6",
    question: "「好耐」（hou2 noi6）的意思是？",
    options: ["很有耐心", "很久", "很硬", "很努力"],
    answerIndex: 1,
    explain: "「耐」= 久：好耐冇见 = 好久不见。"
  },
  {
    id: "q17-ze3",
    question: "「唔该借借」（m4 goi1 ze3 ze3）用在什么场合？",
    options: ["借东西时", "请人让路时", "借钱时", "道歉时"],
    answerIndex: 1,
    explain: "「借借」= 借过让让，人多场合请人让路的礼貌用语。"
  },
  {
    id: "q17-man1",
    question: "粤语里「蚊」（man1）是什么单位？",
    options: ["重量", "钱（元）", "长度", "时间"],
    answerIndex: 1,
    explain: "一百蚊 = 一百块钱。「一蚊鸡」= 一块钱。"
  },
  {
    id: "q17-zung1",
    question: "「一个钟」（jat1 go3 zung1）是多久？",
    options: ["一刻钟", "一小时", "半天", "一分钟"],
    answerIndex: 1,
    explain: "「钟」= 小时：一个钟 = 一小时；一个字 ≈ 五分钟。"
  },
  {
    id: "q17-zi6",
    question: "「三个字」在粤语时间里指多久？",
    options: ["三分钟", "十五分钟", "三十分钟", "三小时"],
    answerIndex: 1,
    explain: "钟面上一个数字间隔五分钟：三个字 = 十五分钟。"
  },
  {
    id: "q17-gam2",
    question: "「系咁先」（hai6 gam2 sin1）一般用来？",
    options: ["开始话题", "结束对话告别", "插话", "提问"],
    answerIndex: 1,
    explain: "「系咁先」= 先这样，电话/道别收尾常用语。"
  },
  {
    id: "q17-dai6-jat6",
    question: "「第日见」（dai6 jat6 gin3）的意思是？",
    options: ["第二天见", "改天见", "当天见", "隔一天见"],
    answerIndex: 1,
    explain: "「第日」= 改天、以后：第日请你食饭 = 改天请你吃饭。"
  },
  {
    id: "q17-sau1-fung1",
    question: "「收风」（sau1 fung1）的意思是？",
    options: ["避风", "打听消息", "感冒", "关窗"],
    answerIndex: 1,
    explain: "「收风」= 打听消息、收集风声。"
  },
  {
    id: "q17-king1-gai2",
    question: "「倾偈」（king1 gai2）的意思是？",
    options: ["搬东西", "聊天", "谈判", "吵架"],
    answerIndex: 1,
    explain: "「倾偈」= 聊天、闲谈：得闲倾偈 = 有空聊聊。"
  },
  // ── 场景（25）──────────────────────────────────────────────
  {
    id: "q17-sc-zousan-reply",
    question: "别人对你说「早晨」，最自然的回应是？",
    options: ["早晨", "晚安", "再见", "多谢"],
    answerIndex: 0,
    explain: "「早晨」= 早上好，回应也用「早晨」。"
  },
  {
    id: "q17-sc-do-ze-vs-m-goi",
    question: "朋友送你一份礼物，道谢应该说？",
    options: ["唔该", "多谢", "系咁先", "冇所谓"],
    answerIndex: 1,
    explain: "受礼/受惠用「多谢」（do6 ze6）；请人办事/感谢服务用「唔该」。"
  },
  {
    id: "q17-sc-m-goi-use",
    question: "请同事帮忙搬文件后，道谢应该说？",
    options: ["多谢", "唔该", "早晨", "有心"],
    answerIndex: 1,
    explain: "麻烦别人出力用「唔该」：唔该晒 = 麻烦你了。"
  },
  {
    id: "q17-sc-apology",
    question: "踩到别人一脚，第一时间应该说？",
    options: ["对唔住", "唔紧要", "冇所谓", "唔使客气"],
    answerIndex: 0,
    explain: "「对唔住」= 对不起；「唔紧要」是对方回应“没关系”。"
  },
  {
    id: "q17-sc-price",
    question: "街市里问价钱，最地道的一句是？",
    options: ["几多钱？", "几号车？", "几点钟？", "边个？"],
    answerIndex: 0,
    explain: "「几多钱」（gei2 do1 cin2）= 多少钱。"
  },
  {
    id: "q17-sc-bargain",
    question: "想讲价便宜一点，应该说？",
    options: ["平啲啦", "贵啲啦", "快啲啦", "多啲啦"],
    answerIndex: 0,
    explain: "「平」（peng2）= 便宜：平啲啦 = 便宜一点吧。"
  },
  {
    id: "q17-sc-discount",
    question: "结账前想问有没有优惠，应该说？",
    options: ["有冇折？", "有冇位？", "有冇事？", "有冇风？"],
    answerIndex: 0,
    explain: "「折」（zit3）= 折扣：有冇折 = 有没有折扣。"
  },
  {
    id: "q17-sc-yumcha",
    question: "「一盅两件」指的是什么场景？",
    options: ["大排档宵夜", "茶楼饮茶吃点心", "家里做饭", "便利店买嘢"],
    answerIndex: 1,
    explain: "一盅茶加两笼点心，是广府饮茶的经典搭配。"
  },
  {
    id: "q17-sc-order",
    question: "茶楼里叫伙计「落单」，是在做什么？",
    options: ["结账", "点餐下单", "占位", "打包"],
    answerIndex: 1,
    explain: "「落单」= 下单点餐；结账是「埋单」。"
  },
  {
    id: "q17-sc-cheers",
    question: "举杯时粤语说？",
    options: ["饮胜", "饮饱", "饮完", "饮茶"],
    answerIndex: 0,
    explain: "「饮胜」（jam2 sing3）= 干杯。"
  },
  {
    id: "q17-sc-treat",
    question: "「今餐我请」更地道的说法是？",
    options: ["我埋单", "请你食饭", "我打包", "我落单"],
    answerIndex: 1,
    explain: "请你食饭 = 我请客；「埋单」是叫结账这个动作。"
  },
  {
    id: "q17-sc-seat",
    question: "进餐厅人多时第一句常问？",
    options: ["有冇位？", "有冇折？", "几号车？", "去边度？"],
    answerIndex: 0,
    explain: "「有冇位」= 有没有位子。"
  },
  {
    id: "q17-sc-taxi",
    question: "坐出租车，粤语动词是？",
    options: ["打的士", "搭的士", "开的士", "推的士"],
    answerIndex: 1,
    explain: "乘搭交通工具用「搭」：搭的士、搭巴士、搭地铁。"
  },
  {
    id: "q17-sc-getoff",
    question: "快到站了，该对司机说？",
    options: ["落车", "开车", "转车", "泊车"],
    answerIndex: 0,
    explain: "「落」= 下：落车、落地铁；上车才用「上」。"
  },
  {
    id: "q17-sc-direction",
    question: "指路说「直行转左」，意思是？",
    options: ["直走然后左转", "左转再直走", "掉头", "右转"],
    answerIndex: 0,
    explain: "「直行」= 直走，「转左」= 左转；转右 = 右转。"
  },
  {
    id: "q17-sc-askhelp",
    question: "请人搭把手帮忙，最自然的一句是？",
    options: ["帮我手", "畀我手", "睇我手", "停我手"],
    answerIndex: 0,
    explain: "「帮我手」= 帮我一下；多谢时可加「唔该晒」。"
  },
  {
    id: "q17-sc-rain",
    question: "出门发现下雨，粤语说？",
    options: ["落雨啊", "打风啊", "好天啊", "出太阳"],
    answerIndex: 0,
    explain: "「落」= 下（雨/雪）：落雨 = 下雨；「打风」= 刮台风。"
  },
  {
    id: "q17-sc-cold",
    question: "寒潮来了，广东人说？",
    options: ["好冻", "好热", "好淡", "好攰"],
    answerIndex: 0,
    explain: "「冻」= 冷：好冻 = 好冷；「热」才是热。"
  },
  {
    id: "q17-sc-time",
    question: "问现在几点，粤语是？",
    options: ["而家几点？", "第日几点？", "几号车？", "几多钱？"],
    answerIndex: 0,
    explain: "「而家」（ji4 gaa1）= 现在。"
  },
  {
    id: "q17-sc-home",
    question: "「我返屋企」的意思是？",
    options: ["我回家了", "我出门了", "我上班了", "我到家了"],
    answerIndex: 0,
    explain: "「返」= 回，屋企 = 家：返屋企 = 回家；返工 = 上班。"
  },
  {
    id: "q17-sc-where",
    question: "「喺边度」是在问什么？",
    options: ["在哪里", "去哪里", "是谁", "什么时候"],
    answerIndex: 0,
    explain: "「喺边度」= 在哪里；「去边度」= 去哪里。"
  },
  {
    id: "q17-sc-notyet",
    question: "「食饭未？」里的「未」表达的是？",
    options: ["疑问“……了没有”", "否定“不要”", "将来时", "推测"],
    answerIndex: 0,
    explain: "句尾「未」= ……了没有：到站未有 = 到站了吗。"
  },
  {
    id: "q17-sc-encourage",
    question: "比赛前给人打气，粤语说？",
    options: ["加油", "收工", "论尽", "是但"],
    answerIndex: 0,
    explain: "「加油」粤语音 gaa1 jau2，用法与普通话一致。"
  },
  {
    id: "q17-sc-slow",
    question: "没听清对方说话，请他再说慢点？",
    options: ["讲慢啲", "讲快啲", "讲多啲", "讲少啲"],
    answerIndex: 0,
    explain: "「讲慢啲」（gong2 maan6 di1）= 说慢一点；没听清可先说「唔好意思，再讲一次」。"
  },
  {
    id: "q17-sc-rest",
    question: "晚上道晚安，可以说？",
    options: ["早啲唞", "早啲起身", "早啲返工", "早啲出街"],
    answerIndex: 0,
    explain: "「早啲唞」= 早点休息，晚安常用语。"
  },
  // ── 拼音与语音（25）────────────────────────────────────────
  {
    id: "q17-jp-m",
    question: "粤拼里「唔」（m4）的声母 m 是什么音？",
    options: ["双唇塞音", "鼻音（双唇闭合气流从鼻腔出）", "擦音", "边音"],
    answerIndex: 1,
    explain: "m 是双唇鼻音，可自成音节：唔 m4、唔该 m4 goi1。"
  },
  {
    id: "q17-jp-ng5",
    question: "数字「五」的粤拼是？",
    options: ["wu5", "ng5", "m5", "um5"],
    answerIndex: 1,
    explain: "「五」读 ng5——ng 可自成音节，这是粤语特色声母。"
  },
  {
    id: "q17-jp-ji6",
    question: "数字「二」的粤语读音是？",
    options: ["ji6", "yi6", "loeng5", "ni6"],
    answerIndex: 0,
    explain: "「二」读 ji6；「两」读 loeng5——量词前用「两」。"
  },
  {
    id: "q17-jp-si-tones",
    question: "「诗、史、试、市」的声调区别是？",
    options: ["声母不同", "韵母不同", "声调不同（si1/si2/si3/si5）", "没有区别"],
    answerIndex: 2,
    explain: "同音节不同调：诗 si1、史 si2、试 si3、市 si5——粤语声调辨义的核心例。"
  },
  {
    id: "q17-jp-leng3",
    question: "「靓」的正确粤拼是？",
    options: ["leng4", "leng3", "ling3", "leng1"],
    answerIndex: 1,
    explain: "「靓」读 leng3（第3声）；粤语第3声是中平调。"
  },
  {
    id: "q17-jp-peng2",
    question: "「平」（便宜）和「平」（平坦）的粤拼分别是？",
    options: ["ping4 / peng2", "peng2 / ping4", "ping4 / ping4", "peng2 / peng2"],
    answerIndex: 0,
    explain: "平坦读 ping4（瓶），便宜读 peng2——破读区分词义。"
  },
  {
    id: "q17-jp-gaai1",
    question: "「街」和「鸡」的粤拼区别在？",
    options: ["声调", "韵母 aa 与 a（长短元音）", "声母", "韵尾"],
    answerIndex: 1,
    explain: "街 gaai1（长 aa）、鸡 gai1（短 a）——长短元音辨义，粤拼必须写清 aa。"
  },
  {
    id: "q17-jp-baat3",
    question: "「八」（baat3）里的 -t 是什么韵尾？",
    options: ["不除阻的塞音尾（入声）", "可听见的 t 音", "鼻音尾", "卷舌尾"],
    answerIndex: 0,
    explain: "入声 -p/-t/-k 只堵住气流不爆破，短促收尾：八 baat3、十 sap6、六 luk6。"
  },
  {
    id: "q17-jp-sap6",
    question: "「十」的粤拼是？",
    options: ["sap6", "sep6", "sab6", "sat6"],
    answerIndex: 0,
    explain: "「十」读 sap6（-p 入声尾）；「实」sat6（-t 尾）、「石」sek6（-k 尾）。"
  },
  {
    id: "q17-jp-jat1",
    question: "「一」的粤拼是？",
    options: ["jat1", "yat1", "jyut1", "jat6"],
    answerIndex: 0,
    explain: "LSHK 粤拼用 j 表示滑音：「一」jat1、「日」jat6、「人」jan4。"
  },
  {
    id: "q17-jp-uk1",
    question: "「屋」（uk1）的韵母是？",
    options: ["uk（短 u + k 入声尾）", "uuk", "uk1 里的 k 可省略", "ouk"],
    answerIndex: 0,
    explain: "uk = 短 u 加 -k 尾：屋 uk1、屋企 uk1 kei2。"
  },
  {
    id: "q17-jp-sam2",
    question: "「谂」（想）和「心」的声调分别是？",
    options: ["sam1 / sam2", "sam2 / sam1", "都是 sam1", "都是 sam2"],
    answerIndex: 1,
    explain: "心 sam1（高平）、谂 sam2（高升）——声调不同意思完全不同。"
  },
  {
    id: "q17-jp-gam2-gam3",
    question: "「噉」（这样）与「咁」（那么）的粤拼分别是？",
    options: ["gam2 / gam3", "gam3 / gam2", "gam2 / gam2", "gaam2 / gam3"],
    answerIndex: 0,
    explain: "噉 gam2（指示“这样”）、咁 gam3（程度“那么”）——声调区别两个虚词。"
  },
  {
    id: "q17-jp-dik1",
    question: "「的士」的「的」粤拼是？",
    options: ["dik1（入声）", "dai1", "di1", "dik6"],
    answerIndex: 0,
    explain: "「的士」dik1 si2 是 taxi 的音译，「的」保留 -k 入声尾。"
  },
  {
    id: "q17-jp-cin2",
    question: "「钱」和「千」的声调分别是？",
    options: ["cin1 / cin2", "cin2 / cin1", "都是 cin1", "cin4 / cin2"],
    answerIndex: 1,
    explain: "千 cin1（高平）、钱 cin2（高升）——粤语声调辨义的日常例。"
  },
  {
    id: "q17-jp-dim2",
    question: "「几点」的「点」（dim2）韵母是？",
    options: ["im（i + m 鼻音尾）", "in", "ing", "iem"],
    answerIndex: 0,
    explain: "dim2 韵母 im：点、掂（dim6/dim1）同韵——m 尾是粤语鼻音尾之一。"
  },
  {
    id: "q17-jp-taai3",
    question: "「太贵」的「太」粤拼是？",
    options: ["taai3（长 aa）", "tai3", "ta3", "tei3"],
    answerIndex: 0,
    explain: "太 taai3；「太」与「替」tai3 一长一短——aa/a 对立的又一例。"
  },
  {
    id: "q17-jp-joeng4",
    question: "「太阳」的「阳」韵母是？",
    options: ["oeng", "oong", "ong", "eong"],
    answerIndex: 0,
    explain: "阳 joeng4：oeng 是粤语特色韵母（圆唇央元音+鼻音尾），如「想」soeng2。"
  },
  {
    id: "q17-jp-jyut6",
    question: "「粤语」的「粤」粤拼是？",
    options: ["jyut6（-t 入声尾）", "jyu6", "jyuk6", "jyt6"],
    answerIndex: 0,
    explain: "粤 jyut6、月 jyut6 同音——韵母 yu 加 -t 尾。"
  },
  {
    id: "q17-jp-heoi3",
    question: "「去」（heoi3）的韵母是？",
    options: ["eoi（圆唇央元音滑向 i）", "eoi 之外的 eo", "ui", "eu"],
    answerIndex: 0,
    explain: "去 heoi3：韵母 eoi；「水」seoi2、「嘴」zeoi3 同韵。"
  },
  {
    id: "q17-jp-neoi2",
    question: "「女」的粤拼是？",
    options: ["neoi2", "nui2", "nei2", "nyu2"],
    answerIndex: 0,
    explain: "女 neoi2、靓女 leng3 neoi2——韵母 eoi。"
  },
  {
    id: "q17-jp-tone-count",
    question: "粤语标准音有几个声调（粤拼调号）？",
    options: ["4 个", "6 个（入声并入 1/3/6）", "9 个", "5 个"],
    answerIndex: 1,
    explain: "粤拼标 6 个调号；传统口诀九声里三个入声并入 1、3、6 调。"
  },
  {
    id: "q17-jp-haa6",
    question: "「下楼」的「下」与「虾」的声调分别是？",
    options: ["haa6 / haa1", "haa1 / haa6", "haa4 / haa1", "都是 haa1"],
    answerIndex: 0,
    explain: "虾 haa1（高平）、下 haa6（低平）——低平调是粤语的低调值调型。"
  },
  {
    id: "q17-jp-bin1",
    question: "「边度」的「边」粤拼是？",
    options: ["bin1", "bin6", "bin3", "bim1"],
    answerIndex: 0,
    explain: "边 bin1（-n 鼻音尾）：边度 bin1 dou6 = 哪里。"
  },
  {
    id: "q17-jp-man1-man4",
    question: "「蚊」（钱）和「文」的粤拼分别是？",
    options: ["man1 / man4", "man4 / man1", "都是 man1", "maan1 / man4"],
    answerIndex: 0,
    explain: "蚊 man1（本币单位）、文 man4——声调区分。注意「晚」maan5 是长 aa。"
  }
];
