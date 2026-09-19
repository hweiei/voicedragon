# P11 · 声动九霄（满堂彩绝技 + 纵向分层音乐）详细方案

> 2026-09-20 · GROWTH-PLAN §3 的实施文档。连续正音蓄「彩」，彩满发动角色绝技长句（完整语音评分）；战斗音乐升级为三层纵向分层 + stinger。
> 本期不新增技能类型、不改 P8-B/P9/P10 曲线与门；旧局（无 ultimateVersion）同一 seed 逐位不变。

## 1. 满堂彩（Bravo）纯规则 — `src/core/bravo.ts`

- `bravoTransition(prev, rawScore)`：基于**裸分**（不含声韵成长/骊珠/干扰）：≥85 蓄彩 +1 封顶 3；<65 断彩；其间保持；**每场绝技一次**。初版"最终分 + 中段保彩"经仿真证伪（正音率 ~45%、场均 4 绝技、花旦 81% 越带）；"严格连续"对普通玩家过苛——折中定案：彩看真实发音，练声只提升伤害。破阵拍同规则（甜区深处即正音档）。
- `ultimateEnabled(state)`：`ultimateVersion===1 && ruleset==="p7" && campaign`。
- `ultimateResolve(characterId, tierMultiplier, toneScore)` → 绝技效果计划（纯数据，引擎套用）：

| 角色 | 绝技句（粤拼） | 效果（×档位倍率） |
|---|---|---|
| 文武生 | 锣鼓响好戏开场（lo4 gu2 hoeng2 hou2 hei3 hoi1 coeng4） | 重击 round(15×倍率)（+声势/露隙照常）；裸分 ≥85 无视护甲 |
| 花旦 | 莺声婉转绕梁三日（jing1 sing1 jyun2 zyun2 jiu2 loeng4 saam1 jat6） | 回复 round(5×倍率) + 护甲 round(5×倍率)；调准 ≥80 再 +2 回复；裸分 ≥65 清发音干扰 |
| 丑生 | 好戏在后头（hou2 hei3 zoi6 hau6 tau4） | 伤害 round(5×倍率) + 虚弱 3 回合 + 夺敌方剩余全部护甲（伤害先耗甲）+ 立刻换手 |

- 绝技**不消耗声气**、消耗全部 3 彩；绝技自身的分数**不回馈蓄彩**（防自循环）；不占用/消耗 firstAttack 与遗物触发（效果自包含，文档化）。

## 2. 引擎与内容

- `GameState.ultimateVersion?: 1`（CampaignConfig 新字段，组合根 config 直通）；`CombatState.bravo?: number`（缺省 0，随存档）。
- `resolveSkill` 计分后应用 `bravoTransition`（仅 ultimateVersion 局）；`castUltimate(rawScore, voiceMeta)`：守卫（battle/未锁/彩=3/版本开）→ 与施法同式计分（声韵/骊珠/干扰）→ 套用计划 → 胜利/半血 pending 检查（与反击共用语义）→ emit `effect:"ultimate"`。
- 绝技句注册为 `src/core/content/ultimates.ts` 的 `ULTIMATE_SKILLS`（3 张，进 `ALL_SKILLS` 供图鉴/练习场/SRS，**不进任何 skillsFor 卡池**——奖励/夜市不可获取）；type 仅作图鉴标签（attack/heal/weaken），power/cost 不参与战斗。内容计数契约演进：ALL_SKILLS 40→43。
- 短句-音节数约束沿用内容契约（绝技句无标点，7/8/5 音节）。

## 3. UI / 演出 / 音频

- 战斗 HUD：玩家侧「彩」三点计（ultimateVersion 局）；彩满发光 + 出现「满堂彩 · 发动绝技」按钮 → 复用语音弹层（完整评分，含调准通道）；QTE 通道同规则。
- 还击/绝技消息置顶日志；演出复用既有 hit 演出与汉字粒子，reduce-motion 降级为静态高亮。
- `GameAudio` 新增：`setLayers({ rhythm, sparkle })`（节奏层 = Boss 二阶段或生命 <40%；彩层 = 彩 ≥2）与 `stinger(kind)`（绝技/三星结算短句）。零素材：节奏层 = 噪声短促打击，彩层 = 高八度拨弦概率叠加，stinger = 上行三连音。层开关由纯函数 `bgmLayersFor(state)` 计算（可单测），main.ts 订阅时注入。

## 4. 仿真与平衡门（`npm run sim:p11` → docs/P11-BALANCE-REPORT.md）

- Bot：彩=3 时贪心 Bot 以同分布施法分发动绝技（不偷看）；默认参考 Bot（均值 74）绝技罕见——验收带 45–65% 不放宽；另设高声韵行（均值 92）专项驱动绝技真实触发，断言 `ultimateCasts > 0` 与发音梯度。
- 只调绝技自有数值（基数/倍率），不动角色牌组、被动与旧曲线。

## 5. 测试与验收

- `tests/unit/bravo.test.ts`：转移边界（85/84/40/39）、三角色绝技计划数值、门控。
- `tests/contract/p11-ultimates.test.ts`：参数门控与旧局零漂移；彩累积/归零/满值封顶；绝技守卫（错误阶段/彩不足/旧局返回 null 且零副作用）；三角色效果落地数值；绝技不回馈彩；胜利/跨半血语义；确定性同 config 逐位一致；JSON 往返；卡池隔离（ULTIMATE 不进 skillsFor 任何组合）；ALL_SKILLS 43。
- `tests/sim/p11-balance.test.ts`：默认带 + 高声韵行 ultimateCasts>0 + 梯度。
- `tests/e2e/p11.spec.ts`：彩点与绝技按钮出现 → QTE 全流程 → 日志/效果；旧局无彩 UI。
- 全量门 + 预算（本体 JS 预估 +3 KB gzip 内）；E2E 数量与内容计数契约随版本演进更新。

## 6. 明确不做

- 不做多角色同时绝技、绝技升级树、绝技羁绊；不为绝技新增 SkillType 或卡池入口。
- 不引音频素材/库；不做 WebGPU 类渲染升级（GROWTH §0.3 已归档拒绝）。
- 绝技不进切磋码版本束之外的旧局（P12 再统一入束）。

## 7. 实施与验收记录（2026-09-20 回填）

- **落地范围**：`src/core/bravo.ts`（bravoTransition/ultimateEnabled/ultimateResolve 纯规则）、`src/core/content/ultimates.ts`（3 张绝技句）、engine（`ultimateVersion`/`CombatState.bravo`/`ultimateUsed`、resolveSkill 裸分蓄彩、`castUltimate`）、audio（`bgmLayersFor` 纯函数 + `setLayers`/`stinger`/hat 原语 + scheduleAhead 分层乐器）、main.ts 订阅接线、ui（彩三点计 + 满堂彩按钮 + `openUltimate` 复用 `renderVoiceSheet`、绝技结果进 SRS/profile）、sim Bot 绝技（返回 null 时回落出牌，防 once-per-battle 死循环）。
- **平衡三轮定案**（勿回退）：①「最终分蓄彩 + 中段保彩」→ 默认 Bot 场均 4 绝技、花旦 81% 越带，证伪；②「严格连续正音」→ 仍 66–68% 过强；③ 终案 = **裸分（≥85 蓄 /<65 断 / 其间保持）+ 每场一次**：默认行逐位回归 P10 基线，高声韵行（裸分均值 92）act1 99.7%、5444 casts，低声韵行（均值 60）0 casts。
- **验收**：`npm run sim:p11` 9 格零超时全带内（`docs/P11-BALANCE-REPORT.md`）；vitest 416/416（+20：unit bravo 6、contract p11 6、sim p11 5、audio-map +3）；E2E 41/41（彩计/绝技全流程/旧局无彩 UI；彩累积走调试 API——UI 破阵拍分数依赖点击时序）；发布矩阵 19 过 1 跳；Lighthouse 移动 99（TBT 112ms）/ 桌面 100×4；预算 89.9/350 KB gzip；六条旧仿真（sim/sim:p7/p7:p8/sim:p8b/sim:p9/sim:p10）数据行逐位零漂移。
- **诚实边界**：绝技演出复用既有 hit/浮字（无专属大特效，演出升级不在本期）；分层音乐为振荡器合成（无采样），层间为即时开关无 1–2 小节交叉渐变；E2E 彩累积走调试 API 而非 UI 时序点击。
