# Harness 工程化改造计划（v1 · 待评审）

> 项目：声震龙楼（hweiei/voicedragon）· 分支：`harnessing`（基于 `feat/minigame` @ `7f17983`）
> 方法论：OpenAI《工程技术：在智能体优先的世界中利用 Codex》（harness-engineering，2026-02）
> 输入：`docs/harness/SCAN-REPORT.md`（20 项问题台账 H-01…H-20）
> 铁律：**保留全部业务行为**；bug 修复与业务变更必须在本计划或对应 exec-plan 中显式标注；一切产出物（文档/清单/测试）进版本库；小粒度提交、commit message 带 H 编号可追溯。

## 0. 从文章提炼的落地原则（本项目翻译版）

| 文章主张 | 本项目落地形态 |
|---|---|
| 仓库即记录系统，AGENTS.md 是目录不是百科 | 重写 AGENTS.md ≤120 行：双产品线地图 + 指向 docs/ 分层；历史计划归档 superseded |
| 渐进式披露的 docs/ 结构 | `docs/{design-docs,exec-plans/{active,completed},references,generated}` 四层 + 状态头 + 索引校验脚本 |
| 不变量机械执行（自定义 lint + 结构测试） | 新增 `scripts/harness/` 检查集：包大小红线、依赖方向、文件大小上限、资源完整性、文档新鲜度——全部进 CI 门禁 |
| 黄金原则 + 垃圾收集循环 | 每阶段收尾跑 `npm run harness:check`；漂移项开 H 编号新台账，不再靠每周五人肉清理 |
| 计划是一等工件 | 每阶段一份 exec-plan（进度框 + 决策日志），完成即移入 completed |
| 面向智能体的可读性 | 每个检查脚本输出「WHAT/WHY/HOW to fix」三段式，错误信息即修复指令 |
| 吞吐量改变合并哲学（快错快改） | 门禁分层：必过（build/test/红线）与告警（文档新鲜度/重复率）两档，告警不阻塞但必须记录 |

---

## 阶段 1 · 全量扫描与问题台账（本阶段已完成 90%，随评审收尾）

**目标**：把「现状」固化为版本化数据，后续一切工作可对照基线。

| # | 子任务 | 产出物 | 验收标准 |
|---|---|---|---|
| 1.1 | 结构/规模/重复/复杂度/安全/性能量化扫描 | `docs/harness/SCAN-REPORT.md`（已交） | 每项结论带采集命令或文件行号证据；他人可复跑复核 |
| 1.2 | 问题台账机器可读化 | `docs/harness/registry.json`：H 编号、优先级、状态（open/fixing/done/wontfix）、涉及文件 | 20 项全录入；`scripts/harness/registry.ts` 校验 schema 与状态枚举合法 |
| 1.3 | 基线快照（防止「改坏了说不清」） | `docs/harness/baseline.json`：测试数、行数、重复率、包体积、音频条数等 12 个数值 | 由 `scripts/harness/baseline.ts --write` 生成；门禁可用 `--check` 对比 |
| 1.4 | 分优先级解决计划（含「不做什么」） | 本文件 §4 排期 + SCAN-REPORT §2 结论 4 | 每个 P0/P1 项都挂进某个阶段；wontfix（web 冻结线重构）显式声明 |

**阶段验收**：评审通过本文档 → 阶段 1 关闭；`registry.json` 在后续每阶段末更新并由 CI 校验合法性。

---

## 阶段 2 · 文档体系对齐（清 H-10 / H-11 / H-12 / H-13 / H-19）

**目标**：让仓库重新成为可信记录系统；文档与代码一致且可机械验证。

| # | 子任务 | 产出物 | 验收标准 |
|---|---|---|---|
| 2.1 | docs/ 重组为四层结构，历史计划移 `exec-plans/completed/` 并加状态头 | 新目录树 + 每文件头 `> status: active|done|superseded · updated: YYYY-MM-DD` | 40 个文件全部有状态头；无文件散落在 docs 根 |
| 2.2 | 重写 AGENTS.md：双产品线地图、构建/发布命令、分包规则、微信政策指针、codegraph 用法；压缩 ≤120 行 | 新 `AGENTS.md` | 行数 ≤120；不再把 15 份历史计划列为事实源；抽查 5 个说法与代码一致 |
| 2.3 | 新增 `docs/ARCHITECTURE.md`：模块图 + 依赖方向规定（minigame→street→(core 只读)；street 不得 import minigame/ui；content 表纯数据） | ARCHITECTURE.md + `docs/harness/deps-allowlist.json` | 允许边清单与 `scripts/harness/deps.ts` 校验器共用同一 json |
| 2.4 | 沉淀口传知识到 references：批量 TTS 切分 SOP、split-mini 用法与阈值、微信 IAA/备案/适龄提示结论、真机测试清单、沙箱修复链 | `docs/references/{tts-pipeline,wx-compliance,device-testing,sandbox-repair}.md` | SCAN-REPORT H-12 列举的 4 块知识全部有仓库内落点 |
| 2.5 | README 双产品化：小游戏升为主角、web 线标注冻结；scripts 索引（H-19） | README.md + `docs/references/scripts.md`；package.json 归档 sim:p7-p15 到 `scripts/legacy/` | 27 条 scripts 每条在索引中有「活/史」标记；`npm run` 主命令表可在 README 一屏内跑通 |
| 2.6 | 文档新鲜度门禁 | `scripts/harness/docs.ts`：状态头必填、内链可达、`docs/**` 被 AGENTS/ARCHITECTURE 引用的入口存在、7 天未更新且 status:active 则告警 | CI 中该检查对当前全量 docs 通过；故意改坏一处（临时）即红 |
| 2.7 | （显式标注）**行为变更：无**；bug 修复：无 | 本阶段 commit 前缀 `docs(harness):` | git log 中本阶段无 src/ 变更 |

**阶段验收**：`npm run harness:docs` 绿；随机抽 3 名「只读仓库的假想新 agent」视角（评审人执行）：按 AGENTS.md 能在 10 分钟内定位「改一局战斗数值要动哪个文件、跑什么命令」。

---

## 阶段 3 · 提交门禁审计与自动化补全（清 H-05 / H-06 / H-07 / H-16 / H-18）

**目标**：每次提交（含无 PR 的分支提交）都可构建、可测试、质量可控；不变量上锁。

| # | 子任务 | 产出物 | 验收标准 |
|---|---|---|---|
| 3.1 | CI 触发面扩到 `harnessing`/`feat/*`（push 即跑），补 minigame 构建 + 分包断言 job | `.github/workflows/ci.yml` 修订 + `minigame.yml`（build.mjs + `scripts/harness/bundle.ts`） | 在 harnessing 分支 push 一次实验提交 → Actions 出现两 job 记录；bundle.ts 断言主包 ≤4096KB、manifest 条数 ≥基线、game.json subPackages 与目录一致 |
| 3.2 | 本地预提交门禁（不引 husky 也可：一条文档化命令 + 可选 pre-push sample） | `scripts/git-hooks/pre-push.sample` + AGENTS 教程；`npm run gate` = biome+tsc+vitest+两个 build 的一键门禁 | `npm run gate` 本地通过；hook 安装说明 ≤5 行；CI 与 gate 命令集完全一致（防「本地绿远端红」） |
| 3.3 | 收紧质量规则（渐进：先 warn 后 error） | `biome.json`：开 `noExcessiveCognitiveComplexity`（阈值 20）、`noParameterAssign`；`noExplicitAny` 保持 off 但在 harness 报告统计出现次数作趋势 | 阈值首跑允许存量（记录 baseline.json），新增违规即红；any 次数 ≤ 基线 |
| 3.4 | 文件大小红线棘轮 | `scripts/harness/size.ts`：单文件 ≤800 行，存量豁免清单只减不增 | 新建 801 行临时文件即红；豁免清单写入 baseline.json 并在阶段 4 逐 PR 缩小 |
| 3.5 | 卫生检查 | `scripts/harness/hygiene.ts`：孤儿 src 目录（H-18）、`git ls-files` 无未跟踪的构建产物、tests 命名模式 | 当前全绿；对 `dist/`、`preview/` 的忽略规则进 .gitignore 并被校验 |
| 3.6 | 性能预算扩展到小游戏 | `scripts/harness/perf-wx.ts`：构建耗时、单张 PNG ≤150KB、每章音频总大小 ≤900KB 告警 | 输出报告进 CI artifact；超限即红 |
| 3.7 | 门禁自测 | `tests/harness/gates.test.ts`：对每个 check 脚本喂「故意坏」fixture 断言其报错（检查的检查） | 每个 harness 脚本 ≥1 正 1 反用例 |

**阶段验收**：① harnessing 分支上任意 push 触发 CI 全 job 绿；② 故意提交 801 行文件/坏分包 manifest → CI 对应项红（实验记录贴 PR/commit）；③ `npm run gate` 与 CI 结论一致。本阶段 commit 前缀 `ci(harness):`。

---

## 阶段 4 · 问题修复与重构（清 H-01 / H-03 / H-04 / H-02声明 / H-14围栏）

**目标**：按台账逐个消解 P0/P1 代码问题；**只搬不改行为**；每个 PR 带「行为不变性证据」（测试 + 关键路径手测截图）。

| # | 子任务 | 产出物 | 验收标准 |
|---|---|---|---|
| 4.1 | 抽公共会话层：把 web/minigame 两份「出牌→XP→浮字→结算」编排下沉 `src/street/session.ts`（纯函数，输入事件输出副作用描述） | session.ts + 迁移两端调用 + `tests/street-session.test.ts` | 两 UI 各净删 ≥100 行；673+ 测试全绿；session 单测覆盖接招/暴击/升级/胜负 4 分支 |
| 4.2 | `minigame/src/game.ts` 按屏拆分（H-01）：14 屏 → `minigame/src/screens/{title,chapters,map,battle,...}.ts`，每屏 `render(ctx,state)+onAct(ctx,act,id)`；`handle` 改表驱动注册 | 新目录结构；game.ts 只留装配 ≤200 行 | 新文件均 ≤400 行（size 豁免清单同步收紧）；Playwright 冒烟（选章→战斗→胜负→设置）零 diff 行为；`__street` 调试面保留 |
| 4.3 | content 表补结构测试（对齐 ch3-ch6 五件套到 ch1/ch2 与 web 线）+ 修 jscpd 余下 6 小块（sim.ts 24/7 行、engine.ts 6 行等） | `tests/street-ch1-ch2.test.ts` + 小重构 commit | jscpd 重复率 <1%；克隆块清单清零（style.css 585 行除外→4.4） |
| 4.4 | 删 `src/street/style.css` 585 行重复段（H-04） | 单 commit | 页面视觉基线（已有 playwright visual）零 diff；重复率显著下降 |
| 4.5 | web 冻结线处置：ui.ts `openRosterPicker` 1864 行**不重构**，改为文件级 `FROZEN` 声明 + 依赖方向检查豁免注释（H-02 决策）；innerHTML 围栏（H-14）：新增 lint 规则/检查脚本禁止 `innerHTML =` 右侧出现非白名单来源插值，存量登记 | `docs/design-docs/web-freeze.md` + `scripts/harness/xss.ts` | xss.ts 对 33 处存量给白名单、新增违规即红（fixture 反例进 3.7 测试） |
| 4.6 | 台账更新 + 棘轮核对：registry.json 状态翻转；size 豁免清单只许减 | commit 附带 | 每 PR 独立可 revert；无跨 PR 依赖死锁 |

**阶段验收**：vitest 用例数 ≥ 阶段前（673）且全绿；jscpd <1%；size 豁免条目数下降；`npm run gate` 全绿；行为回归清单（§6）逐项勾选。**期间如发现「顺手 bug」→ 一律先登记 registry（新开 H 编号，标注 `bugfix`）再修，禁止搭车改。**

---

## 阶段 5 · 测试补全与门禁化（清 H-08 / H-09；把阶段 3 的门禁升级为行为级）

**目标**：重构结果与历史盲区有完整测试兜底，并全部纳入自动门禁。

| # | 子任务 | 产出物 | 验收标准 |
|---|---|---|---|
| 5.1 | 覆盖率基线与门禁：引入 `@vitest/coverage-v8`，`src/street/**` 与 `minigame/src/(sound|platform|session)` 行覆盖 ≥80%，其余 ≥55% 起步（棘轮：只升不降） | coverage 配置 + `scripts/harness/coverage.ts`（读 json-summary 对比 baseline） | CI 出 coverage job；低于阈值即红；基线写进 baseline.json |
| 5.2 | `platform-wx.ts` 单测：mock `wx.*`（分包门控、loadImage 延迟赋 src、playAudio 等待分包、广告静默降级、录音降级） | `tests/wx-platform.test.ts` + `tests/fixtures/wx-mock.ts` | 分包时序 3 用例（ready 前点击播放→load 完成后自动播；load 失败→images 缓存清除重试）；全 mock 无真机依赖 |
| 5.3 | screens 行为快照：Playwright 对 14 屏每屏一张结构断言（regions 的 act 集合 + 关键文本），替代肉眼 | `tests/e2e/minigame-screens.spec.ts` | 每屏 1 用例；CI e2e job 在 PR 上跑（沿用现有 Playwright 基建） |
| 5.4 | 资源完整性门禁（H-09）：由内容表枚举「应有音频/立绘」全清单，与 `assets/audio`、`public/street` 对账（缺→红，多→告警）；输出 `docs/generated/asset-manifest.md` | `scripts/harness/assets.ts` + generated 文档 | 六章 183 句对账全过；故意移走一个 mp3 → CI 红（实验后恢复）；generated 文档由脚本产出禁止手改（docs 校验器豁免 generated/） |
| 5.5 | sim 平衡带测试固化：六章 300 局×3 档断言带（沿用现带值），seed 固定，防「数值漂移」 | `tests/street-sim.test.ts` 扩展 ch1/2 全量入带 | 全章绿；把「平衡带」写进 `docs/design-docs/balance.md` 供未来 agent 引用 |
| 5.6 | 全量回归 + 文档收尾：SCAN-REPORT 附「整改结果对照表」（每项 before→after 数值）；exec-plan 移 completed | `docs/harness/FINAL-REPORT.md` | 20 个 H 项状态全部收敛（done/显式 wontfix）；README「工程门禁」一节描述最终形态 |

**阶段验收**：`npm run gate` = 一条命令覆盖全部（lint/type/unit/coverage/assets/screens/size/docs）；任何一项可复现地能被「故意破坏」触发红；从空仓库 clone → 一条 `npm run setup`（文档化）到新 agent 首次提交，全程无口传知识。

---

## 5. 排期与提交策略

- 顺序执行阶段 2→3→4→5（阶段 1 随本评审关闭）；阶段间允许小幅并行（如 2.4 与 3.x），但 **4 依赖 3 的红线先行**（防止边拆边长）。
- commit 粒度：一个子任务 ≈ 一个 commit（≤400 行 diff），前缀 `docs(harness):`、`ci(harness):`、`refactor(harness):`、`test(harness):`、`fix(harness):[bugfix][H-xx]`；message 正文写「验证：跑了什么、结果」。
- 每阶段结束在 registry.json 翻转状态并打 tag：`harness/phase-N`。
- 风险预案：阶段 4.2（game.ts 拆分）是唯一大动作——先加 5.3 屏幕测试（顺序提前到 4.2 之前半步）、逐屏搬迁、每屏一 commit、可逐屏 revert。

## 6. 行为回归清单（阶段 4/5 每次合入前手测，勾选记录进 exec-plan）

1. 新档→ch1 开局：新手三步引导出现，打完消失，重进不再弹
2. 老档（runs>0）不再弹引导（tutDone 迁移）
3. ch3 对局：接招 ✓ 高亮、×1.5 加成数值、咗/紧遗物 +2
4. ch6 boss 芬姑娘四意图轮转与劝食/派利是台词音频各 200
5. 录音被拒授权→降级「跟读自评」不卡死
6. 分包：清缓存冷启动进 ch5，诊所图/音效延迟 ≤3s 出现且无报错
7. BGM：设置页静音开关即时生效；无 WebAudio 环境（禁 AudioContext）无报错
8. 广告位 id 为空→全流程静默跳过
9. 存档杀进程恢复（run + profile）
10. 音频缺失卡→提示「睇粤拼跟读」且战斗可继续

## 7. 待确认的决策点（评审时勾选）

- [ ] D1：web 线（src/core|ui|beginner）确认「冻结只修 bug」？（影响 H-02/H-14 的深度）
- [ ] D2：`ui.ts` 3452 行是否连带 4.2 一起拆？默认否（见 D1）
- [ ] D3：覆盖率阈值 80/55 起步值是否接受棘轮制？
- [ ] D4：harnessing 分支完成后合回 `feat/minigame` 还是并行观察一周？
- [ ] D5：H-19 归档 sim:p7-p15 脚本是否连 `docs/P*-*.md` 一起移 completed（默认是）
