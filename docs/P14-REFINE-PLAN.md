# P14 · 声之细织（端侧自动断句 + 自适应难度 2.0）详细方案

> 2026-09-20 · GROWTH-PLAN §6 的实施文档。两条主线：**让麦克风通道不再「等满 8 秒」**，**让自适应难度从「连胜计数」升级为按幕评级**。
> 总纪律继承 AGENTS.md：零后端、隐私不出设备（只存分数/胜负聚合）、零素材、≤350KB gzip、reduce-motion、确定性、旧局逐位不变。
> 两条红线：① 端点策略**关闭即等价旧行为**（不是「差不多」，是逐位一致）；② 难度评级**每日与切磋局禁用**（同码同难，P12 契约不放松）。

## 0. 现状核对（先说清楚缺什么，再说做什么）

| 项 | 现状 | P14 的判断 |
|---|---|---|
| Silero VAD | `sensevoice.worker.ts` 已 `createVad()` 并经 `sherpa-onnx-vad.js` 跑 VAD；`speech_start` 已上报 | **已有**，不重造轮子、不加第二个运行时 |
| 端点参数 | 用运行时默认；段完成即 decode 出结果 | 缺口：参数不可配、策略埋进 wasm **无法单测**、无法量时延 |
| 自动收音开关 | 无。施法靠松手 PTT 或 `VOICE_CAPTURE_MAX_MS`（8s，`balance.ts` 实测值）兜底 | 缺口：停手即判定的能力没有开关注释，也没降级文档 |
| 自适应难度 | `profile.stats.adaptiveStreak`（-2..3）→ `adaptiveBoostFor` 返回 0 / +0.05 / −0.08 | 缺口：粒度粗（只分三档、跨模式共用一个数、与「哪一幕」无关） |

**结论**：P14 不引新模型、不进首包预算，只做三件事——把端点策略**抽成纯函数**、把开关与降级**显式化**、把难度改成**按幕评级**。

## 1. 端侧自动断句

### 1.1 纯策略 `src/core/endpoint.ts`（可单测、可量时延）

```ts
export const ENDPOINT_WINDOW_MS = 32;   // sherpa silero windowSize 512 @ 16kHz
export const MIN_SPEECH_MS   = 400;     // 开口：累计语音 ≥ 400ms 才算真的在说
export const MIN_SILENCE_MS  = 300;     // 收口：句尾静默 ≥ 300ms 即截断送识别
export type EndpointEvent = "none" | "speech-start" | "auto-stop";

class EndpointPolicy {
  push(voiceDetected: boolean, nowMs: number): EndpointEvent;
  get speaking(): boolean;
  /** 上一次 auto-stop 的「收口时延」= 最后一帧语音 → 判定 的毫秒数（如实、可测）。 */
  lastLatencyMs(): number | null;
  reset(): void;
}
```

- 语义：`speech-start` 每段只发一次（首帧语音起累计 ≥ `MIN_SPEECH_MS`）；`auto-stop` 只在**已经 speech-start** 且连续静默 ≥ `MIN_SILENCE_MS` 时发一次，然后回到 idle。
- 零随机、零 IO、零时钟依赖（`nowMs` 由调用方给）→ 同输入必得同事件序列。
- 时延常数即上限：`auto-stop` 的收口时延恒等于 `MIN_SILENCE_MS`（+ 一窗量化误差），这正是「不再等满 8 秒」的来源。

### 1.2 worker / adapter 接线（薄封装）

- **worker**：`init` 增 `endpoint: { autoCapture, minSpeechMs?, minSilenceMs? }`；`handleAudio` 把每窗 `vad.isDetected()` 喂给 `EndpointPolicy`。
  - `autoCapture: true`：`speech-start` 照发；`auto-stop` 时 `vad.flush() + drainVadAndDecode()`（与手动 flush 同一条路径）。
  - `autoCapture: false`：**完全不喂策略**（不构造、不判定）→ 只在 `flush` 消息时 drain，与 P13 及以前逐位一致。
- **adapter**：构造参数 `autoCapture?: () => boolean`（组合根注入设置，逐次施法实时读取）；8s `VOICE_CAPTURE_MAX_MS` 兜底保留（策略失效也不会挂死收音）。
- **设置**：`GameSettings.autoCapture?: boolean`（缺省 = 开，旧档自动开）；设置页开关「自动收音」，文案如实说明「关闭则回到松手判定 / 8 秒上限」。

### 1.3 验收与诚实边界

- 单测：边界（399/400、299/300ms）、只触发一次、静默中不误报、`reset` 清态、`autoCapture=false` 零事件。
- 时延报表（`tests/sim/p14-latency.test.ts`）：确定性合成轨迹（含 4 类说话节奏 × 固定种子）上量 **p50/p90 收口时延**，auto vs 固定窗口对比；断言 auto p50 ≤ `MIN_SILENCE_MS` + 一窗。
- **诚实边界**：CI 无麦克风、模型 238MB 不进 CI，所以上表是**策略级**时延（判定 → 出结果之前的固定开销），不是「真实端到端 p50」。真机端到端时延必须在设备上量（DEVICE-TEST-MATRIX 增一行），文档与报告都不把这笔账混起来算。
- QTE / 键盘通道零影响：它们根本不走麦克风适配器（契约测试锁定调用面）。

## 2. 自适应难度 2.0（本地在线启发式）

### 2.1 纯规则 `src/core/difficulty.ts`

```ts
export const DIFFICULTY_TARGET = 1500;   // 目标强度（=「势均力敌」的对手分）
export const DIFFICULTY_K = 24;          // 在线更新步长
export const DIFFICULTY_POINTS_PER_BOOST = 2000;  // 2000 分 = 100% 缩放
export const DIFFICULTY_BOOST_CAP = 0.15;         // 与引擎 scaledEnemy 的 ±15% 钳制同源

export type DifficultyKey = "classic" | "endless" | "act1" | "act2" | "act3";
export interface DifficultyStore { ratings: Partial<Record<DifficultyKey, number>>; wins: number; losses: number }

difficultyKeyFor(mode: { endless, campaign, act }): DifficultyKey
ratingUpdate(rating: number, won: boolean): number        // logistic: expected = 1/(1+10^((TARGET-r)/400))
boostForRating(rating: number): number                    // clamp((r - TARGET)/POINTS_PER_BOOST, ±0.15)
recordDifficultyResult(store, key, won): DifficultyStore  // 纯函数，返回新档
boostFor(store, key): number                              // 未开局（无数据）→ 0
```

- 数值全整数化（rating 取整、boost 保留 4 位）→ 同输入同输出，可进契约测试。
- 方向：rating 高于目标 = 玩家在该幕更强 → **加难**（正 boost）；低于目标 → **减压**。上限 ±15% 与既有 `scaledEnemy` 钳制一致（双保险）。
- 键：经典 / 无尽 / 各幕分开记账（战役三幕难度曲线不同，共用一个数会互相污染）。

### 2.2 接线

- 存储：`voice-tower-difficulty-v1`（只放 rating 与胜负计数，**不含任何对局内容**）。
- 组合根：`engine.adaptiveProvider = (ctx) => settings.adaptiveEnabled !== false ? boostFor(store, difficultyKeyFor(ctx)) : 0`。
- 引擎：`AdaptiveProvider` 签名扩为 `(context?: AdaptiveContext) => number`（`{ endless, campaign, act }`），`startNew`/`startEndless`/`startCampaign` 采样时传入；**零参 lambda 依旧 typecheck**，既有契约测试不动。
- 每日挑战 / 切磋局：**保持现状**（显式 `adaptiveBoost = 0` / 取自码内）——P12 的「同码同难」契约一条不改。
- 结算：`recordRunToProfile` 里按（模式/幕）更新评级并落盘；旧字段 `profile.stats.adaptiveStreak` 保留（老存档兼容、成就仍在用），但**不再驱动难度**（文档标注）。
- 文案：设置页与自适应徽标如实写「本地启发式评级，不是机器学习」。

### 2.3 验收

- 单测：更新公式（满分/零分两侧收敛）、钳制边界、键归一（未知模式 → classic）、纯函数无副作用、`boostFor` 未开局 = 0。
- 契约（`tests/contract/p14-refine.test.ts`）：① provider 上下文按幕取值；② 关开关 = 0 且不影响其它状态；③ 每日/切磋钉 0（P12 契约补充）；④ 难度档只含 rating/计数（白名单）；⑤ QTE 不经过端点策略。
- E2E（`tests/e2e/p14.spec.ts`）：设置页「自动收音」默认开 → 可关 → 刷新后仍关；调试钩子 `__VOICE_TOWER__.voice.autoCapture()` 与设置一致；QTE 一局施法日志逐位不变。

## 3. 明确不做

- 不引第二运行时/第二模型、不改首包预算（VAD 随既有 sherpa 数据包，不进 350KB 账）。
- 不做云端难度画像、不上传对局、不做「AI 教练」话术（本地启发式，文案不夸大）。
- 不改 P8-B/P9/P10/P11/P13 任何平衡曲线；不改每日/切磋的同局契约。
- 不做真实端到端时延的 CI 断言（无麦克风）；只做策略级时延报表 + 设备矩阵手工记录。

## 4. 里程碑

- F1 纯规则（`endpoint.ts` + `difficulty.ts`）+ 单测。
- F2 接线（worker/adapter/设置页/组合根/结算）+ E2E。
- F3 契约 + 时延报表 + 文档回填 + 全门（含七仿真零漂移）。

## 5. 实施记录（2026-09-20 回填）

### 5.1 与原方案的三处差异（均已定案）

1. **不新增模型下载**：原案写「worker 增挂 silero-vad 模型（~2MB ONNX）」——核对发现 sherpa 的 vad-asr 运行时**已含** Silero VAD
   且已在跑（`createVad` / `sherpa-onnx-vad.js`）。P14 因此不引模型、不进首包预算，只补两侧缺口：
   ① 端点策略抽成纯函数（可测、可量时延）；② 自动收音开关与降级显式化。省掉的正是「再引一个运行时」的风险面。
2. **兜底窗口实测是 8 秒不是 6 秒**：`VOICE_CAPTURE_MAX_MS = 8000`（`balance.ts`），方案初稿误写 6 秒，已在本文件与
   UI 文案、测试注释中全量更正。
3. **难度采样点在建局时、而非开局后**：原案含糊写「按幕评分」。定案是 `createRunState(seed, context)` 一次性采样
   （经典/无尽/各幕分开记账），续行换幕时按新幕**重采样**（同一局跟随幕变化）；每日挑战与切磋局原样钉 0 / 取码内值。

### 5.2 落地清单

- 核心层：`src/core/endpoint.ts`（`EndpointPolicy`：32ms 窗 / 400ms 开口 / 300ms 收口 / 时延如实 / 段计数）、
  `src/core/difficulty.ts`（Elo 式在线更新、`±15%` 钳制、按模式键、脏档归一、如实摘要）。
- 接线：worker（`endpoint` 消息 + `endpoint_stop` 事件；**关闭时不构造策略**，drain 仍只在 flush 路径）、
  adapter（`autoCapture` 提供者，逐次施法下发）、`createVoiceAdapter` 透传、`GameSettings.autoCapture`、
  `voice-tower-difficulty-v1` 存储、引擎 `AdaptiveContext` 采样 + 续行重采样、UI 设置页开关与结算记账、
  调试口 `__VOICE_TOWER__.voice`（`autoCapture` / `endpointPolicy` / `difficulty` / `recordResult`）。
- 测试：unit 2 新（endpoint 8 例 / difficulty 9 例）+ contract 1 新（p14-refine 9 例）+ sim 1 新（p14-latency 3 例）+ e2e 1 新（p14，4 例）。

### 5.3 验收数字（2026-09-20）

- 端点时延（策略级，n=48 合成轨迹）：自动收音 **p50 320ms / p90 320ms**；旧行为 **p50 6336ms / p90 7296ms**（−95%）。
  ⚠ 这是策略级口径，端到端须真机复核（见 `docs/P14-LATENCY-REPORT.md` 的诚实边界）。
- 难度：目标分处赢 +12 / 输 −12；连赢 6 局的增量逐局递减；200 连败不会跌破 0；±200 分差 = ±10% 缩放并被 ±15% 钳死。
- 质量门：biome 157 文件 ✅ / tsc ✅ / vitest **518** ✅ / E2E **54** ✅ / perf **106.4/350 KB gzip** ✅ / release-readiness 44 ✅。
- 八条仿真（sim / p7 / p8 / p8b / p9 / p10 / p11 / p13）与 P11 基线报表零漂移（基础报表仅时间戳）。
- 参考截图：`outputs/p14-settings.png`、`p14-settings-toggle.png`。

### 5.4 诚实边界

- 「自动断句」的收益只在**端侧引擎**（sensevoice 适配器）生效；Web Speech 通道不经过端点策略（其自身有浏览器内建的静音判定）。
- 300ms 静默阈值在嘈杂环境可能偏短（误截断）；真机调参范围，不进自动化门。
- 难度评级是**本地启发式**（无训练、无模型），胜率期望只是 logistic 假设；文案与报告一律不称 ML。
- 老档兼容：`profile.stats.adaptiveStreak` 保留（成就与存档兼容），但**不再驱动难度**。
