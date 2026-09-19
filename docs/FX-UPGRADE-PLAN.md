# 《声震龙楼》P6 · 动画 / 动效 / 特效全面升级方案（FX Upgrade Plan）

> 版本：v1.0（2026-09-19）· 状态：**提案（待评审）**
> 范围：`src/ui/fx.ts`、`src/ui/ambient.ts`、`src/ui/styles.css`、`src/adapters/audio.ts`、`src/ui/ui.ts` 及新增 `src/ui/fx/` 模块族
> 原则：**不改动游戏内核（`src/core/` 零侵入）**、不破性能预算、不破无障碍承诺、不引入资产文件

---

## 0. 一句话方案

> 把现有"浮字 + 抖动 + 36 粒微尘"的点缀式演出，升级为**三层渲染 + 事件编排**的
> 演出系统（FxDirector）：以 **View Transitions 场景转场（0 KB）**、**打击感三件套
> （hit-stop / 分级震屏 / 命中闪光）**、以及本项目独有而尚未点亮的王牌——
> **实时语音能量可视化（麦克风频谱 + 六调音高驱动"龙吟光环"）**——
> 让"声即法力"从口号变成肉眼可见的体验；全程零新增运行时依赖（或 ≤6 KB 可选）、
> 尊重 reduce-motion、首包预算增量 ≤ 15 KB gzip。

---

## 1. 现状盘点与差距分析

### 1.1 已有资产（保留，作为地基）

| 模块 | 文件 | 评估 |
|---|---|---|
| 战斗演出 | `src/ui/fx.ts`（84 行） | ⚠️ 浮字/抖动/压暗够用，但 `setTimeout` 散落、无优先级、无 hit-stop、无暴击/连击分级 |
| 氛围粒子 | `src/ui/ambient.ts`（151 行） | ⚠️ 36 粒微尘 + 圆环涟漪，单层 Canvas；无对象池、无发射器、无按幕主题 |
| CSS 动效 | `styles.css`（14 组 @keyframes） | ⚠️ 覆盖入场/受击/节点脉冲等常规项；缺弹性缓动体系、缺转场、缺状态光效 |
| 音频 | `src/adapters/audio.ts` | ✅ 合成 SFX + 生成式五声 BGM；❌ **无 AnalyserNode，声音对画面零反馈** |
| 声调管线 | `adapters/voice/*` + `onPitchFrame` | ✅ 实时基频已在流；❌ **只进评分，不进视觉** |
| 触觉 | `vibrate("light"/"heavy")` | ✅ 已接入 hit/enemy/defeat，与视觉联动可扩展为"三通道同步" |
| 无障碍 | `reduce-motion` 全局开关 | ✅ 承诺不动：所有新特效必须有降级形态 |

### 1.2 差距清单（你没考虑到的方向，本方案的增量）

1. **声音不可见**：游戏卖点是"开声施法"，但说话时画面对声音毫无反应——麦克风能量
   与六调音高没有成为视觉语言（本方案 F2 核心）。
2. **无场景转场**：`ui.render()` 每帧 `innerHTML` 全量重绘，屏幕切换是硬切——
   View Transitions API 已于 2025-10 进入 Baseline（Chrome 111+/Safari 18+/Firefox 133+），
   0 KB 成本可做电影级形变转场，不支持的浏览器自动无感降级。
3. **打击无"重量"**：缺 hit-stop（命中瞬间 40–80 ms 冻结）、缺按伤害分级的震屏幅度、
   缺闪光→抖动→浮字的 0/16/40 ms 交错节奏（游戏打击感领域的标准配方）。
4. **演出无编排者**：`playBattleFx` 是命令式 if-else，多事件并发时互相打架；
   缺优先级、去重、队列与"全局冻结门"（hit-stop 期间应暂停其他演出时钟）。
5. **粒子系统一次性**：无对象池（长战斗产生 GC 抖动）、无发射器抽象、无胜利烟花、
   无三幕主题差异（龙楼炭火 / 雾海海雾 / 云顶光束）。
6. **帧率无治理**：粒子和 rAF 各自为政；低端机上无自适应降载（LOD 调速器）。
7. **音频对画面零驱动**：BGM 情绪（标题/探索/战斗）切换时氛围层无动于衷。
8. **微交互线性**：按钮/卡牌/血条用线性或单段 ease，缺弹性（spring）缓动体系；
   血条用 `width` 过渡触发 layout，应改 `transform: scaleX` 走合成器。

---

## 2. 设计目标与硬约束

### 2.1 目标（按优先级）

- **G1 声即可见**：说话→画面发光；说得越准、调越稳，光环越盛。这是全项目唯一的
  差异化视觉资产，必须做成"截图一眼能认出"的招牌。
- **G2 打击有重量**：每次命中 = 闪光 + hit-stop + 分级震屏 + 浮字 + 触觉，五通道同步。
- **G3 场景会呼吸**：屏幕切换有形变转场；三幕各有粒子主题；氛围层随 BGM 情绪呼吸。
- **G4 永不掉帧**：移动端 60fps；帧耗时超标自动降载；页面隐藏即停。
- **G5 人人可玩**：reduce-motion 下所有特效有"安静的等价物"（透明度脉冲代替抖动等）。

### 2.2 硬约束（红线）

| 约束 | 现状 | 本方案承诺 |
|---|---|---|
| 首包 JS 预算 | ≤350 KB gzip（实测 59.2） | 全部增量 ≤ +15 KB gzip，perf-budget 守卫继续一票否决 |
| 零资产哲学 | 无图片/音频素材，全合成 | 特效全部程序化生成，不引 Lottie/Rive/雪碧图 |
| `src/core/` 零侵入 | 内核纯函数、可种子复现 | 只消费 `emit` 事件，不改引擎任何签名 |
| 确定性 | mulberry32 贯穿 | 特效随机用独立 seed 流，不污染游戏 RNG |
| 无障碍 | reduce-motion 全跳过 | 新特效逐一提供降级形态 + 测试断言 |
| CI | biome/tsc/vitest×150/E2E×4 | 新模块配单测，E2E 补 1 条特效冒烟 |

---

## 3. 技术选型（2026-09 深度调研结论）

### 3.1 采纳（0 KB 原生优先）

| 技术 | 用途 | 依据 |
|---|---|---|
| **View Transitions API**（same-document） | 屏幕转场、敌人登场/退场形变 | 已入 Baseline（Chrome 111+ / Safari 18+ / Firefox 144+），0 KB，不支持时 DOM 照常更新、无感降级 |
| **Web Animations API（WAAPI）** | 浮字、闪光、血条排空、弹性缓动 | 原生、可被 FxDirector 统一 `pause()/playbackRate`（hit-stop 的实现基石），`spring()` easing 渐进可用、回退 `cubic-bezier` |
| **AnalyserNode**（Web Audio 原生） | 麦克风能量 + BGM 频谱 → 视觉 | 成熟模式：`getByteFrequencyData` 分低/中/高频带驱动粒子/颜色/爆发；零成本 |
| **CSS 自定义属性 + @keyframes 扩充** | 微交互、氛围、皮肤差异 | 现有路线延续，成本为 0 |
| **自研轻量粒子引擎（对象池 + 发射器）** | 粒子系统 v2 | 需求高度定制（汉字笔画粒子、三幕主题），自研 ~4–6 KB，风格与预算双赢 |

### 3.2 备选（仅在自研复杂度失控时启用）

| 候选 | 体积 | 触发条件 |
|---|---|---|
| canvas-confetti（MIT、零依赖） | ~6 KB | 胜利烟花自研超过 200 行仍不满意时直接换它 |
| Motion `animate()` mini（MIT） | ~2.6 KB | 需要复杂手势/布局动画（当前玩法用不到） |

### 3.3 明确拒绝（附理由）

| 候选 | 拒绝理由 |
|---|---|
| Three.js / PixiJS / WebGPU 渲染 | 重（>100 KB），本游戏是 DOM 舞台 + 竖屏卡牌，2D 足够；WebGPU 覆盖率不足，不做一等公民 |
| GSAP | 3.13 起虽已全插件免费，但闭源且含可终止条款；本项目时间线需求可用 WAAPI 自编排覆盖，不值得背许可与体积 |
| tsparticles | 20–100 KB 且配置驱动风格与本项目的"演出服从战斗语义"不匹配 |
| Rive / Lottie | 资产管线与"零素材全合成"哲学冲突，且渲染器体积 30 KB+ |
| Framer Motion | React 专属，本项目无框架 |

---

## 4. 总体架构：三层渲染 + 一位导演

```
                 ┌────────────────────────────────────────────┐
   engine.emit ──▶  FxDirector（编排层：事件 → 演出计划）        │
   mic/pitch  ──▶   · 优先级 & 去抖 & 并发预算                   │
   audio.analyser ▶ · hit-stop 全局时钟门（WAAPI playbackRate） │
                 │   · reduce-motion 总闸（降级路由）            │
                 └───────┬──────────────┬─────────────┬───────┘
                         ▼              ▼             ▼
                 ┌─────────────┐ ┌─────────────┐ ┌──────────────┐
                 │ CSS/WAAPI 层 │ │ Canvas 粒子层 │ │ 语音光环层     │
                 │ 浮字/闪光/血条 │ │ 发射器+对象池  │ │ AuraRenderer │
                 │ 转场/微交互   │ │ 微尘/火花/烟花 │ │ 频谱→龙吟环    │
                 │（DOM 合成器） │ │（单 rAF 合帧） │ │（录音期激活）  │
                 └─────────────┘ └─────────────┘ └──────────────┘
                         ▲ 全部受 FpsGovernor 自适应降载 & visibility 暂停
```

设计思想落位：
- **中介者 / 事件驱动**：UI 与引擎只发事件，导演决定"播什么、多响、何时播"；
  特效之间不再互相 import，杜绝现状 `playBattleFx` 的网状耦合。
- **端口-适配器延续**：`FxLayer` 接口（`play(plan) / stop() / setRate(r)`）→
  CssLayer / CanvasLayer / AuraLayer 三个适配器，与项目六边形架构同构。
- **命令模式**：每个演出是一条可序列化的 `FxPlan`（纯数据），天然可测试、可回放、
  可在单测里断言"该事件必然产生该计划"。
- **对象池**：粒子、浮字 span 全部池化，长战斗零 GC 尖峰。
- **策略模式**：`reduce-motion` 是一个渲染策略开关——同一份 `FxPlan`，
  普通策略出抖动+闪光，降级策略出透明度脉冲+边框高亮，语义等价。

### 4.1 目录布局（新增/重构）

```
src/ui/fx/
  director.ts        # FxDirector：事件→计划、优先级、并发预算、hit-stop 时钟门
  plans.ts           # FxPlan 类型 + effect→plan 映射表（纯数据，单测重点）
  juice.ts           # hit-stop / 分级震屏 / 命中闪光（WAAPI 实现）
  floaters.ts        # 池化浮字（伤害/护甲/治疗/暴击/星辉），animationend 回收
  transitions.ts     # withViewTransition(render)：支持→startViewTransition；不支持→直渲
  particles/
    pool.ts          # 定长对象池（无分配热路径）
    emitter.ts       # 发射器描述符（形状/速度/寿命/色带），确定性 seed
    field.ts         # 粒子场：合并现 ambient + 新发射器，单 rAF 合帧
  voice-aura.ts      # 语音光环：mic RMS + pitch 帧 → 龙吟环状态机
  governor.ts        # FpsGovernor：帧耗 EMA → 粒子预算/亮度三档自动降载
src/ui/ambient.ts    # 退役，能力并入 particles/field.ts（保留 API 兼容壳一个版本）
src/ui/fx.ts         # 退役，被 director + plans 取代（保留同名导出转接）
```

---

## 5. 模块详设（10 项）

### M1 FxDirector 编排器（地基，F1 交付）

```ts
// plans.ts —— 纯数据，是全部单测的靶子
export interface FxPlan {
  id: string;                    // "hit.normal" | "hit.crit" | "victory.firework" …
  priority: 0 | 1 | 2;           // 2=不可打断（败北/胜利）
  hitstop?: number;              // ms，期间全局演出时钟降至 0.05×
  shake?: { amp: number; ms: number };   // amp 由伤害归一化而来
  flashes?: string[];            // CSS 类
  floaters?: FloaterSpec[];      // 延迟交错 0/16/40ms
  particles?: EmitterSpec;
  sfx?: SfxName;                 // 与 audio 同源对齐，杜绝"静默动作"
}
export function planFor(effect: FxEffect, ctx: FxContext): FxPlan; // 纯函数
```

- `engine.emit` 的 `effect` + `combat.lastResult`（伤害值、是否暴击、回合数）→
  `planFor` 产出计划 → 导演按优先级入队，**并发预算**：同屏浮字 ≤ 6、震屏 ≤ 1、
  发射器 ≤ 3，超出降级（大数挤小数）。
- **hit-stop 实现**：导演持有一个"演出时钟倍率"，hit 时置 0.05×、60ms 后回 1×；
  所有 WAAPI 动画经导演创建，统一 `updatePlaybackRate()`——这是纯 CSS 做不到的，
  也是本次从 setTimeout 迁往 WAAPI 的核心理由。
- 测试：`tests/unit/fx-plans.test.ts`（事件→计划纯函数）、
  `tests/unit/fx-director.test.ts`（jsdom：优先级/去抖/并发预算）。

### M2 打击感三件套（juice.ts，F1 交付）

| 技法 | 参数 | 说明 |
|---|---|---|
| 命中闪光 | 40ms 白闪 → 主题色残影 | `filter: brightness()` 关键帧，先于抖动 16ms |
| Hit-stop | 40ms（普攻）/ 80ms（重击：伤害 ≥ 敌方 30% 上限） | 时钟门实现，见 M1 |
| 分级震屏 | amp = 2 + dmg/maxHp×6 px，clamp ≤ 8px；仅重击/暴击震全屏，普攻只震目标 | "手枪不配火箭的晃法"；摇的不是出招者而是受击者 |
| 交错节奏 | 闪光 0ms → 抖动 +16ms → 浮字 +40ms → 触觉 vibrate 同步 | 三通道（视/触/听）严格对表 |
| 暴击演出 | 金色环爆 + 浮字放大 1.4× + `vibrate("double")` | 由评分 ≥90（"正中"）触发 |

- reduce-motion 降级：闪光→边框高亮，震屏→目标 0.3s 透明度脉冲，节奏保留。

### M3 View Transitions 场景转场（transitions.ts，F1 交付）

- 现状 `ui.render()` 每屏 `innerHTML` 重绘——恰好是 same-document VT 的理想宿主：

```ts
// transitions.ts
export function renderWithTransition(apply: () => void, opts: { kind: ScreenKind }): void {
  const dt = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!dt.startViewTransition || prefersReducedMotion()) { apply(); return; }
  dt.startViewTransition(apply);
}
```

- 每屏根节点打 `view-transition-name`（title/map/battle/…），CSS 定义
  `::view-transition-old/new` 动画：标题→地图"推门上升"，地图→战斗"压暗聚拢"，
  胜利→结算"金粉扩散"。单屏时长 260–320ms，可被设置页"减弱动效"关闭。
- 敌人头像加 `view-transition-name: enemy-stage`：登场/换敌时自动形变。
- 0 KB 依赖；不支持的浏览器（含旧 WebView）走原路径，行为与今日完全一致。

### M4 粒子系统 v2（particles/，F2 交付）

- **对象池**：预分配 512 粒（低端档 192），`Float32Array` 存 x/y/vx/vy/life，
  零运行时分配；死亡粒子回收复用。
- **发射器描述符**：`{ shape: "ring"|"burst"|"fountain"|"trail", count, speed, hueA, hueB, gravity, life }`，
  由 `planFor` 携带；随机数走独立 mulberry32 流（不碰游戏种子）。
- **单 rAF 合帧**：现 `ambient` 的微尘/涟漪并入同一粒子场，全局只留一个
  `requestAnimationFrame`（现状 ambient 与未来场各自一帧，合并即省电）。
- 特效清单：命中火花、护甲晶屑、治疗光尘、星辉拖尾、**胜利烟花（三幕各一配色）**、
  败北灰烬下沉、开箱金光。
- 汉字笔画粒子（可选增强）：暴击时以「声」「震」二字做 8×8 点阵采样，
  粒子按点位汇聚成形再散开——纯 Canvas 可做，~1.5 KB，是签名级演出。

### M5 语音光环 VoiceAura（voice-aura.ts，F2 交付 · 本方案王牌）

> 设计理念：说话时，手机屏幕下方升起一道"龙吟环"——它是法力条、是仪表盘、也是氛围灯。

- **数据源**（全部现成，零新增采集成本）：
  - 录音期麦克风 `AnalyserNode`（在 `sensevoice/recorder.ts` 的 AudioContext 上并联，
    `fftSize=1024`）→ 每帧 RMS 能量 + 低/高频带比；
  - `onPitchFrame`（pitchy 已吐出的实时基频）→ 音高连续性/稳定性。
- **视觉映射**：
  - 音量 → 环的半径与亮度（呼吸感，120ms 平滑）；
  - 基频稳定且连续 → 环从"雾气态"凝聚为"龙鳞态"（边缘出现分段亮鳞）；
  - **粤语六调 → 六种色相**（1 阴平高平·金 / 2 阴上·青 / 3 阴去·朱 / 4 阳平·蓝 /
    5 阳上·紫 / 6 阳去·翠）：说话过程中环色随检测到的调域漂移——
    玩家在打分出来之前就"看见"自己的声调，这是全网没有的反馈层；
  - 说完收声：环向目标敌人方向"吐息"收束（与命中演出衔接）。
- **实现**：独立小 Canvas（只在录音期挂载，结束即销毁，不占常驻内存）；
  降级策略：reduce-motion 时改为静态渐变进度环（只映射音量，不闪烁）。
- **隐私注记**：全部本地 `AnalyserNode` 读帧，与现有"语音不出栈"承诺一致。

### M6 三幕氛围主题（particles/field.ts 配置，F2 交付）

| 幕 | 常驻粒子 | 光色 | 特色事件 |
|---|---|---|---|
| 一幕 · 龙楼 | 上升炭火微尘（现 36 粒升级） | 暖金 | 战斗时底部暗红呼吸光 |
| 二幕 · 雾海码头 | 横向飘移雾絮 + 偶发水面反光 | 青灰 | 精英战起浪（横波粒子带） |
| 三幕 · 云顶声窟 | 垂直光柱尘埃 + 回声环 | 冷银 | Boss 战常驻低频声环脉冲 |

- 以 `data-act` 属性 + 粒子场配置表切换；主题皮肤（P4 的三皮肤）只换色板不换动力学。

### M7 音频驱动氛围（audio.ts 小改，F2 交付）

- `GameAudio` 主增益后挂一个 `AnalyserNode`（fft 256，smoothing 0.85），
  暴露 `audio.level(): { bass, mid, treble }`；
- 粒子场订阅：BGM 低音拍点 → 微尘轻微外扩；战斗情绪下涟漪频率随能量提升。
- 无 BGM（用户关音乐）时该通道静默，一切如旧。

### M8 微交互与缓动体系（styles.css，F1/F3 分批）

- 建立缓动令牌：`--ease-out-hard`（命中）、`--ease-spring`（`cubic-bezier(.3,1.6,.5,1)`）、
  `--ease-breath`（氛围循环），全站动画替换统一取值；
- 血条/能量条 `width` 过渡 → `transform: scaleX`（合成器-only，可弹性过冲）；
- 技能卡按压：`:active` 缩放 + 音效已有，补 120ms 回弹；
- 地图节点：选中态加 `view-transition` 友好的光晕呼吸；
- 按钮涟漪（`:has` + 伪元素，0 JS）。

### M9 帧率治理 FpsGovernor（governor.ts，F3 交付）

- 每 60 帧采样帧耗 EMA；三档：流畅（粒子满额）/ 吃力（粒子上限 ×0.5、关光环鳞动）/
  告警（粒子上限 ×0.25、停氛围循环、只保战斗演出）；
- 档位变化有 3s 迟滞防抖；`visibilitychange` 全停（现状保留）；
- 设置页新增"特效强度"三选（满 / 均衡 / 省电），手动优先于自动。

### M10 测试与验收（贯穿）

| 层 | 新增 |
|---|---|
| 单测 | `fx-plans`（事件→计划映射穷举）、`fx-director`（优先级/并发/hit-stop 时钟）、`particles/pool`（回收不变式）、`governor`（档位状态机） |
| 契约 | 现有 9 黄金契约 + 150 测试**一个不改**（内核零侵入的可执行证明） |
| E2E | 新增 `tests/e2e/fx.spec.ts`：静音 QTE 通道打一场，断言浮字出现、DOM 动画存在、`reduce-motion` 下无抖动类 |
| 预算 | `perf-budget.ts` 阈值不动（350 KB），本期增量目标 ≤ +15 KB；CSS 体积进报表观测 |
| 手测脚本 | `docs/FX-TUNING.md`：每个技法的参数表与调参步骤（打击感必须"玩着调"） |

---

## 6. 执行路线图（三期，每期独立可发布）

| 期 | 交付 | 改动面 | 预估增量 | 验收 |
|---|---|---|---|---|
| **F1 打击感与转场** ✅ 完成（2026-09-19） | M1 导演 + M2 三件套 + M3 转场 + M8 缓动令牌（第一批） | 新增 `src/ui/fx/` 6 文件；`main.ts` 转场接线；`fx.ts` 转接壳 | **+1.8 KB gzip**（59.2→61.0） | 174 单测全绿（+24 新）；E2E 6/6（+2 特效冒烟）；biome/tsc/build 全绿 |
| **F2 声之形**（约 2–3 天） | M4 粒子 v2 + M5 语音光环 + M6 三幕主题 + M7 音频驱动 + M8 血条改造 | `audio.ts`/`recorder.ts` 各 ≤30 行；`ambient.ts` 并入 field | ~+7 KB gzip | 真机 Cantonese 一句话→光环三色可见；低端机档不掉帧 |
| **F3 治理与收尾**（约 1 天） | M9 调速器 + 胜利烟花/汉字粒子 + 设置页"特效强度" + 文档 | 新增 2 文件 + 设置页字段（存档 v2 可选字段，旧档无缝） | ~+2 KB gzip | `npm run ci` 全绿 + E2E×5；Lighthouse 复测不低于 P5 基线 |

里程碑纪律（沿用项目既有做法）：
- 每期收尾跑 `npm run ci`（biome + tsc + vitest + build + perf-budget）；
- 每期一个独立 commit/PR 粒度，`REDESIGN-PLAN.md` 顶部进度行同步追加；
- 任何一期超预算：先砍 M4 汉字粒子，再砍 M5 鳞动细节，**不砍 reduce-motion 降级**。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| View Transitions 与 `innerHTML` 重绘时序竞争（快照抓到半渲染态） | `startViewTransition(cb)` 的 cb 内同步完成整屏渲染；动画时长封顶 320ms；E2E 覆盖三条主转场 |
| 移动端双 AudioContext（SFX 一个 + 录音一个）生命周期冲突 | 录音期 SFX context 挂起（`suspend`），光环只读录音侧 Analyser；结束恢复——单测锁定 |
| hit-stop 期间玩家连点导致队列积压 | 导演并发预算 + 同 effect 60ms 去抖；输入层照常响应（只缓演出，不缓判定，绝不引入输入延迟） |
| 特效过载引发晕动 | 震屏仅重击/暴击、单次 ≤8px ≤320ms；闪屏避开高频亮暗切换；设置页"特效强度"可全局降档 |
| 旧浏览器（无 VT/无 WAAPI `playbackRate`） | 全部特性检测 + 直渲回退；E2E 用 Playwright 覆盖降级断言 |
| 自研粒子复杂度失控 | 烟花备胎 canvas-confetti（MIT ~6KB）随时可换；对象池不变式由单测锁定 |

## 8. 参考资料（2026-09 检索）

1. View Transitions API 进入 Baseline 与浏览器矩阵 — [dev.to](https://dev.to/linou518/view-transitions-api-native-browser-page-transitions-no-more-framer-motion-3g7d)、[testmuai 支持矩阵](https://www.testmuai.com/learning-hub/view-transitions-api-browser-support/)
2. 2026 动画库体积与选型（GSAP 3.13 起全免费但闭源可终止；Motion/anime.js 更轻） — [artofstyleframe](https://artofstyleframe.com/blog/web-animation-css-vs-gsap-2026/)、[motion.dev 对比](https://motion.dev/docs/gsap-vs-motion)、[annnimate 对比](https://annnimate.com/compare/gsap-vs-anime-js)
3. 庆祝粒子库对比（canvas-confetti ~6KB 零依赖 / tsparticles 20–100KB） — [PkgPulse](https://www.pkgpulse.com/guides/canvas-confetti-vs-tsparticles-vs-party-js-celebration-2026)
4. 音频驱动粒子（AnalyserNode 分频带→运动/颜色/爆发的成熟范式） — [threejsdemos](https://threejsdemos.com/demos/audio/particles)、[freefrontend](https://freefrontend.com/javascript-audio-visualizer/)
5. 游戏打击感（hit-stop 40–80ms、震屏按事件分级、三通道交错、尊重晕动） — [egmatic](https://egmatic.com/blog/how-to-make-your-game-feel-good)、[skills.sh game-feel](https://www.skills.sh/gamedev-skills/awesome-gamedev-agent-skills/game-feel)
6. DOM 打击感实现细节（animationend 回收、scaleX 血条、特效交错 0/16/40ms） — [codefronts](https://codefronts.com/motion/css-shake-animation/css-hit-damage-shake-effect-for-web-games/)

---

*本方案与 `REDESIGN-PLAN.md` 的六边形架构、黄金契约、性能预算纪律完全兼容；评审通过后按 F1 → F2 → F3 顺序执行。*
