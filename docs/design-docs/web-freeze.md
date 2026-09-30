> status: active · updated: 2026-09-30

# Web 线冻结令（D1 裁决的执行文件）

## 范围（FROZEN）

`src/ui/`、`src/beginner/`、`src/adapters/`（web 形态）、`src/pages/`（如有）、
`vite.config.ts` 的 PWA 配置、`playwright.*.config.ts`。这些是 v0 PWA 交付物：
**只修 bug，不加功能、不重构、不升级依赖**。ui.ts(3452)/roster.ts(900) 巨文件不拆（H-02 wontfix 依据）。

## 活跃区

`minigame/**`、`src/street/**`、`src/core/**`（street 复用到的模块）、`scripts/harness/**`、`tests/**`。
`src/core/engine.ts` 双端共享，改它 = 改小游戏，须跑全量测试。

## 门禁差异

- biome：frozen 区 any/`!` 全局 off；活跃区 error（overrides.ignore 实现）。
- xss.mjs：frozen 区插值 innerHTML 仅 WARN（34 处存量静态为主，见 H-14）；活跃区 FAIL。
- hygiene 棘轮：frozen 大文件白名单只收不放。
- perf/visual/Lighthouse：保留运行（回归雷达），阈值不再收紧。

## 解冻条件

小游戏提审通过且留存 ≥ 4 周，或产品决策转 H5。届时按 harness 流程重扫本区。
