# P15 · 铸剑炉（工程加固 + 构建期内容管线）详细方案

> 2026-09-22 · GROWTH-PLAN §7 的实施文档，P10–P15 路线的收官期。三条主线：
> **① fast-check 属性测试**（确定性/存档往返/切磋码/地图/评分五组不变量 + P14 起全部新纯函数）；
> **② Playwright 视觉回归**（4 屏 × 2 视口 × reduce-motion）；
> **③ 构建期 AI 内容管线**（事件 26→38、问答 +30 粤语文化题、遗物 +6 带流派标签）——运行时零 AI，全部静态数据。
> 总纪律继承 AGENTS.md：零后端、隐私不出设备、零素材、≤350KB gzip、reduce-motion、确定性、旧局逐位不变。
> 两条红线：① 内容扩容**只进 `forgeVersion:1` 的 p7 新局**（缺失 = 与 P14 逐位一致）；② 属性测试与视觉回归**只加门不放宽旧门**。

## 0. 现状核对

| 项 | 现状 | P15 的判断 |
|---|---|---|
| 确定性/存档测试 | 契约层示例式（固定种子列表，如地图 20 种子） | 缺口：覆盖面靠人工选点；任意命令序列/任意种子没有系统验证 → 属性测试 |
| 视觉回归 | 无（只有 `outputs/` 人工截图） | 缺口：样式/布局回归只能靠人眼；Playwright `toHaveScreenshot` 零新运行时依赖 |
| 内容规模 | 事件 26（基础 13 + P7 扩展 13）、遗物 15、文字题 8 + 听音 30 | 缺口：act2/3 事件密度低于 act1；文化题缺位；遗物无流派呼应 |
| 运行时 AI | 无 | **坚持不做**（GROWTH-PLAN §0.3 已拒绝运行时 LLM）；AI 只在构建期起草静态数据 |

## 1. F1 · fast-check 属性测试（dev-only 依赖）

**依赖申报**：`fast-check`（MIT，仅 devDependencies，不进运行时、不进首包预算）。

### 1.1 五组核心不变量（GROWTH-PLAN §7.1 表）

落点 `tests/property/`（vitest 收编，与单测/契约同跑 `npx vitest run`）：

| 文件 | 属性 | 生成器 |
|---|---|---|
| `engine-determinism.test.ts` | 任意种子 × 任意合法命令序列，重放两次终局状态深等价；同种子两次独立运行亦等价 | `fc.integer` 种子 + Bot 决策流的随机带（命令由引擎**合法选项**中选，绝不注入非法命令） |
| `save-roundtrip.test.ts` | 任意推进深度的状态经 `JSON.parse(JSON.stringify(state))` 深等价（存档即序列化） | 同上，随机深度截停后快照 |
| `challenge-code.test.ts` | ① 任意合法 bundle：`decode(encode(b)).challenge` 与 `b` 逐位恒等（哈希亦同）；② 任意字符串（含畸形/截断/非 ASCII/超长）：解码不抛异常、只回 `ok:false` 或合法结果；③ 成功编码长度 ≤ `CHALLENGE_MAX_LENGTH` | bundle 字段逐项任意（幕钳到 [1,3]、seed 全 32 位、词缀取自 `MUTATORS`） |
| `map-invariants.test.ts` | 任意种子：`validateActMap` 零违规（≥2 起点 / Boss 唯一顶点 / 相邻行连边 / 无交叉 / 全图可达）——把契约层 20 种子示例升级为属性 | `fc.integer`（300 例，快） |
| `scoring-monotonic.test.ts` | 档位判定/钳制对分数单调不降：`x ≤ y ⟹ tier(x) ≤ tier(y)`、`clamp` 幂等 | `fc.double`/`fc.integer` 于 [0,100] |

### 1.2 P14 起新纯函数的属性补强（GROWTH-PLAN §8「属性测试覆盖全部新纯函数」）

- `endpoint.ts`：任意帧序列事件合法性（`speech-start` 每段一次、`auto-stop` 只在 start 之后、收口时延恒 = `MIN_SILENCE_MS`±一窗、`reset` 后零记忆）。
- `difficulty.ts`：任意 rating/won 序列更新后仍在 [0, 3000] 合理带、`boostFor` 恒 ∈ [−0.15, 0.15]、无数据 = 0、纯函数无副作用（入参对象逐位不变）。

**预算**：每组属性 ≤200 例、单文件 <10s（属性测试进默认 `vitest run`，不能让全门显著变慢）。

## 2. F2 · Playwright 视觉回归

- 独立配置 `playwright.visual.config.ts`（Chromium only、`snapshotPathTemplate` 固定），脚本 `npm run test:visual`；基线随仓库提交（`tests/e2e/visual/*.spec.ts-snapshots/`）。
- 4 屏 × 2 视口（390 / 1280）× `reduce-motion` 开 = 16 基线：
  1. **标题屏**（默认存档预设，禁动画）；
  2. **战斗屏**（`__VOICE_TOWER__.startCampaign` 固定种子直入，取开战第一帧静态画面）；
  3. **学习报告**（练习场/六调画像页，预置合成档案）；
  4. **词林图鉴**（图鉴页签，含词条卡）。
- 稳定化（防假阳）：预设档一律 `sound/music:false`、`reduceMotion:true`、`tutorialSeen:true`；字体走系统栈（无外部字体加载）；`toHaveScreenshot({ maxDiffPixelRatio: 0.01 })`。
- **边界**：视觉门只拦布局/样式回归，不验证逻辑；基线更新必须人工过目后 `--update-snapshots` 并提交。

## 3. F3 · 构建期内容管线：`forgeVersion:1` 内容扩容

> 流程即 GROWTH-PLAN §7.3：**AI 起草 → 人工审校 → 版本化入池 → 仿真门校准**。
> 本期由 AI 代理（本次会话）起草全部静态数据；人审在提交前进行（数据全部集中于
> `src/core/content/forge.ts` 单文件，审校面 = 一个文件）。**运行时零 AI 推理**。

### 3.1 版本门控（一期一档一门）

- `CampaignConfig.forgeVersion?: 1` → `GameState.forgeVersion?: 1`；仅 `ruleset === "p7"` 生效；
  缺失 = P14 逐位行为（内容池、抽选、问答逐位不变）。
- 切磋码版本束增列 `forge`（紧凑字段 `f`）：**旧码无此字段 = 旧内容池，逐位同局（零破坏）**；
  新码携带则开锻造内容——同码同局契约对两种码各自成立。
- 新战役 UI 入口（名伶选择后 `startCampaign`）加 `forgeVersion: 1`，与 roster/ultimate 同列。

### 3.2 内容数据（全部在 `src/core/content/forge.ts`）

| 类别 | 数量 | 入池路径 | 红线 |
|---|---|---|---|
| 事件 | 12（每幕 4，粤剧行话/戏棚民俗题材） | `eventsFor(act, ruleset, forgeVersion)` —— 仅 p7+forge 追加；**不改** `EXPANSION_EVENTS` | 事件只走既有 `GameEventContent` 形状，不加新效果类型 |
| 遗物 | 6（带 `school` 流派标签，呼应 P8-A 构筑流派） | **首胜确定性授予**（仿校准 R1→R4 定案）：`finishCombatVictory` 按（角色×幕）槽位授予一件，`forgeRelicGranted` 一局一件；**不入** `relicsUpToAct` 任何随机池（防池稀释） | `Relic.school?: string` 为**展示字段**（数据形状追加、旧数据缺省），不含战斗判定逻辑 |
| 问答 | +30 粤语文化题（典故/俗语/节庆，非听音题；答案位置 8/8/7/7 均匀分布） | `quizPoolFor(ruleset, voiceAvailable, forgeVersion)` —— 仅 p7+forge 追加；基础 8 题与听音 30 题逐位不变 | 题形沿用 `QuizQuestion`，无新字段 |

- **入池纪律**（AGENTS.md）：新内容只经三个 `*For` 查询函数进入对应新局；基础内容表零改动；
  抽选仍走引擎既有 `pick`（同种子同版本束 → 同抽选序列）。
- 内容扩容后首包体积复核：若超预算再做 act2/3 懒加载分块（本期预期不需要，报表留证）。

### 3.3 仿真门 `npm run sim:p15`

- 脚本 `scripts/p15-balance.ts`（沿用 `simulateAct`）：
  - 行 1「基线」：P13 基线配置**不带** `forgeVersion` —— 必须与 P11/P13 历史基线逐位一致（零漂移证明）；
  - 行 2+「锻造」：三角色 × 三幕 × greedy × `forgeVersion:1`，胜率带 45–65%、零超时；
  - 附注事件/遗物实际抽中计数（新内容真的进局证据；若某幕新事件抽中为 0 须说明）。
- 300 局/格（P13 教训：120 局噪声误报）。

## 4. 明确不做

- 不做运行时 AI/在线内容生成（GROWTH-PLAN §0.3 记录性决策，不再反复评估）。
- 不动 `EXPANSION_*` 既有池与基础表；不改任何旧版本束语义（切磋码旧码零破坏）。
- 不改平衡曲线：锻造内容若拉偏胜率，只调**锻造自有数据**（事件收益/遗物强度），不碰引擎数值。
- 不做跨浏览器视觉门（渲染差异大，收益低）——只锁 Chromium；其余浏览器仍由发布矩阵覆盖。

## 5. 里程碑

- **F1** `npm i -D fast-check` + `tests/property/` 七文件（五组不变量 + endpoint/difficulty）。
- **F2** `forge.ts` 内容数据 + 三个 `*For` 扩参 + 引擎接线 + 切磋码版本束 + UI 入口。
- **F3** 视觉回归（配置 + 16 基线 + `test:visual`）。
- **F4** `sim:p15` + 全门（含既有八仿真零漂移）+ 文档回填 + CI 增列（视觉门）。

## 6. 实施记录（2026-09-22 回填）

### 6.1 与原方案的三处差异（均已定案）

1. **流派遗物不入随机池**：原案写「`relicsFor` 并入累计池」——仿真 R1 证伪：并入后池 15→21，
   弱遗物稀释强遗物抽取（短局约 3 次遗物获取被系统性削弱），锻造行暴跌至 29.7–45.3%。
   定案：六件遗物改为锻造局**首胜按（角色×幕）槽位确定性授予**（三角色×三幕九槽位覆盖全部六件），
   宝箱/精英/夜市/事件换取池逐位不变。
2. **小额校准四轮**（只调锻造自有数据）：守夜铁牌 +3→+2、镇楼老鼓 +3→+2→+1、一幕事件
   小额下调（抡锤 16→15、看摊 15→14、打赏 14→12、叹茶 14→12、讲古改 12 两）——花旦幕1 从 66.3% 回带。
3. **视觉门 reduce-motion 双态**：16 基线含开/关两态，连续两轮自比 16/16 稳定后才提交；CI 需
   `fonts-noto-cjk` 保证中文渲染一致（基线生成机已安装）。

### 6.2 落地清单

- 属性测试（`fast-check` dev-only，v4 API）：`tests/property/` 七文件 23 例——引擎确定性（含全版本束×forge
  组合两整局重放，唯一排除 `stats.startedAt` 墙钟字段并注释说明）、存档往返（observe 每 25 步抽帧）、
  切磋码（合法 bundle 200 例恒等 + 畸形/截断/非 ASCII 300 例零副作用 + 前缀截断）、地图 300 种子、
  评分/保底单调、端点策略事件合法性、难度评级有界纯净。
- 内容：`src/core/content/forge.ts`（12 事件 / 6 遗物 / 30 文化题，答案位置轮转 8/8/7/7）。
- 接线：`CampaignConfig/GameState.forgeVersion`、`GameState.forgeRelicGranted`、`CombatState.forgeUsed`、
  六处遗物钩子（`forgeConsume`）、`eventsFor/quizPoolFor` 第三参、切磋码版本束 `forge`（字段 `f`）、
  UI 新战役 `forgeVersion:1` + 遗物流派标签展示、`__VOICE_TOWER__` 既有调试口不变。
- 门：`tests/contract/p15-forge.test.ts` 14 例（门控/零漂移/码零破坏/首胜授予/每场一次）；
  `tests/sim/p15-balance.test.ts` 7 例（带内/基线逐位/事件 12/12 遗物 6/6）；
  `tests/e2e/visual/screens.spec.ts` + `playwright.visual.config.ts` 16 基线；
  P7 契约更新事件规模 26→38（唯一动的旧契约，理由即本期扩容）。
- `sim.ts` 两个增量钩子：`observe`（中途抽帧）/`captureFinalState`（终局引用），仿真/属性共用。

### 6.3 验收数字（2026-09-22）

- 仿真：基线行与 P11/P12/P13 基线**九格逐位一致**（189/177/169、193/181/177、185/175/156）；
  锻造行 52.3–64.3% 全带内、零超时；事件 12/12、遗物 6/6 入局。
- 全门：biome ✅ / tsc ✅ / vitest **562** ✅ / 视觉 16/16（两轮自比稳定）/ E2E 待终跑。
- 属性测试全门耗时 +5s（属性例均 ≤200，引擎确定性每例两整局）。

### 6.4 诚实边界

- 视觉基线生成于本机 Chromium（headless shell 153）；跨机器字体差异由 `fonts-noto-cjk` + 0.01 容差兜底，
  CI 首跑若假阳需 `--update-snapshots` 人工过目重提（不视为失败掩盖）。
- 仿真越带判定是固定种子流的确定性结果；±2.75pp 量级的单格波动属种子运气，校准只动锻造自有数据。
- 流派遗物「每场一次」数值小额，不构成构筑强度出口；收集回报在图鉴展示层。
