# ARCHITECTURE · 模块图与依赖方向（机械校验的正式规则源）

> status: active · updated: 2026-09-30
> `scripts/harness/deps.ts` 读取本目录规则清单 `docs/harness/deps-allowlist.json` 执行校验；两处必须同步改。

## 1. 目录职责

| 目录 | 职责 | 允许被谁引用 |
|---|---|---|
| `src/core/**` | Web 爬塔版纯领域内核（零 DOM、确定性种子） | 仅 web 线（ui/adapters/beginner） |
| `src/ui/**`、`src/beginner/**`、`src/adapters/**` | Web 线 UI/端口适配（**冻结线**） | 仅 web 入口 |
| `src/street/**` | 街坊卡牌共享领域层：types/engine/data/content/school/mastery/profile/sim | web 入口 + `minigame/src/**` |
| `src/street/content/chN.ts` | 纯数据表（章节内容唯一入口），不得 import 引擎 | data.ts 与测试 |
| `minigame/src/**` | 小游戏运行时（canvas、平台适配、构建产物） | 仅 minigame 自身 |
| `minigame/build.mjs` `scripts/harness/**` | 构建与门禁工具 | CI / 人工 |

## 2. 允许边（allowlist 语义）

```
minigame/src/*        → src/street/**, src/adapters/voice/**, src/core/tone(评分算法), minigame/src/*, 自身
src/street/app.ts     → src/street/**            （web 薄壳入口）
src/street/**         → src/street/**（内部自由）  ✗ 不得 import core/ui/adapters/beginner
src/core/**           → src/core/**               ✗ 不得 import 任何上层
src/ui|beginner|adapters → src/core|adapters(端口) ✗ 不得 import street/minigame
tests/**              → src/**, minigame/**       （测试是唯一允许跨线引用处）
```

违例处理：deps 检查直接红。确需新增边：先改本文件与 allowlist（单独 commit，说明理由），CI 自然放行。

## 3. 数据流（小游戏一局）

```
platform-wx(wx.* API 适配) → game.ts(屏幕状态机/渲染) → src/street/engine(纯规则)
        ↑                        ↓ 读
   assets/audio/* 与 public/street/*（构建期按章路由主包/resN 分包，manifest 自动生成）
        ↑
   content/chN.ts（纯数据） → data.ts(合并) → chapters.ts(章节登记)
```

存档两个 key：`street-run-v1`（当局）、`street-profile-v1`（画像 v2，含 tutDone/mastery）。

## 4. 冻结线政策

Web 线（`src/core|ui|beginner|adapters` + 对应 tests）自 harness 阶段2起只修 bug 不重构；
`ui.ts` 巨型函数（1864 行 roster picker）保留并接受 size 棘轮豁免；新功能一律进 minigame 线。
理由与边界：`docs/design-docs/web-freeze.md`（阶段4 落地时创建；此前以本句为准）。
