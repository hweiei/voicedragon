# P9 · 守势反击（反击姿态）详细方案

> 2026-09-20 · 用户选择 P9「守势反击」。P8-A 构筑期把「守势反击」暂改为准确的「守势攻防」，并把反击机制另立后续方案与独立平衡门；本期兑现该承诺。
> 本期不新增 SkillType、不新增敌人或 Boss、不改变 P8-B 平衡曲线、不触碰旧局任何行为；经典 / P7 / P8-A / P8-B 局在同一 seed 下的结果必须逐位不变。

## 1. 目标与当前缺口

1. 「守势攻防」流派目前只有"护甲 + 虚弱 + 穿插输出"，防守回合是纯支出——挡得越多，节奏越亏。
2. 反击机制自 P0 起多次出现在设计讨论（龙鳞遗物是敌方侧的先例），但玩家侧从未有"把被挡伤害打回去"的表达。
3. 反击若直接挂进全局引擎，会改变所有旧局行为，违反内容兼容纪律——必须版本化门控。

## 2. 机制设计：反击姿态（Counter Stance）

**核心规则（纯函数，预测与实际结算共用）**：

- 施展反击技能 → 获得护甲，并进入**反击姿态**（combat 上记录 `{ ratio }`，随存档序列化）。
- 敌方回合行动完全结算后（含其护甲获取），统计本次行动**被护甲挡下的总伤害 `blocked`**：
  - `blocked > 0` → 还击 `max(1, floor(blocked × ratio / 100))` 点；
  - 敌方处于露隙（vulnerable）时还击 ×1.25，与玩家攻击同规则；
  - 还击先被敌方护甲吸收（不穿甲）；guardAttack 类对手天然抑制反击。
- **穿甲（pierce）不触发**：穿甲段 `blocked = 0`，与龙鳞"穿甲不耗甲、不补甲"同语义——P8-B 穿甲精英/Boss 是反击构筑的天敌。
- 姿态在被触发一次后消耗；敌方纯护甲 / 纯削弱回合（无伤害）不消耗姿态。
- 还击可击杀敌人（敌方回合内胜利）；可把 Boss 打到半血——此时按既有 pending 语义，在本回合行动结束后立即提交二阶段（不中途换招）。
- 结算次序：敌方行动 → **反击** → 层甲词缀 → 虚弱/露隙递减 → 存活检查。反击打在层甲生成前的护甲上；行动自带的露隙（selfVulnerable）在本回合反击之后才生效。

**新技能（唯一入口，仅反击版本卡池出现）**：

| 字段 | 值 |
|---|---|
| id | `p9-waan-faan-bei-nei` |
| 名称 / 短句 | 还返俾你（waan4 faan1 bei2 nei5） |
| 类型 / 稀有度 | guard / common（守势攻防流派计数自然纳入） |
| 费用 / 威力 | 1 / 7 点护甲（升级 10，仅威力，P8-A 纪律） |
| `counter` | `{ ratio: 50 }`（Skill 新增可选字段，语义对齐 EnemyIntent.pierce 的"仅新版本内容使用"先例） |
| 描述 | 获得 {power} 点护甲并摆出反击姿态：敌方下次攻击被护甲挡下时，按 50% 被挡伤害还击（穿甲不触发）。 |

## 3. 版本门控与内容管线

- `GameState.counterVersion?: 1`；`startCampaign` 新增第 6 参数 `counterVersion`，仅在 `ruleset === "p7"` 时落位——与 buildVersion / encounterVersion 完全同构，互不连带。
- 组合根（main.ts 包装器与 `__VOICE_TOWER__` 调试口）必须完整转发第 6 参数；UI 新战役按钮传 `(act, undefined, "p7", 1, 1, 1)`；旧存档缺失字段 = 未启用，行为逐位不变。
- `skillsFor(act, ruleset, counterVersion?)`：仅 `p7 + counterVersion === 1` 时把 `COUNTER_SKILLS` 并入累计池（奖励 / 夜市 / 事件学艺共用同一入口）；`skillsUpToAct`（legacy）与不带 counterVersion 的调用结果不变。
- `ALL_SKILLS` / 图鉴收录新卡（跨版本可见即可读），但获取只在反击战役——p7-content 契约的 `ALL_SKILLS` 计数 36 → 37 需随版本注明更新，这是内容计数契约的既定演进方式。

## 4. 纯规则与预测

新增 `src/core/counter.ts`（零 DOM、零 IO、零随机）：

- `counterEnabled(state)`：`counterVersion === 1 && ruleset === "p7" && campaign` 存在。
- `resolveCounterDamage({ blocked, ratio, enemyArmor, enemyVulnerable })` → `{ damage, armorAfter }`：floor、下限 1、露隙 ×1.25、敌方护甲吸收。引擎实际结算与 `previewIntent` 预测共用此函数——预测显示"反击预计 X 点"，实际必须同式。

## 5. 独立平衡门（不碰旧曲线）

- `SimOptions.counterVersion`：`simulateAct / simulateCampaign` 透传 `startCampaign`；`SimRunResult.counterHits` 统计实际打出伤害 ≥1 的还击次数。
- 贪心 Bot 的消费者策略（不偷看隐藏状态）：威胁 ≥10 且非穿甲、当前无姿态时，反击卡权重按"护甲 + 预期还击"估值；姿态已存在时不重复施展；奖励三选一按同等估值，不特殊偏袒。
- `npm run sim:p9` → `docs/P9-BALANCE-REPORT.md`（独立分报，不覆盖旧报告）。
- 验收带：参考 Bot（声韵均值 74）三幕 45–65%、零超时、每幕 `counterHits > 0`（证明机制在仿真里真实运转，而非摆设）；若越带只调 P9 自有参数（技能威力 / ratio / Bot 估值），不改 P8-B 曲线、不改旧敌人。
- 旧门不放宽：`npm run sim` / `sim:p7` / `sim:p8` / `sim:p8b` 在同一 seed 下结果必须与 P8-E 时逐位一致。

## 6. UI / UX

- 战斗 HUD：姿态存在时在玩家状态区显示"反击 50%"胶囊；还击写入战斗日志（"反击姿态生效：挡下 X 点，还击 Y 点。"）；演出复用既有 hit 效果，不新增特效计划。
- 意图预览：姿态存在且敌方意图为攻击类非穿甲时，追加"反击预计 X 点"（与实际共用纯规则）。
- 构筑总览：反击战役中「守势攻防」流派描述改为反击版文案；旧局保持"没有自动反击"原文案逐字不变。

## 7. 质量门与验收

- 新增 `tests/unit/counter.test.ts`（纯规则）与 `tests/contract/p9-counter.test.ts`：门控（旧局永不出反击卡、永不结算）、穿甲不触发、无伤害回合姿态保持、还击击杀、还击跨半血 pending 提交、同 (act, seed) 可复现、存档 JSON 往返保姿态、卡池隔离（`skillsFor` 不带版本逐位不变）、组合根转发、升级只加威力。
- 新增 `tests/sim/p9-balance.test.ts`（§5 验收带）与 `tests/e2e/p9.spec.ts`（版本号转发、姿态胶囊与日志、预测与实际一致）。
- 全量门：`npm run ci`、`npx playwright test`（Chromium 业务 E2E）、`npm run sim:p9` 全绿；原有 356 项 Vitest 与 32 项 E2E 不放宽（p7-content 计数契约按版本演进更新除外）。
- 首包游戏本体 JS ≤ 350 KB gzip（新增仅 1 技能 + 1 纯函数模块）；零新增运行时依赖、零素材。
- CodeGraph 同步后提交；提交信息按中文 conventional 风格，正文带测试与预算数字。

## 8. 明确不做

- 不新增 SkillType / 能力位（复用 guard 类型 + 数据化 `counter` 字段，避免全链 switch 扩散）。
- 不做敌方侧反击、不做反反击、不做多段逐段还击（一次行动一次总结算）。
- 不改 P8-B 意图 / 阶段 / 曲线，不改旧敌人数值，不为平衡改战斗核心签名。
- 不在旧局（legacy / p7 / P8-A / P8-B / 每日 / 无尽）出现任何新文案或新行为。
- 不宣称仿真胜率可替代真人试玩手感。

## 9. 实施与验收记录

2026-09-20 已按本方案完成：

- **纯规则** `src/core/counter.ts`：`counterEnabled` 门控与 `resolveCounterDamage`（floor、下限 1、露隙 ×1.25、敌方护甲吸收）；`getIntentPreview` 的还击预测与 `endTurn` 实际结算共用同一函数。
- **内容**：`Skill.counter?: { ratio }` 数据化字段（对齐 `EnemyIntent.pierce` 先例）；新卡「还返俾你」（guard/common/1 气/7 甲，ratio 50，升级 7→10 仅威力）经 `skillsFor(act, "p7", 1)` 只进反击战役卡池，图鉴全集收录（37 招式）。
- **引擎**：`startCampaign` 第 6 参数 `counterVersion` 仅 p7 落位；组合根与调试口完整转发；UI 新战役固定 `(act, undefined, "p7", 1, 1, 1)`。`endTurn` 在敌方行动完全结算后按被挡总量还击，先于层甲词缀；还击可击杀（敌方回合内胜利）、可跨 Boss 半血（同回合提交二阶段）；穿甲不触发不消耗，无伤害回合姿态保留。姿态随存档 JSON 序列化。
- **UI**：姿态胶囊「反击 50%」、还击预测行（`intent-counter`）、还击日志置顶为本回合头条；反击战役的「守势攻防」流派文案切换为反击版，旧局保持"没有自动反击"原文。
- **平衡**：`npm run sim:p9` → `docs/P9-BALANCE-REPORT.md`。贪心参考 Bot 三幕 **59.3% / 63.3% / 53.0%**、零超时、counterHits 1841/1925/1686（全部真实触发）；同种子 P8-B 基线 56.7/56.3/55.3——一、二幕正收益、第三幕穿甲对手负收益，反制关系成立。Bot 按公开信息估值，不偷看隐藏规则。
- **质量门全绿**：Biome / strict TS / **40 文件 375 项 Vitest**（新增 4 纯规则单测 + 9 契约 + 5 仿真门 + 1 计数契约演进）；Chromium E2E **35/35**（新增 P9 三条）；发布矩阵 **19 过 / 1 明确跳过**（WebKit 离线模拟器已知限制，不变）；Lighthouse 移动 **99/100/100/100**、桌面 **100/100/100/100**，LCP 1665ms / TBT 73ms / CLS 0.000 预算内（沙盒共享 CPU 噪声区间 73–382ms 已如实记录于 LIGHTHOUSE-REPORT）；发布契约 44 项 ✅；本体 JS **85.5 / 350 KB gzip**。
- **零漂移**：`npm run sim` / `sim:p7` / `sim:p8` / `sim:p8b` 同种子结果与 P8-E 提交逐位一致（旧报告仅时间戳差异，已还原）；旧局（legacy / P7 / P8-A / P8-B / 每日 / 无尽）不出现反击卡、不结算还击、无文案变化。
- 未做真人试玩校准；反击手感（何时值得花一拍摆姿态）与母语审校仍待实测，不在仿真结论内。
