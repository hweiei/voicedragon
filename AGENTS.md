# AGENTS.md · AI 协作工作流（本仓库）

> 面向 AI 编码代理的项目守则。人类开发者同样可读。
> 本仓库是《声震龙楼》——粤语语音驱动的爬塔 Roguelike（Vite + TS strict + PWA，零后端）。

## 0. 代码理解：先用 codegraph，别上来就全仓 grep

仓库已接入 [@colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)（本地代码知识图谱，100% 离线，无遥测）。
任何"这个符号在哪 / 谁调用了它 / 改它会影响谁 / 这个任务涉及哪些模块"的问题，
**先查图再读码**，把读文件留给真正需要逐行细节的时刻：

```bash
npm i                      # node_modules 不在快照内，新会话先装依赖（含 codegraph）
npm run codegraph          # 首次/索引缺失时重建（本仓库通常 <1s）
npm run codegraph:sync     # 代码改动后增量同步

npx codegraph query <符号名>          # 定位符号
npx codegraph node <符号名>           # 单符号源码 + 调用/被调用链
npx codegraph callers <符号名>        # 谁调用了它
npx codegraph impact <符号名>         # 改动影响面分析（重构前必查）
npx codegraph context <任务描述…>     # 任务级上下文聚合（开工前跑一次）
npx codegraph explore <问题…>         # 区域探索：相关符号源码 + 调用路径
```

索引存于 `.codegraph/`（已被其自带 .gitignore 排除，勿提交）。
大改一批文件后记得 `npm run codegraph:sync` 保持图新鲜。

## 1. 架构纪律（六边形 / 端口-适配器）

- `src/core/` 是**纯领域内核**：零 DOM、零 IO、零随机（mulberry32 种子显式传递）。
  任何 PR 若触碰内核签名，必须先说明理由；特效/演出层（`src/ui/`）**只消费**
  `engine.emit` 事件，不反向写入。
- `src/adapters/` 是端口实现（audio/tts/voice/storage/platform）。
- `src/ui/` 渲染与演出：模板字符串直渲 + `src/ui/fx/` 演出编排（FxDirector）。
- 设计决策的单一事实源：`docs/REDESIGN-PLAN.md`（P0–P5 历史）与
  `docs/FX-UPGRADE-PLAN.md`（P6 三期完成）及 `docs/CONTENT-EXPANSION-PLAN.md`（P7 三幕深耕）与 `docs/BUILDCRAFT-PLAN.md`（P8-A 构筑成型）、`docs/ENCOUNTER-EVOLUTION-PLAN.md`（P8-B 对手进化）、`docs/VOICE-MASTERY-PLAN.md`（P8-C 语音深化）、`docs/LEARNING-LOOP-PLAN.md`（P8-D 学习闭环）、`docs/RELEASE-READINESS-PLAN.md`（P8-E 发布与设备验收）与
  `docs/COUNTER-ATTACK-PLAN.md`（P9 守势反击）、`docs/GROWTH-PLAN.md`（P10–P15 丰富度总路线）与
  `docs/ROSTER-PLAN.md`（P10 名伶登场）、`docs/ULTIMATE-PLAN.md`（P11 声动九霄）、
  `docs/P12-CHALLENGE-PLAN.md`（P12 切磋码）。
- 内容兼容：缺失 `ruleset` 的旧局按 legacy；P7 新内容只经 `skillsFor/eventsFor/itemsFor` 进入对应新局。
  不直接修改基础内容表或用扩展池替换基础池。新增参数须审查组合根包装器是否完整转发。
- 构筑独立版本 `buildVersion:1` 仅用于新战役；缺失时保留旧玩法。升级按 `upgradedSlots` 记录具体牌组槽位，
  不改原 skillId；删牌必须重映射槽位；P8 施法必须从 UI/模拟器传入 deckIndex，不能按同名技能猜副本。

- 对手独立版本 `encounterVersion:1` 仅用于p7新战役；与build版本分离。第五个startCampaign参数必须经组合根完整转发。
  Boss半血只标记pending，本回合旧意图结算后才提交阶段；不能中途换招/锁血/重放读档切换。阶段pattern必须克隆。
  预测与实际受击共用纯规则，龙鳞逐段触发，穿甲不耗甲、不补甲；新平衡只改P8-B曲线。
- P8-C 音节诊断只解释已有调准结果，不能改 DTW 分数或战斗权重。`detectedTones` 只在异调斜率与距离优势均显著时报告；
  Web Speech / QTE 不伪造 F0 结论。SRS 沿用 v1 键并补齐 `toneMastery`，只存分数聚合，禁止持久化录音或 F0 帧。
- P8-D 日历历史只保留最多 90 个练习日的分数聚合和不同技能 ID；每日目标按 3 个不同短句计数，连续天数不提供战斗加成。
  学习档案固定 `kind: voice-tower-learning` / `version: 1`，严格白名单、上限 1 MiB；导入须预览后二次确认并覆盖恢复，不盲目累加聚合数据。
- P8-E 发布必须同时通过默认相对 base 与 GitHub Pages `/voicedragon/` 产物契约；CSP 变更须保留同源 Worker、Blob AudioWorklet/WASM 与 Hugging Face CDN 下载。
  Playwright WebKit 模拟不等于 Safari 真机；离线模拟器限制必须明确 skip 并留在 `docs/DEVICE-TEST-MATRIX.md`，不得写成已通过。
- P9 反击独立版本 `counterVersion:1` 仅用于新战役；与 build/encounter 版本分离。startCampaign 第六参数必须经组合根完整转发。
  反击卡只经 `skillsFor(act,"p7",1)` 进入卡池；Skill.counter 是数据化字段，旧内容缺省无。
  还击纯规则在 `src/core/counter.ts`，预测与实际结算共用；穿甲不触发不消耗、无伤害回合保留姿态、guardAttack 先得甲再吃还击。
  还击结算次序：敌方行动完全结算后、层甲词缀与状态递减前；可击杀、可跨 Boss 半血（同回合提交二阶段）。
  新平衡只调 P9 自有参数（技能威力/ratio/Bot 估值），不改 P8-B 曲线；`npm run sim:p9` 独立分报。
- P10 名伶独立版本 `rosterVersion:1` 仅用于新战役；与 build/encounter/counter 版本分离。startCampaign 新首选
  `CampaignConfig` 参数对象（旧位置签名等价转发，加参数一律走 config 不再加位置参数）；组合根归一化两种形态。
  角色被动纯规则在 `src/core/roster.ts`，一次性标记存 `combat.passives`（回合标记 endTurn 重置）；
  签名技只经 `skillsFor(act,"p7",counter,character)` 进对应角色池。花旦被动依赖 toneScore（无声通道诚实不触发）；
  丑生被动仅 QTE 通道。新战役 UI 入口先弹名伶选择（E2E 走 UI 入口需补选角步骤）。
  新平衡只调角色自有参数（牌组/被动阈值/签名技），`npm run sim:p10` 独立分报（花旦=牌组下限、丑生=qte 乐观界，报告如实标注）。
- P11 绝技独立版本 `ultimateVersion:1` 仅用于新战役（ruleset "p7"）；与 roster 版本分离，config 参数对象直通。
  彩规则看**裸分**（≥85 蓄/<65 断/其间保持，封顶 3，每场绝技一次）；纯规则 `src/core/bravo.ts` 预测与结算共用。
  绝技句在 `src/core/content/ultimates.ts`，只进 ALL_SKILLS（图鉴/练习场/SRS），**不进任何 skillsFor 卡池**。
  sim Bot 发动绝技被守卫拒绝时必须回落出牌（否则 once-per-battle 死循环）。`npm run sim:p11` 独立分报。
- P12 切磋码独立版本 `challengeVersion:1` 只出现在经码开局的局；`GameState.duel` 记录码身份（码/哈希/模式/幕/种子），
  旧局无此字段 = 零漂移。编解码与校验全部在 `src/core/challenge.ts` 纯函数：**拒绝路径不抛异常、不改状态**，
  版本束不支持（`unsupported`）或内容世代重算不符（`mismatch`）一律 `ok:false`，UI 明确拒绝，**不静默降级**。
  码内白名单只含 幕/种子/规则集/版本束/角色/日期键/词缀/自适应加成——不含昵称、时间与设备信息。
  切磋局不读本机自适应节律：难度随码内 `adaptiveBoost`（百分点整数，缺省 0），保证同码同难；
  幕间续行摘掉 `duel`（码只约定它写明的那一幕）。战绩簿 `voice-tower-challenge-v1` 只存本机同码最佳（上限 50），
  无云端、无排行榜；起手路径（startCampaign/startEndless/startDaily/startNew）语义逐位不变。

## 2. 黄金契约与确定性

- 引擎行为由 `tests/contract/` 十三个黄金契约测试文件锁定：**改行为先改契约并获得确认**。
- 同一规则版本下 (act, seed) 必须同一局；特效随机走独立种子流，禁止消费游戏 `rngState`。

## 3. 质量门（每次提交前全绿）

```bash
npx biome check .          # 风格（或 npm run check:fix）
npx tsc --noEmit           # 严格类型
npx vitest run             # 单测+契约+仿真（现 416 条）
npx vite build && npx vite-node scripts/perf-budget.ts   # 首包 ≤350KB gzip（现 89.9）
npx vite-node scripts/release-readiness.ts               # dist PWA/路径/安全头 44 项契约
npm run sim:p8b           # 对手进化参考门45–65%、零超时；随机Bot异常须如实记录
npm run sim:p9            # 守势反击门45–65%、零超时、每幕 counterHits>0
npm run sim:p10           # 名伶门：每角色三幕45–65%、零超时
npm run sim:p11           # 绝技门：默认行=P10 基线逐位、高声韵行 ultimateCasts>0、零超时
npm run sim:p8            # 构筑版独立仿真（含真实升级/删牌计数）
npm run sim:p7            # 扩展版独立平衡报表（基础版仍用 npm run sim）
npx playwright install --with-deps chromium firefox webkit  # 新环境一次性安装
npx playwright test        # Chromium 业务 E2E（现 46 条）
npm run test:release      # Chromium/Firefox/WebKit 发布矩阵（现 19 通过、1 明确跳过）
npm run test:lighthouse   # 移动端+桌面四类分数及 LCP/TBT/CLS 硬预算
npm run release:check      # 提交发布前串行执行全部门（需先安装三种 Playwright 浏览器）；P9/P10/P11 后另跑 npm run sim:p9、sim:p10、sim:p11
```

## 4. 不可触碰的红线

- **性能预算**：首包游戏本体 JS ≤ 350 KB gzip，perf-budget 一票否决；新依赖先报体积。
- **零资产哲学**：不引入图片/音频/动画素材文件，全部程序化生成（Lottie/Rive 免谈）。
- **隐私**：语音与存档不出设备；不引遥测；codegraph 已关 telemetry。
- **无障碍**：所有动效必须尊重 `body.reduce-motion`（降级而非消失：信息保留、动效归零）。
- **自动播放合规**：AudioContext 只能在首次用户手势后创建/恢复。

## 5. 提交规范

- 中文 conventional 风格：`P6-F2 xxx：要点`（期号-里程碑 + 冒号 + 摘要），正文列模块与测试数字。
- 提交信息里带上测试与预算结果（如 `174 单测全绿，预算 61.0/350 KB`）。
- 凭据永不入库、不进提交信息；CI 密钥走 GitHub Secrets。
