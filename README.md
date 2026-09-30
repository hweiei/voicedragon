# 声震龙楼 · 街坊卡牌

粤学坊出品 · 粤语学习微信小游戏（羊城卡神爬塔 · 单人开发者 · 免费 + 激励广告）。
**主形态 = 微信小游戏**（`minigame/`）；`src/street/` 为同引擎的浏览器验证线。
新会话请先读 [AGENTS.md](AGENTS.md)（项目地图）。

## 玩一把（浏览器）

```bash
npm ci
npm run dev        # http://localhost:4190/street/ —— 街坊卡牌（需 Node ≥ 20）
```

## 真机试玩（微信小游戏 · 主力形态）

1. `npm run minigame`（产出 `minigame/dist/`，含分包切分与 manifest 生成）
2. 微信开发者工具「导入项目」→ 选 `minigame/dist/`，AppID 用测试号或 `wx66ad516be4157de5`
3. 「预览」扫码即可真机玩。注意：`wx.getRecorder` 仅真机可用（工具内模拟）；
   首次进游戏需下载子包（~5.5MB 音频，Wi-Fi 下自动续传）。

## 质量门禁

```bash
npm run gate     # lint + 类型 + 全量测试 + 双端构建（与 CI 同源）
npm run test:watch
```

CI（[.github/workflows/ci.yml](.github/workflows/ci.yml)）在 main / feat/* / harnessing 上跑同一套检查。

## 目录

```
minigame/      微信小游戏宿主（Game 入口/canvas UI/分包/广告/录音/音频播放）
src/street/    双端共用游戏引擎（core 复用：卡牌/战斗/内容表）
src/ui/        早期网页线（龙楼夜话/新手引导）——功能冻结，仅修 bug
src/core/ src/adapters/  词库/发音评测引擎（被冻结线复用，勿动行为）
scripts/       构建与检查脚本（清单见 docs/references/scripts.md）
tests/         673 个自动化测试（单元/属性/模拟/契约/e2e）
docs/          design-docs · exec-plans/{active,completed} · references · harness
```

内容：6 章 126 句卡 · 26 NPC · 18 事件 · 12 遗物 · 192 条真人 TTS 音频。
发布前清单：[docs/design-docs/V1-RELEASE.md](docs/design-docs/V1-RELEASE.md)。
