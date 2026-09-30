# Harness 化改造 · 全量扫描报告

> status: active · updated: 2026-09-30 · 本文件由 harness 迁移器统一加注（2026-09-30）

> 扫描日期：2026-09-30 · 基线：`feat/minigame` @ `7f17983`（分支 `harnessing` 自此拉出）
> 扫描方式：全仓静态分析（jscpd / grep / wc / AST 粗算）+ CI 与文档交叉核对。**本轮零代码修改。**
> 注意：本地沙箱仓库是浅克隆（19 个可见提交），完整历史以远端 `hweiei/voicedragon` 为准。

## 0. 仓库画像（一句话）

一个仓库装着**两条产品线**：① Web/PWA 爬塔版（`src/core|ui|adapters|beginner`，v0.3 已上线 GitHub Pages）；② 微信小游戏「街坊卡牌」版（`src/street/*` 共享领域层 + `minigame/` 独立渲染与构建），外加约 3.9 万行 TS、112 个源文件、6 章内容表、192 条音频与分包产物。

| 指标 | 数值 | 采集方式 |
|---|---|---|
| TS 源文件 / 行数 | 112 文件 / 39,440 行（不含 tests、内容表 CSS） | jscpd 统计 |
| 测试 | 86 文件 / 673 用例全绿；无覆盖率统计 | vitest + package.json |
| 代码重复率 | **1.64%**（7 个克隆块 / 646 行） | jscpd --min-tokens 70 |
| 最大文件 | `src/ui/ui.ts` 3452 行、`src/core/engine.ts` 2218、`minigame/src/game.ts` 1914 | wc -l |
| 文档 | `docs/` 40 个 md，无索引无状态标记 | ls |
| CI 覆盖分支 | 仅 `main` push 与 PR | .github/workflows/ci.yml |

## 1. 问题清单（H 编号 = Harness 台账；P0 必修 / P1 应修 / P2 择机）

### 架构与复杂度

- **H-01 (P0) `minigame/src/game.ts` 单闭包 1765 行「上帝屏幕」**
  `startGame()` 一个函数闭包含全部 14 个屏幕（title/chapters/map/combat/settings/…）的渲染 + 命中分发 + 交互状态机。任何改动的认知成本都是整文件级别；这也是本项目对智能体最不友好的单点。
  证据：AST 扫描 `export function startGame` 到文件尾 ≈1765 行；`g.regions`/`handle(act,id)` 全局耦合。
  修复方向：按屏幕拆 `screens/*.ts`（每屏 render+onAct 一对），共享状态收进显式 `GameCtx`；`handle` 的 act 表驱动化。**行为不变，纯搬移。**
- **H-02 (P1) `src/ui/ui.ts` `openRosterPicker()` 单函数 1864 行**（web 版遗留）
  同型问题；web 线已冻结，降级为 P1：拆函数/拆文件，或至少在文件头声明冻结策略（冻结则只加 README 声明，不重构）。
- **H-03 (P1) 领域层与 UI 的双向暗线**：`src/street/engine.ts`（纯逻辑，好）被 web `src/street/app.ts`（onClick 223 行）和 `minigame/src/game.ts` 同时消费——共享是对的，但两个消费端各自长出了 100+ 行重复的「选卡→评分→结算」编排序列（如 `playCard+gainXp+levelUps+toast` 五连，两处逻辑靠人肉同步）。
  修复方向：把编排序列下沉为 `src/street/session.ts` 纯函数（输入事件 → 输出副作用描述），两 UI 变薄壳。
- **H-04 (P2) `src/street/style.css` 存在一个 585 行克隆块**（第 486 与 1069 行段整段重复，占重复率大头）。删一份即可，纯收益。

### 门禁与自动化

- **H-05 (P0) CI 与活跃开发分支脱节**：`ci.yml` 只在 `main` push / PR 触发；`feat/minigame`、`harnessing` 上全部提交**从未跑过 GitHub CI**（本地手工跑 `tsc/vitest/biome` 替代）。且 yml 里没有 minigame 构建步骤——小游戏构建物（分包、game.json 注入、包体积红线）无 CI 兜底。
- **H-06 (P1) 无「提交前」本地门禁**：没有 husky/pre-commit；格式化/lint 全靠自觉。仓库 `npm run ci` 脚本其实已是完整门禁（biome ci + tsc + vitest + build + perf + minigame build），缺的只是「自动被触发」。
- **H-07 (P1) 质量规则整体偏松**：`biome.json` 关了 `noExplicitAny`、`noNonNullAssertion`（内容表里 `persuade!` 泛滥）；未启用 `noExcessiveCognitiveComplexity`、`noParameterAssign` 等。文件大小无上限约束（3452 行无人报警——H-01 能长到这么大正因缺此机制）。
- **H-08 (P1) 测试无覆盖率与「关键路径清单」双重保障**：673 用例看着多，但 minigame 的 `platform-wx.ts`（分包门控/录音/广告，**上线风险最大的代码**）0 单测；`game.ts` 仅靠 Playwright 冒烟；内容表校验（jp 合法性等）只在 ch3-ch6 有，ch1/ch2/web 线内容表无同类测试。
- **H-09 (P2) 音频/美术资产无完整性门禁**：192 条 mp3 靠「构建时扫描目录」隐式生成 manifest，缺文件=静默降级——上线前需要一次「六章 183 句全量对照表」自动校验（数据表逐行 vs 文件存在），现在只有人工试听页。

### 文档与可读性（AGENTS 视角）

- **H-10 (P0) AGENTS.md 严重失真**：只描述 web 六边形架构与 P7–P17 历史计划链（15 份「单一事实源」，正是 harness 文章批判的 *1000 页说明书* 反模式）；对 street 卡牌线、minigame 构建/分包/微信政策约束**零记载**。智能体按它施工会完全走错地图。
- **H-11 (P1) docs/ 是 40 个平铺文件**：历史 exec-plan、已完成的 P7-P21 报告、活跃文档混在一起，无 `design-docs / exec-plans(active|completed) / references` 分层，无状态头（active/done/superseded），交叉链接无校验。README 版本号 v0.3.0 停留在 web 线，与小游戏现状脱节。
- **H-12 (P1) 领域知识仍有一块在「仓库外」**：本会话积累的关键事实（批量 TTS 切分流程、split-mini 参数、微信备案/IAA/适龄提示结论、沙箱修复链）散在聊天记录里。按文章原则：*仓库外的知识等于不存在*——需沉淀为 `docs/references/*.md`。
- **H-13 (P2) 无顶层 ARCHITECTURE.md**：两产品线 + 共享层的依赖方向（minigame→src/street→src/core 是否被违反）无文档也无机械校验。

### 安全与性能

- **H-14 (P1) Web 线 33 处 `innerHTML` 模板串直渲**：当前无不可信输入（全静态本地数据），风险为零但不是架构保证——一旦引入用户昵称/分享码解码就会瞬间变成 XSS 面。harness 式解法：加一条机械规则（lint 或 codegraph 检查）：`innerHTML` 模板内禁止出现函数调用返回值插值，只许渲染 `esc()` 包装值。
- **H-15 (P2) 无 CSP / 无 SRI**（PWA index.html）；`vite.config` 的 PWA workbox 无更新回滚说明。
- **H-16 (P1) 性能预算只覆盖 web 首包**：`scripts/perf-budget.ts` 管 JS gzip；minigame 侧只有包体积打印，无帧预算（canvas 全量重绘每帧 <16ms）与「主包 ≤4MB、音频条数、每包大小差」的断言化红线（现在只有 console 提示）。
- **H-17 (P2) 依赖与体积**：devDeps 含 playwright 全家桶（clone 体积/安装时长）；`public/street` 21 张 PNG 未压无损（单张 ~40-120KB，分包后可接受，但 optipng 一遍有白捡的 15-25%）。

### 工程卫生（顺手记账）

- **H-18 (P2) 仓库内 `/home/user/minigame/src/sound.ts` 曾写错过目录**（本会话修复）——提示需要一条「孤儿目录」卫生检查（`git ls-files` 之外的顶层目录出现 src/ 即报警，CI 里一行 shell 即可）。
- **H-19 (P2) package.json scripts 已达 27 条**（sim:p7…sim:p15 等历史一次性脚本），无 `docs/scripts.md` 索引，agent 与新人均难判断哪些还活着。
- **H-20 (P0·元问题) 缺「执行计划 → 验收」的公共骨架**：以上问题没有统一的推进载体与验收口径，本计划的 §5 阶段表就是该骨架；落地时每项必须挂 H 编号，commit message 引用编号，保证可追溯（本任务提交规则同源）。

## 2. 交叉结论

1. **代码本体质量不差**（重复率 1.64%、strict TS、673 测试、零真实安全洞），问题集中在 **harness 层**：门不上锁（CI/预提交/规则松）、地图失真（AGENTS/docs）、少数巨型函数阻碍施工。
2. 与文章对照的最大差距：**「仓库=记录系统」未成立**（H-10/11/12）与**「不变量机械执行」缺位**（H-05/07/16/20）。
3. 优先级总览：**P0 共 4 项（H-01、H-05、H-10、H-20）→ P1 共 8 项 → P2 共 8 项**。
4. 建议处置节奏：按改造计划的 5 阶段推进，每阶段一个可独立评审的 PR 序列；web 冻结线（H-02/H-14）只做「声明+围栏」不做重构，把人力留给小游戏活跃线。

---

## 门禁破坏实验记录（计划 §3.11，2026-09-30）

- 探针 commit `6a0839f`（801 行文件 + 顶层 `any`）推送后 CI：check=failure（Lint/hygiene 闸生效）、
  minigame=success、e2e=success（破坏域与门禁域精确对应）；revert `355a0fa` 恢复。
- 结论：棘轮线、lint error 化、分支触发三项均经真实 CI 验证；harness 记录保留在 Actions run 历史。
