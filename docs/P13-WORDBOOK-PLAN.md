# P13 · 词林拾遗（词库图鉴 × 辨音小考 × 语言力量化）详细方案

> 2026-09-20 · GROWTH-PLAN §5 的实施文档。把「练过的句子」变成可收集、可听辨、可选构筑的力量——**感知通道**（听）与**产出通道**（说）首次闭环。
> 本期新增内容只经版本门控进入 p7 新局；旧局（无 masteryPowerVersion、legacy 规则集）逐位不变。
> 总纪律继承 AGENTS.md：零后端、隐私不出设备（只存分数聚合，禁录音/F0 帧）、零素材、≤350KB gzip、reduce-motion、确定性。

## 0. 三条设计红线

1. **奖励不出售强度**：词林收集只给「称号 + 主题」等纯装饰；战斗数值单独由 `masteryPowerVersion` 门控，且必须过 `sim:p13` 带内校准。
2. **感知不污染产出统计**：听辨答错只进「产出队列」（错词本），**不计入** `stats.voiceAttempts` 等发音均值——听对了不等于说对了。
3. **无粤语音色就诚实跳过**：听音题依赖 TTS；本机无粤语音色（zh-HK / Cantonese / yue）时，问答节点**过滤掉听音题**并提示原因，绝不用普通话音色冒充（那会把「听辨」变成错误示范）。

## 1. 数据地基：音节掌握度（SRS 扩展）

`SrsStore` 增可选字段（旧档缺失 = 空，导入导出沿用白名单）：

```ts
export interface SyllableStat { attempts: number; sumScore: number; bestScore: number; lastScore: number }
// store.syllables: Record<skillId, SyllableStat[]>   // 下标 = 音节序号
```

- 数据源：`recordAttempt` 已有的 `toneSyllableScores`（端侧引擎的逐音节调准分）；**无声通道/QTE 不产生该数据**，因此不产生掌握度——诚实降级。
- 只存整数聚合（次数 / 和 / 最好 / 最近），不含文本、时间戳与 F0 帧；`normalizeSyllableMastery` 做上限钳制（attempts ≤ 100000、分数 0–100、音节数 ≤ 32）。
- `enqueueListeningMiss(store, skillId, now)`：听辨答错 → 该句**进/更新错词本**（lapses+1、间隔回 1 天、ease-0.2），但不触碰任何发音统计。这是研究推荐的「感知→产出」闭环入口。

## 2. 辨音题库 `src/core/listening.ts`（纯函数）

两类题，全部可溯源、无编造语言事实：

| 类型 | 题干（TTS 念） | 选项 | 说明 |
|---|---|---|---|
| `phrase` 声调对立 | 游戏短语的汉字（如「好犀利」） | 4 条粤拼：正确 + 3 个**只改一个音节调号**的变体 | 词表取自 `ALL_SKILLS`，优先玩家已收录/练过的短语（学以致用） |
| `pair` 声母/韵母/声调对立 | 策展最小对立对的汉字（如「三」） | 4 个真实词（汉字 + 粤拼） | 词表为语言事实核对过的经典对立：三 saam1 / 心 sam1、新 san1 / 生 sang1、你 nei5 / 李 lei5、诗·史·试·时·市·事（si 六调）等 |

- `listeningPoolFor(seenIds, { limit })`：确定性建池——先由**已收录短语**派生声调题（每句最多 1 题，音节与改调位置由 id 散列决定，不消耗引擎 RNG），再追加策展对话题；同一输入必得同一池。
- `listeningQuestionFromPhrase(skill, seenIds)` / `listeningQuestions()`：纯函数，可单测；选项去重、答案唯一、干扰项与原句只差一个调。
- 会话状态只在 UI 内存（本轮答对/答错计数）；持久化的只有：错题入队（§1）+ `stats.listeningAttempts/listeningCorrect` 两个聚合计数（学习报告展示听辨正确率）。

### 问答节点题池（30 题）

`src/core/content/listening.ts` 导出 `LISTENING_QUIZ: QuizQuestion[]`（`requiresAudio: true`，题干含 `audio` 字段）：

- 题池组装 `quizPoolFor(ruleset, voiceAvailable)`：
  - legacy → 基础 18 题（逐位不变）；
  - p7 + 有粤语音色 → 基础 + 30 听音题；
  - p7 + 无粤语音色 → 基础池 + 房间提示「本机无粤语音色，跳过听音题」。
- 过滤发生在**建池**（纯函数），选池仍用同一 `pickDistinct`（同 RNG 步数），因此同 (act, seed, 音色可用性) 必同题；音色可用性属于设备能力，不由种子决定（与「同码同局」无关：切磋局的题池大小随设备能力，属预期差异，文档化）。

## 3. 语言力量化 `src/core/mastery.ts`（纯规则）

**⚠ 机制已改（原案「+1/+2 威力」经仿真证伪，勿按旧文回退）**：定案为**判定保底**。

```ts
masteryEnabled(state)                     // masteryPowerVersion===1 && ruleset==="p7"
skillMasteryView(store, skillId, tones)   // 三档视图：逐音节 attempts/平均/best/tone/toneName/reached
masteryFloorFor(store, skillId, tones)    // 0 | 65（= MASTERY_FLOOR）
masteryJudgeScore(score, floor, tierKeyOf) // { judged, applied, rescued }
```

| 档 | 条件（**每个音节**都要满足） | 判定保底 |
|---|---|---|
| 0 | 任一音节尝试 < 2 次，或均分 < 80 | 0（判定逐位不变） |
| 1 | 每音节尝试 ≥ 2 次且均分 ≥ 80 | 65（清晰） |
| 2 | 每音节尝试 ≥ 3 次且均分 ≥ 92 | 65（清晰，与 tier1 在威力上等价） |

- 引擎侧：`judgedScore = max(score, min(floor, 84))`，**只用于取档位**；`scaledPower = round(skill.power × 档位倍率)`。
  裸分、`stats.*`、彩（`bravoTransition` 看 rawScore）、分数历史全部不变——「练透了不容易塌方」，不是「练透了更猛」。
- **保底 65 严格低于正音线 85**：词林永远不制造「正音」（正音必须当场唱准，与 P11「彩要真本事」同源）。这是本机制能过带内门的原因，单元测试锁定。
- 高于 65 的保底（如 80）在现行档位表（未稳<40 / 入门<65 / 清晰<85 / 正音≥85）下**不改变档位**，故不设；tier2 的真实回报走非强度出口（点数 6 vs 12、称号、主题）。
- 引擎侧另有仿真仪表 `engine.masterySaves`（保底真正救回档位的次数；掌握关恒为 0），仅用于报告与仿真断言，不参与任何判定与结算。
- 组合根注入：`engine.masteryProvider = (skillId, syllables) => masteryFloorFor(loadSrsStore(), ...)`；音节数与内容不一致按 0 处理（宁可少给，不给错）；缺省 undefined = 旧局零接触。引擎内核仍零 IO。
- UI：战斗卡面显示「词林」标记（title 说明保底语义）；练习场与词林页签显示逐音节掌握度。

## 4. 词林图鉴 `src/core/wordbook.ts` + UI 页签

- 条目来源：`ALL_SKILLS`（技能 / 反击 / 签名技 / 绝技，带粤拼与六调）+ 全部奇遇标题（**场景词**，无粤拼不评掌握度）。
- 每条目：`collected`（图鉴已点亮）、`mastery`（tier、均分、达标音节/总音节）。
- **词林点数**（纯装饰）：收录 +2；掌握度 tier1 +6、tier2 +12（取最高不叠加）。
- **称号**（纯装饰，页签头部与标题屏显示）：新声 0 / 识曲 20 / 通韵 60 / 六调了然 120 / 词林班主 200。
- **练习场主题**：`THEME_DEFS` 增「词林」主题，门槛改为 `{ achievements | codex }` 双源——既有两档仍是成就点，新增档为词林点数 ≥ 80。设置页与成就页文案展示对应门槛。
- UI：图鉴页改为两页签（`词林拾遗` / `登楼履痕`），词林页签含点数进度条、称号、每句掌握度条与「去练习」按钮。

## 5. 仿真与验收（`npm run sim:p13` → docs/P13-BALANCE-REPORT.md）

- 行 1「掌握关」：`masteryPowerVersion=1` 但无掌握数据 → 与 P11/P12 基线**九格逐位一致**（`wins` 精确相等，契约测试锁定）。
- 行 2「起始牌组全掌握 tier2」：合成 SRS 档案（每音节 4 次 × 95 分）注入，仅起始牌组范围（现实上界）。
- 行 3「全卡池掌握 tier2」：理论最坏上界（要求 43 句全部每音节 ≥3 次且均分 ≥92）。
- 门：三角色三幕 × 三档全部落 45–65%、零超时；**每格 300 局**（120 局时噪声会导致掌握关行误报 66.7%）。
- 报表另带「保底救场/局」列（= `masterySaves`/runs，只在档位真被救回时计数），证明机制在运转而非空转。

## 6. 测试与验收

- `tests/unit/srs-mastery.test.ts`：音节聚合、归一化钳制、`enqueueListeningMiss` 不改发音统计。
- `tests/unit/mastery.test.ts`：三档边界（次数/均分）、缺音节不外推、保底语义（救场/同档内不计数/无保底逐位不变）、「保底线 < 正音线」硬约束、门控。
- `tests/unit/listening.test.ts`：派生题唯一答案与单音节差异、池稳定性、策展词表一致性（选项唯一、答案存在）、会话统计。
- `tests/unit/wordbook.test.ts`：点数/称号阈值、掌握度映射、条目来源完整性（技能 + 绝技 + 奇遇全收录）。
- `tests/contract/p13-wordbook.test.ts`：门控（legacy 与未开启局零接触）；保底只动档位（裸分/统计逐位不变，伤害差经档位倍率）；保底不制造正音（84 仍清晰）；`quizPoolFor` 三态池 + 同种子同题；词林数据**不含任何战斗字段**（白名单）。
- `tests/sim/p13-balance.test.ts`：带内 + 零超时 + 掌握关逐位一致。
- `tests/e2e/p13.spec.ts`：图鉴词林页签（点数/称号/掌握度）、练习场听音辨字全流程（播放 → 作答 → 答错入队提示）、卡面「已入词林」标记。
- 全量门 + 预算 + 七条仿真与 P11 基线零漂移（P7/P8/P9/P10/P11 报表逐位一致，基础报表仅时间戳不同）。

## 7. 明确不做

- 不做发音分数上传/云同步、不做真人音色评分模型、不做听力排行榜。
- 不做汉语以外的语言、不做自动生成新词（词表全部来自既有内容或核对过的语言事实）。
- 不做「听对就加战力」（感知只进产出队列）；不做掌握度影响血量/敌人曲线。

## 8. 实施与验收记录（2026-09-20 回填）

### 8.1 与原方案的三处差异（均已定案，勿按旧文回退）

1. **力量化 = 判定保底，不是加威力**。原案「每音节课 ≥80 → +1 威力，≥92 → +2」在仿真里连过两轮证伪：
   无门槛 +2 威力 → 全掌握行 92.5–100%；限「正音」才给威力 → 花旦一幕仍 76.7%（带上沿 65%）。
   第三轮改「判定加成 +1/+2」仍越带（花旦一幕 69.0%），扫描发现**越带 100% 来自「正音」门槛**。
   终案把保底值钉在 65（清晰）且**一律低于正音线 85** → 27 格全带内（完整数据见 `docs/P13-BALANCE-REPORT.md` §校准）。
2. **题池三态而非两态**：`quizPoolFor(ruleset, voiceAvailable)` → legacy 18 题逐位不变；p7 有粤语音色 = 18 + 30；p7 无音色 = 18 且如实报告跳过数（房间提示，不静默）。
3. **分数聚合入口收敛为纯函数**：音节聚合只经 `accumulateSyllableMastery`（`recordAttempt` 内调用），不再维护「统计视图 + 聚合」双写。

### 8.2 落地清单

- 核心层：`src/core/mastery.ts`、`src/core/listening.ts`（6 组策展最小对立对 + 短语派生题）、`src/core/wordbook.ts`、`src/core/content/listening.ts`（`LISTENING_QUIZ` 30 题 = 18 pair + 12 phrase）。
- 扩展：`srs.ts`（`SyllableStat`/`syllables`/`enqueueListeningMiss`/`recordListeningAttempt`/`normalizeSyllableMastery`）、
  `engine.ts`（`masteryPowerVersion` 门控、`masteryProvider`/`quizVoiceAvailable` 注入点、`startQuiz` 池化、`resolveSkill` 判定保底、`masterySaves` 仪表）、
  `sim.ts`（`masteryProfile` 合成档案注入）、`learning-archive.ts` + `adapters/storage.ts`（白名单与归一）、`adapters/tts.ts`（`cantoneseAvailable`）。
- UI：图鉴双页签（登楼履痕 / 词林拾遗）、练习场双模式（跟读校准 / 听音辨字，含播放→作答→解析→小结与「诚实跳过」页）、街坊问答 🔊 播放（**只在点按时播放**，无音色时按钮禁用并说明）、卡面「词林」标记、学习报告听辨正确率、`THEME_DEFS` 增「词林」主题（双源门槛 80）。
- 测试：unit 4 新（srs-mastery / mastery / listening / wordbook）+ contract 1 新（p13-wordbook）+ sim 1 新（p13-balance）+ e2e 1 新（p13，4 例）。

### 8.3 验收数字（2026-09-20）

- `npm run sim:p13`：27 格全部带内、零超时；掌握关九格 `wins` 与 P11 基线逐位一致（189/177/169 · 193/181/177 · 185/175/156）；保底救场 1.5–3.8 次/局。
- 质量门：biome 150 文件 ✅ / tsc ✅ / vitest **489** ✅ / E2E **50** ✅ / perf **104.7/350 KB gzip** ✅ / release-readiness 44 ✅。
- 七条旧仿真（sim/p7/p8/p8b/p9/p10/p11）报表与基线零漂移。
- 参考截图：`outputs/p13-wordbook-tab.png`、`p13-listening.png`、`p13-listening-skip.png`、`p13-card-mark.png`。

### 8.4 诚实边界

- 听辨正确率依赖本机粤语音色；无音色设备上该题池整题跳过，**设备能力差异会进入体验差异**（报告如实标注，不用别的口音冒充）。
- 判定保底在现行档位表下与 tier1/tier2 的威力等价；tier2 的回报是非强度性的（点数/称号/主题）。若未来档位表加档（如 65–74 与 75–84 分层），需要重跑 `sim:p13` 并重新校准保底值。
- 真人听感（粤语音色清晰度、最小对立对的听辨难度）需真人试玩校准，Bot 无法替代。
