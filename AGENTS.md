# AGENTS.md · 声震龙楼仓库地图（给智能体的目录，不是百科）

> 100 行原则：本文件只回答「东西在哪、怎么跑、什么不能碰」；细节一律跳链到 `docs/` 分层。
> 与代码不符即为 bug：发现漂移请更新本文件（同 PR 内）。

## 1. 两条产品线（一图）

```
src/core|ui|beginner|adapters   ← Web/PWA 爬塔版（已冻结：只修 bug，不重构不加料）
src/street/**                    ← 「街坊卡牌」共享领域层（纯 TS：引擎/内容表/画像/模拟）
minigame/                        ← 微信小游戏版（活跃主线）：canvas 渲染 + 独立构建分包
```

- 依赖方向铁律（CI 机械校验，清单在 `docs/harness/deps-allowlist.json`）：
  `minigame → src/street`；`src/street` 不得 import web 层；`src/street/content/chN.ts` 是纯数据表。
- Web 线详细冻结声明：`docs/design-docs/web-freeze.md`（阶段4落地后存在）。

## 2. 怎么跑（全部从仓库根）

```bash
npm ci                        # node_modules 不进快照，新环境先装
npm run gate                  # 全量门禁：lint + typecheck + 测试 + 两个 build + harness 检查
npm run minigame:preview      # 构建并起 http 预览（端口 4190，含 /audio-check.html 试听页）
node minigame/build.mjs --web # 只构建小游戏（dist=提审包，preview=浏览器预览）
npx vitest run                # 单测（tests/**，含 street 六章内容表校验与 sim 平衡带）
```

沙箱被重置后的修复链见 `docs/references/sandbox-repair.md`。

## 3. 关键位置

| 要改什么 | 去哪 |
|---|---|
| 加/改句子卡、街坊、事件、遗物 | `src/street/content/chN.ts`（每章一文件）+ `src/street/types.ts` Tag + `src/street/data.ts` 合并 + `chapters.ts` 登记 |
| 战斗/意图/遗物数值规则 | `src/street/engine.ts`（纯函数，web 与小游戏共用，改前跑 `tests/street-*`） |
| 小游戏屏幕渲染与交互 | `minigame/src/game.ts`（阶段4将按屏拆分至 `minigame/src/screens/`） |
| 平台 API（录音/广告/存储/分包） | `minigame/src/platform-wx.ts`；浏览器对应 `platform-web.ts` |
| 音频资产 | `minigame/assets/audio/street/<key>.mp3`；key=`c-<卡id>`/`n-<街坊id>-<i>`；SOP 见 `docs/references/tts-pipeline.md` |
| 立绘/背景 | `public/street/*.png`、`public/street/bg/*.jpg`（Q版手绘风格基线） |
| 数值平衡 | `src/street/sim.ts` + `tests/street-sim.test.ts` 胜率带断言，流程 `docs/design-docs/balance.md` |
| 上线/合规/提审 | `docs/design-docs/V1-RELEASE.md`；政策结论 `docs/references/wx-compliance.md` |

## 4. 硬性不变量（有 CI 门禁拦截，红叉别看心情）

1. **微信主包 ≤ 4096KB**（第 3 章起资源自动进 `resN/` 分包；分包清单注入 game.json，勿手改）。
2. **行为回归**：改动战斗/UI 后必须过 `tests/` 全绿 + 手测清单 `docs/exec-plans/completed/HARNESS-PLAN.md` §6（十条行为回归）。
3. **单文件 ≤ 800 行**（存量豁免见 `docs/harness/baseline.json`，只减不增）。
4. **内容表完整性**：jp 字段只允许小写字母数字空格；新章必须过 `tests/street-chN.test.ts` 五件套（参照 ch6）。
5. **不碰**：`minigame/src/audio-manifest.ts`（构建生成物）、`dist/`、`preview/`、`docs/generated/`。
6. **commit**：小粒度、带 H 编号前缀（harness 期间）、message 写「验证:」行。

## 5. 代码理解

仓库已配 codegraph（离线代码图谱）：`npm run codegraph` 建图，
`npx codegraph query|node|callers|impact|context` 先查图再读码。

## 6. 文档地图（记录系统）

- `docs/exec-plans/active/` —— 进行中的执行计划（当前为空；harness 五阶段计划已完成归档至 completed/HARNESS-PLAN.md；遗留债务看 exec-plans/tech-debt-tracker.md）
- `docs/exec-plans/completed/` —— 历史计划归档（web 线 P 系列全部在此，status: done）
- `docs/design-docs/` —— 现行设计：路线图 minigame-roadmap.md、提审 V1-RELEASE.md
- `docs/references/` —— 口传知识落库：TTS 切分 SOP、微信合规、真机测试、沙箱修复
- `docs/harness/` —— 改造台账：SCAN-REPORT.md（20 项问题）、registry.json、baseline.json
- `docs/ARCHITECTURE.md` —— 依赖方向与目录职责的正式版

新会话第一读：本文件 → `docs/harness/registry.json`（问题台账）→ 相应 docs 深链。
