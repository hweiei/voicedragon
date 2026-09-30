# 根目录工具与 npm scripts 索引

> status: active · updated: 2026-09-30 · 「史」= 历史一次性工具，已归档 `scripts/legacy/`（可运行但不进门禁）

## npm scripts（package.json）

| 命令 | 状态 | 说明 |
|---|---|---|
| `npm run gate` | 活 | **全量门禁**（阶段3 起为唯一入口；等价 CI 的 job 集合） |
| `dev / build / preview` | 活(冻结线) | Web/PWA 线（vite） |
| `test` / `test:watch` | 活 | vitest 全量（tests/**，两条线共用） |
| `check / check:fix` | 活 | biome |
| `ci` | 活 | 旧一键门禁（lint+type+test+双build+预算），将被 `gate` 取代保留兼容 |
| `sim` | 活(冻结线) | web 线平衡模拟 `scripts/balance-sim.ts` |
| `perf` / `test:e2e` / `test:visual` / `test:release` / `test:lighthouse` | 活(冻结线) | web 线质量面（CI 保留） |
| `release:check` / `release:artifact` | 活(冻结线) | web 发布验收 |
| `minigame` | **活（主）** | 构建小游戏提审包（dist） |
| `minigame:preview` | **活（主）** | dist+preview 双构建并起 4190 预览 |
| `codegraph*` | 活 | 代码图谱（AGENTS §5） |
| `sim:p7…sim:p15` | 史 | 已移除；脚本在 `scripts/legacy/` |

## scripts/ 目录

| 文件 | 状态 | 说明 |
|---|---|---|
| `split-mini.py` | **活** | 小批量 TTS 切分器（SOP：`docs/references/tts-pipeline.md`） |
| `balance-sim.ts`、`perf-budget.ts`、`release-readiness.ts`、`lighthouse-budget.ts`、`check-beginner*.mjs` | 活(冻结线) | web 线门禁零件 |
| `harness/*.ts` | 活 | harness 门禁检查集（阶段3 起逐个补齐：deps/size/bundle/assets/docs/coverage/baseline/gates 自测） |
| `legacy/p7-balance.ts … p15-balance.ts`、`split-batch-audio.py` | 史 | 归档：历史平衡扫描与旧版切分器，仅考古用 |
| `harness/*.ts`(检查器) | 活 | registry/baseline/allowlist 三份 JSON 数据在 `docs/harness/`，改规则须同 PR 改 `docs/ARCHITECTURE.md` |
