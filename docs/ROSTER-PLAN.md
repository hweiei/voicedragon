# P10 · 名伶登场（角色系统）详细方案

> 2026-09-20 · GROWTH-PLAN §2 的实施文档。三名粤剧行当角色（文武生/花旦/丑生），各带招牌被动、起始牌组与签名技；CampaignConfig 参数对象重构先行。
> 本期不新增敌人、不改 P8-B/P9 平衡曲线与战斗核心签名（参数对象重构理由见 §2）；旧局（legacy/P7/P8-A/P8-B/P9/每日/无尽）在同一 seed 下逐位不变。

## 1. 角色设计（数据驱动，`src/core/content/roster.ts`）

| 角色 | 定位 | 招牌被动（纯规则） | 起始牌组 | 签名技 |
|---|---|---|---|---|
| **文武生** man6 mou5 saang1 | 攻势/声势 | 「亮相」：每场战斗首次**正音**(≥85)施法，声势 +2（当次施法即受益） | 钉缸声×2 / 好犀利 / 执生啦 / 加油 | 「一夫当关」attack·2气·16：正音时无视护甲 |
| **花旦** faa1 daan2 | 声调/节奏 | 「绕梁」：**调准分 ≥80** 的施法额外 +2 护甲；无声破阵拍无调准通道不触发（不伪造 F0 结论，沿用 P8-C 纪律） | 一齐上 / 快啲走 / 唔使惊 / 执生啦 / 有冇搞错 | 「顾盼生辉」heal·2气·9：良好(≥65)额外清除发音干扰 |
| **丑生** cau2 saang1 | 诡变/节奏 | 「打诨」：**破阵拍(QTE) ≥85** 回 1 点声气（每回合一次）——无声游玩友好角色 | 快啲走 / 唔使惊 / 执生啦 / 有冇搞错 / 还返俾你 | 「搞掂晒」weaken·2气·7：再夺敌方半数护甲归己 |

- 解锁：文武生默认；花旦 = 一幕 Boss 通关（战役元存档 bossCleared）；丑生 = 点亮 8 枚成就（profile.unlocked）。解锁态只读本地存档，诚实显示条件。
- 丑生起始牌含 P9「还返俾你」：反击战役（counterVersion=1）下完整生效；引擎允许版本独立，未开 counter 版本时该卡仅提供护甲（文档化，不做替换逻辑）。
- 签名技进**角色限定池**：仅该角色的 roster 战役在奖励/夜市/事件学艺中可见（`skillsFor` 第 4 参）；图鉴全集收录（40 招式）。
- 签名技升级入表（仅威力）：一夫当关 16→19、顾盼生辉 9→12、搞掂晒 7→10。

## 2. CampaignConfig 参数对象重构（Introduce Parameter Object）

- 理由（按 AGENTS.md 纪律显式说明）：`startCampaign` 位置参数已达 6 个，角色参数将成第 7 个，布尔盲化与调用点误传风险陡增；参数对象是标准解法（Fowler 重构目录）。
- `startCampaign` 接受 `CampaignConfig` 对象**或**旧位置参数（联合首参，非 TS 重载声明，保 wrapper 的 `Parameters<>` 推导）；旧位置签名行为逐位不变，现有契约/E2E/组合根零改动。
- `CampaignConfig { act?, seed?, ruleset?, buildVersion?, encounterVersion?, counterVersion?, rosterVersion?, character? }`；`character` 缺省为文武生（确定性缺省）。
- 组合根 wrapper 归一化两种形态后注入同幕种子；`__VOICE_TOWER__.startCampaign` 原样透传。

## 3. 引擎与纯规则

- `GameState.rosterVersion?: 1`、`characterId?: CharacterId`；`CombatState.passives?: Record<string, boolean>`（每场标记，`jest-turn` 每回合重置；旧档缺省 = 不启用，零漂移）。
- `src/core/roster.ts` 纯规则：`applyCastPassive(ctx) → { strengthDelta, armorDelta, energyDelta, passives } | null`（预测与结算共用；文武生/丑生各带一次性标记，花旦无标记逐次判定）；`resetTurnPassives(passives)`。
- `VoiceResultMeta` 增加 `toneScore?: number | null`（适配器已产出、UI 已整体透传，引擎侧只是补声明；WebSpeech/QTE 恒 null → 花旦被动诚实不触发）。
- 钩子点：`resolveSkill` 计分后、分支前应用被动增量（亮相的声势计入当次伤害，绕梁护甲计入当回合，打诨在扣气后返还）；`endTurn` 重置回合标记。签名技效果走既有 per-skill 钩子先例（掂过碌蔗/得闲饮茶）。
- 起始牌组：`startCampaign` 在 roster 局以角色牌组覆写 `player.deck`（不耗 RNG）；legacy 局保持 `STARTER_DECK` 逐位不变。

## 4. UI/UX

- 标题屏「战役 · 第N幕」→ 弹出名伶选择sheet（角色卡：字形徽、名、粤拼、定位、被动、起始牌组概览）；锁定卡显示解锁条件并禁用；选中即以全栈（p7,1,1,1,roster1,character）开新局。
- 战斗状态行「你」附注角色名；被动触发写入战斗日志（亮相/绕梁/打诨各一句）；390px 单列布局；reduce-motion 不受影响（无新动效）。
- 「乘胜登楼」跨幕保留角色（状态内字段，无新 UI）。

## 5. 仿真与平衡门（`npm run sim:p10` → docs/P10-BALANCE-REPORT.md）

- 3 角色 × 3 幕 × greedy 300 局，验收带 45–65%、零超时；每角色 act1 随机 Bot 下限。
- 诚实标注：**花旦被动在仿真中不触发**（Bot 无调准通道，报告为牌组下限）；**丑生以 qteSource 全程模拟**（= 全程无声破阵拍玩法的乐观界，真实玩家介于两者之间）；文武生被动照常计入。带内不达标只调角色自有数值（牌组构成/签名技威力），不动公共曲线。
- `SimRunResult.passiveHits`：亮相/打诨实际触发计数（对比施法前后 passives 标记），证明机制真实运转。

## 6. 测试与验收

- `tests/unit/roster.test.ts`：纯规则（三被动触发/不触发边界、一次性标记、回合重置）。
- `tests/contract/p10-roster.test.ts`：参数对象与旧签名等价（同参同状态哈希）；起始牌组与图鉴池隔离；被动确定性；旧局零漂移（P9 局加角色字段前后逐位一致）；JSON 往返含 characterId/passives；解锁判定纯函数。
- `tests/sim/p10-balance.test.ts`：§5 验收带。
- `tests/e2e/p10.spec.ts`：名伶sheet可见与锁定态；选角开局四版本号+角色落位；丑生 QTE 回气日志；旧存档局无角色文案。
- 全量门：Biome/TS/Vitest（预计 ~396 项）/Chromium E2E/发布矩阵/Lighthouse/44 契约不放宽；内容计数契约按版本演进（ALL_SKILLS 37→40、升级表 13→16、标题屏 37→40 招式）。
- 预算：本体 JS +约 5 KB gzip（新内容与纯函数），VAD/模型类资产零新增。

## 7. 明确不做

- 不做第四角色、角色皮肤数值化、角色专属敌人/事件（P11 绝技再深化角色差异）。
- 不为角色改公共敌人曲线、不改 P8-B/P9 门。
- 不做账号/云解锁同步（解锁态本地存档）。

## 8. 实施与验收记录

2026-09-20 已按本方案完成：

- **参数对象重构**：`CampaignConfig` + `StartCampaignArgs` 联合首参落地；旧位置签名等价转发（契约：同参同状态哈希）；组合根 wrapper 归一化两种形态，旧契约/E2E 零改动（走 UI 入口的旧 E2E 补选角步骤属预期流程变更）。
- **角色与被动**：文武生「亮相」（每场首次正音当次伤害 +4，经三轮仿真由常驻声势 +2 改为一次性爆发）、花旦「绕梁」（调准 ≥80 每次 +2 护甲，无声通道诚实不触发）、丑生「打诨」（破阵拍 ≥92 每回合回 1 气，阈值 85→92 限频）。`combat.passives` 标记随存档序列化，回合标记 endTurn 重置。
- **签名技**：一夫当关（正音破甲）/ 顾盼生辉（≥65 清干扰）/ 搞掂晒（伤后夺半数敌甲）进角色限定池（`skillsFor` 第 4 参）；升级入表 16 项；图鉴全集 40 招式。
- **UI**：名伶选择 sheet（锁定态诚实显示条件：一幕 Boss / 8 枚成就，本地只读）；战斗状态行「你 · 角色名」；被动消息置顶 HUD；390px 单列。
- **平衡**（`npm run sim:p10` → P10-BALANCE-REPORT.md）：文武生 **63.0/59.0/56.3**、花旦 **64.3/60.3/59.0**（牌组下限，被动无调准通道不触发）、丑生 **61.7/58.3/52.0**（qteSource 乐观界）；九格全部 45–65%、零超时；passiveHits 2741–3182（文武生）/843–1183（丑生）；随机下限 0–1%。三套牌组经侧向置换校准，未动 P8-B/P9 曲线。
- **质量门全绿**：Biome / strict TS / **41 文件 396 项 Vitest**（+21）；Chromium E2E **38/38**（+3，旧 11 项补选角步骤）；发布矩阵 **19 过 / 1 明确跳过**；Lighthouse 移动 **99/100/100/100**（TBT 71ms）、桌面 **100×4**；发布契约 44 项 ✅；本体 JS **87.6 / 350 KB gzip**。
- **零漂移**：sim / sim:p7 / sim:p8 / sim:p8b / sim:p9 同种子与已提交报告逐位一致（含 P9 counterHits 1841/1925/1686）。
- 限制：花旦被动未在仿真中触发（无调准通道）；角色手感差异需真人试玩；解锁条件依赖本地存档，无云同步。
