# 《声震龙楼》v2.0 · Web 闯关游戏完整重构与扩展方案

> 版本：v1.0（2026-09-18） · 状态：**已批准（P0–P3 / Cloudflare Pages / 保底即玩自愿下载）**
> 进度：✅ P0 完成 ✅ P1 完成 ✅ P2 完成（68 测）✅ P3 完成（声调引擎 + 学习闭环，88/88 测试绿，已推送）✅ P4 完成（留存与打磨：成就 13 枚 + 图鉴 5 类 + 3 主题皮肤 + 无尽塔 + 战绩海报分享 + 自适应难度 ±5%/−8% + og/twitter 分享图与 PWA PNG 图标；113/113 测试绿，biome/tsc/build 全绿。Lighthouse 实测需部署后在 Cloudflare Pages 上跑）✅ P5 完成（内容扩展 + 平衡仿真：三幕内容包 / 跨幕续行 / 元存档 v2 / 仿真校准与 CI 胜率带守卫；146/146 测试绿，biome/tsc/build 全绿）→ 全部六期完成；P5 收尾补丁（音效与演出 + 新手教学 + 发布链路）已完成：合成音效/生成式 BGM/氛围粒子/战斗浮字演出、三步教学关（识招→听示范→开声校准+剧情化麦克风请求）、Cloudflare Pages _headers 与部署工作流、性能预算实测 59.2/350 KB gzip、Playwright E2E 4 条接入 CI；150 项测试 + 4 E2E 全绿。剩余可选项：离线 TTS、云端排行榜（待定）
> P6 已完成（动画/特效升级，方案见 `docs/FX-UPGRADE-PLAN.md`）：✅ F1 完成——FxDirector 演出编排（计划纯函数 + 调度器去抖/预算 + hit-stop 时钟门）替代旧版命令式 fx：命中闪光→分级抖动（振幅随伤害 2..8px）→浮字 0/16/40ms 交错、暴击（≥90 分）金光放大、View Transitions 场景转场（0KB，旧浏览器回退原 screen-in）、缓动令牌三件套、浮字对象池回收、reduce-motion 降级为纯透明度浮字；退役 .fx-shake/.fx-jolt/.fx-hurt 三组 CSS 改由 WAAPI 播放；174 单测（+24）+ 6 E2E（+2）全绿，预算 61.0/350 KB。✅ F2 完成——声之形：粒子系统 v2（Float32Array 对象池 512 + 确定性发射器 + 单 rAF 合帧）替代 AmbientField（兼容壳保留）；语音光环 VoiceAura（音量驱动涨落 + 基频六调域色相漂移 + 龙鳞凝聚，数据全部复用现有 onVolume/onPitchFrame 管线）；三幕氛围主题（龙楼炭火/雾海横雾/云顶光尘）；GameAudio 挂 AnalyserNode 频谱→微尘低音呼吸；命中/暴击/胜利烟花/败北灰烬粒子爆发（burst sink 语义点火）；血条 width→scaleX 合成器排空；另接入 codegraph 代码知识图谱（devDependency + AGENTS.md 工作流）。191 单测（+17）+ 6 E2E 全绿，预算 63.6/350 KB。✅ F3 完成——治理收尾：FpsGovernor 帧率治理（帧耗 EMA 三档自动降载 + 3s 迟滞 + 90 帧预热，手动「特效强度」auto/full/balanced/eco 覆盖，设置页新增选项）；汉字粒子签名演出（运行时 28×28 光栅采样零素材：暴击「声」字汇聚、胜利「震」字驻留散开，告警档回退环爆）；爆发/微尘按档位预算削减（100/50/25%）；`docs/FX-TUNING.md` 调参手册（所有旋钮单一事实源）。200 单测（+9）+ 6 E2E 全绿，预算 65.1/350 KB。**P6 动画升级三期全部完成**。✅ P7 三幕深耕完成：技能 36 / 事件 26 / 道具 8 / 词缀 12；版本化扩展池保留旧档与经典规则；每日/无尽词缀、分版日榜与刷新记账。269 项测试 + 13 E2E；P7 各幕参考胜率 53% / 55% / 58%，预算约 70.7/350 KB。详见 `docs/CONTENT-EXPANSION-PLAN.md` 与 `docs/P7-BALANCE-REPORT.md`。
> P8-A ✅ 完成（构筑成型）：36 卡能力标签 / 三方向说明 / 行囊构筑页；夜市逐次收费删牌（每店一次、至少 5 张、最后输出保护）；12 张代表技能单卡升级（歇脚互斥选择）；奖励与商店的确定性协同提示。`buildVersion:1` 与 P7 内容版本分离，旧档不自动升级；同名实体槽位贯穿语音/QTE。303 项测试 + 20 E2E 全绿，预算 75.2/350 KB；参考 Bot 三幕胜率 49.7% / 51.7% / 56.0%，零超时。详情见 `docs/BUILDCRAFT-PLAN.md`、`docs/P8-BALANCE-REPORT.md`。第四幕与新特效暂缓。
> P8-B ✅ 完成（对手进化）：三个现有Boss新增第二阶段、每幕一名特色精英、逐段精准伤害预测与露隙/穿甲/干扰提示；半血先排队，已显示的招式不偷换。`encounterVersion:1` 独立于构筑版本，旧档/经典/每日/无尽不升级。336项测试 + 27 E2E全绿，预算78.2/350KB；参考Bot三幕56.7% / 56.3% / 55.3%、零超时。随机Bot有1个既有敌人长局样本，详见 `docs/ENCOUNTER-EVOLUTION-PLAN.md`、`docs/P8B-BALANCE-REPORT.md`。第四幕与新特效继续暂缓。
> P8-C ✅ 完成（语音深化）：既有声调 DTW 追加保守最接近调型元数据但不改分；新增纯函数音节教练、战斗/练习场逐音节焦点建议、SRS 六调本机画像、薄弱调关联错词与旧档补桶。无 F0 通道诚实回退字准，QTE 不写发音档案，录音/F0 帧不持久化。347 项测试 + 29 E2E 全绿，预算 80.6/350 KB；P8-B 平衡回归不变。详见 `docs/VOICE-MASTERY-PLAN.md`。真人粤语与设备差异仍待实测。
> P5 收尾备注（音效与演出/教学/发布）：① 音频适配器 `src/adapters/audio.ts`——Web Audio 实时合成（方案 §4.5「自生成」路线，不引 Howler：零素材零下载更契合 PWA 预算），SFX 十种 + 生成式宫调五声 BGM 三情绪（标题/探索/战斗）lookahead 调度、AudioContext 首次手势解锁、sound/music 双开关；② 演出 `src/ui/fx.ts` + `ambient.ts`——浮字（伤害/护甲/治疗/星辉）、受击抖动、败北压暗、Canvas 微尘涟漪，全部 respect reduce-motion；③ 教学关 `ui.ts` 三步流复用 settings.tutorialSeen，麦克风「传声铜管」剧情请求即取即停；④ 发布链路：`public/_headers`（哈希缓存/SW no-cache/安全头，未开 COOP/COEP——单线程 SIMD 已够用）、`deploy-pages.yml`（wrangler pages deploy，密钥配好后可开自动部署，见 docs/DEPLOY.md）、`scripts/perf-budget.ts` 首包 JS gzip ≤350KB 守卫进 CI；⑤ Playwright E2E（tests/e2e，vite preview + 无声 QTE 通道）四条流接入 CI e2e job。
> P5 备注：① 三幕内容包 `src/core/content/`——一幕包裹既有数据零改动（行为逐位不变），二幕「雾海码头」/ 三幕「云顶声窟」各 5 技能 + 5 敌 + 2 精英 + 幕 Boss + 5 遗物 + 4 事件 + 15 楼层名，引擎经注册表按幕取内容（奖励/夜市为累计卡池，敌人/事件本幕独占）；② 跨幕续行 `continueNextAct`：Boss 落幕保留牌组/遗物/战绩换新图 + 塔间小憩回 20% 生命，结算屏「乘胜登楼」直入下一幕；战役元存档升级 v2 按幕记录（v1 首读自动迁移），标题屏按 bossCleared 解锁二/三幕直入，成就 +1「声震三幕」（共 14 枚）；③ 平衡仿真 `src/core/sim.ts` + `npm run sim`：三幕 × 两策略 Bot × 300 局确定性蒙特卡洛（Bot 决策流与引擎 LCG 分离），报表自动生成 `docs/BALANCE-REPORT.md`，CI 守卫 `tests/sim/balance.test.ts`——贪心参考 Bot（声韵均值 74）三幕 52.0% / 48.3% / 47.3%，全部落进 45–65% 验收带（随机下限 Bot ≈0%，技能梯度成立）；④ 仿真暴露并修复两处原版遗留缺陷：吞音意图 amount 误乘 baseAttack（铜钟噬音兽 9×8=72 点秒杀级伤害 → 改固定伤害值，意图预览同步）；`startCampaign` 未把种子传入 `createRunState`（战役战斗 RNG 不可复现 → 修复后同 (act, seed) 必同局）；⑤ 平衡调参落位：`ACT_DIFFICULTY_TARGET`（各幕难度目标 = 等效经典层数，战役 15 行按比例折算，经典/无尽行为不变）、`CAMPAIGN_SUSTAIN.victoryRegen = 6`（战役胜利回血）、地图歇脚配额 3→4；数值均为仿真校准产物，调参请跑 `npm run sim` 以报表为准。
> P3 备注：① 声调引擎 `src/core/tone.ts`——粤拼调母→六调调型模板（中位数归一、说话人音域无关）→ 音节分段 DTW → 几何平均聚合，全部纯函数确定性；合成权重默认字 60% / 调 40%（设置页滑杆 0–80% 可调），无 F0 通道恒回退 V1 纯字准（黄金契约不动）；② F0 由 pitchy（McLeod）在 SenseVoice 采集链并行抽取（2048 窗/512 步进），WebSpeech 无 PCM 通道按设计回退；③ 学习闭环 `src/core/srs.ts`：综合分 <65 自动进错词本、SM-2 简化调度（1→3→×ease）、「每日三句」到期优先、四维学习报告（字准/调准/信心/词汇 SVG 雷达）；④ 每日挑战 = djb2(本地日期) 种子经典局 + 本地最优战绩；⑤ 练习场实时双曲线（期望调型 vs 用户基频 + 音节级评分圆点）走 onPitchFrame 回调，跟读成绩同样进 SRS。
> P2 备注：① 地图生成器 `src/core/levelgen.ts`（mulberry32 独立种子流，形状约束由 `validateActMap` 守护并被契约测试直接复用）；② 经典线性塔保留（9 黄金契约不动），战役经 `startCampaign(act, seed)` 双轨驱动，存档仍为 v2（campaign 为可选增量字段，旧档无缝继续）；③ ★跨局累计于元存档 `voice-tower-campaign-meta-v1`（同幕同种子，只升不降）；④ 浏览器层 Playwright 通关 E2E 留待 CI 环境（引擎层全程通关已由 `tests/contract/campaign.test.ts` 锁定，`__VOICE_TOWER__.startCampaign` 调试钩子已就位）。
> 前文决策：放弃微信小游戏方向，以当前 Web 原型（`index.html` + `js/`）为基座，
> 演化为**可发布、可离线安装、端侧 AI 驱动**的完整粤语声攻爬塔闯关游戏。

---

## 0. 摘要：一句话方案

> 保留现有**成熟的游戏内核**（Slay-the-Spire 式爬塔 + 粤语发音施法），
> 围绕它做一次**六边形架构重构**（TypeScript + Vite + 纯内核/适配器分层），
> 把语音能力升级为**两套端侧 AI**（sherpa-onnx WASM 粤语 ASR 主引擎 + pitchy 六调
> 音高轮廓声调引擎），关卡系统升级为**分支路径地图闯关**（3 幕 × 15 层 + 每日挑战），
> 补充**教学、SRS 复习、成就、自动化平衡测试、PWA 离线安装**等未覆盖模块，
> 全程纯静态托管、零后端、隐私全留在设备端。

---

## 1. 现状盘点与差距分析

### 1.1 已有资产（质量良好，全部保留复用）

| 模块 | 文件 | 评估 |
|---|---|---|
| 游戏内核 | `js/engine.js` (775 行) | ✅ 接口完整、可种子复现（LCG）、订阅式状态广播，是项目最宝贵资产 |
| 内容数据 | `js/data.js` (423 行) | ✅ 12 技能/5 敌/2 精英/1 Boss/5 遗物/3 道具/5 事件，内容丰富 |
| 文本评分 | `js/voice/scoring.js` | ✅ 规范化 + Levenshtein，作为"文本相似度层"继续复用 |
| 语音适配 | `js/voice/adapters.js` | ✅ 适配器模式正确；Web Speech 适配器保留为**零下载兜底** |
| 存档 | `js/storage.js` | ✅ 版本化存档（v2），需扩展迁移链 |
| UI | `js/ui.js` + `styles.css` | ⚠️ DOM 直渲可用但无组件化/无动效编排，重写渲染层 |
| 测试 | `tests/game.test.mjs` | ✅ 9 个行为测试 = 重构时的**黄金母版（golden master）保护网** |

### 1.2 差距清单（用户未覆盖或新方向）

1. **ASR 不可靠**：Web Speech API 依赖谷歌云端、跨浏览器不稳定、粤语短句识别不可控且无词级置信度 → 引入端侧 SenseVoice。
2. **只评"字"不评"调"**：粤语 6 个声调是发音评分的灵魂，现有方案只比文本 → 新增音高轮廓声调引擎（项目差异化卖点）。
3. **无麦/环境嘈杂场景无解** → 新增"无声 QTE 模式"（节奏判定条），双通道玩法。
4. **闯关形态单薄**：目前是"每层 1~2 个门"的线性选择，不是真正的 STS 式分支地图 → 分支地图 + 3 幕战役。
5. **无局外成长/留存设计**：无每日挑战、成就、图鉴、学习报告 → 全部新增。
6. **无教学引导**：第一次进游戏直接开战 → 新增新手教学关 + 跟读校准。
7. **无工程化**：无构建、无类型、无 lint、包管理近乎没有 → Vite + TS strict + Biome + CI。
8. **无发布形态**：裸静态文件 → PWA（可安装、全离线、模型 IndexedDB 缓存）。
9. **仓库卫生**：`.browser-profile*` 大量浏览器缓存被误提交（数百 MB），需清理并加 `.gitignore`；凭据不应入库（`.git/config` 已在快照排除范围内，本次使用的 PAT 建议随后吊销）。
10. **无平衡验证手段**：难度曲线目前靠手感 → 引入无头仿真机器人自动跑局统计胜率。

---

## 2. 产品方向与设计支柱

**P1 声即法力**：发音质量 = 战斗力。从"文本相似度"升级为"字准（ASR）× 调准（音高）× 信心"三维评分。
**P2 纯 Web 无感启动**：打开即玩（保底模式零下载），愿意等一次模型下载（约 230 MB，可断点续传、IndexedDB 持久缓存）则进入完全离线的高精度模式。
**P3 闯关而非背包**：玩家目标是"登顶"——分支地图、3 幕、明确的关卡目标与评价（每关 ★ 评级）。
**P4 学完能带走**：每次录局生成"粤语学习报告"（错调字、最佳发音），SRS 复习入口——游戏同时是开口练习工具。
**P5 隐私与离线**：一切推理在设备端，无任何语音出栈；存档本地，可导出/导入。

**目标用户触点**：移动竖屏优先（现状已适配），桌面响应式；触屏 + 键鼠双操作。

---

## 3. 总体架构（六边形 / 端口-适配器）

```
┌────────────────────────────────────────────────────────────────┐
│  UI 层（DOM 渲染 + Motion/GSAP 动效 + Canvas 氛围粒子的适配器）    │
│  components/  scenes/  i18n/  a11y/                              │
├────────────────────────────────────────────────────────────────┤
│  应用层 src/app：GameController（接收 UI 命令 → 调内核 → 发事件）   │
│                 EventBus（UI/音频/埋点订阅）                        │
├────────────────────────────────────────────────────────────────┤
│  领域内核 src/core（纯 TS，零 DOM 零 IO，100% 可测可复现）：        │
│   GameEngine（现 engine.js 移植）/ CombatState Machine /          │
│   Content（技能·敌人·事件·遗物，zod 校验）/ SeedRNG（mulberry32）   │
│   LevelMapGenerator（STS 分支地图）/ Scoring（打分策略接口）        │
├─────────────────────── Ports（接口）───────────────────────────┤
│ ASRPort │ TonePort │ TTSPort │ StoragePort │ AudioPort │ Telemetry│
├─────────────────────── Adapters ───────────────────────────────┤
│ sherpa-worker │ pitchy │ speechSynthesis │ localStorage+迁移链   │
│ WebSpeech兜底 │ 无声QTE │ sherpa-tts(可选) │ IndexedDB(模型缓存)  │
├────────────────────────────────────────────────────────────────┤
│ Web Workers：asr.worker.ts（VAD→SenseVoice 推理）                 │
│ Web Audio：AudioContext 仅在用户手势后创建（自动播放策略合规）        │
└────────────────────────────────────────────────────────────────┘
```

关键工程设计思想落地：

- **命令模式**：UI 只发 `Command`（`ChooseNode/PlayCard/EndTurn/…`），内核处理后产出 `GameEvent[]`；同构回放（录制命令流 = 战斗回放、Bug 复现、平衡仿真的基石）。
- **状态机**：战斗/关卡 phase 用显式状态机（轻量自实现或 XState），杜绝隐式非法跃迁。
- **策略模式**：`ScoringStrategy`（文本层/声调层/信心层加权组合，配置化调参）、`DifficultyStrategy`。
- **仓库模式 + 迁移链**：存档 schema 版本化 `v2→v3→…`，每级迁移函数独立可测。
- **确定性**：mulberry32 种子贯穿选关、出牌、奖励——同一命令流必然同一结局（测试可复现）。

---

## 4. 核心技术选型（深搜实证）

### 4.1 语音主引擎：sherpa-onnx WASM + SenseVoice（推荐，端侧、离线）

- 选型：**`sherpa-onnx-sense-voice-zh-en-ja-ko-yue`**（int8，约 234–238 MB），中/英/日/韩/**粤**五语，FunAudioLLM 出品、k2-fsa 官方 WASM 构建，Apache-2.0。
- 浏览器端证据：官方 HuggingFace Space 即为"VAD + ASR + SenseVoice 浏览器 WASM"演示（k2-fsa/web-assembly-vad-asr-...-cantonese-sense-voice）；社区实现（sokuji 等）给出成熟范式：**Classic Web Worker 内 `importScripts` 加载 Emscripten 运行时 → 降采样至 16 kHz → Silero VAD 分段 → OfflineRecognizer 识别 → Transferable 零拷贝回传主线程，模型文件 IndexedDB 持久化**。实测 3.85 s 语音仅 431 ms（RTF≈0.11）。
- 为什么不是 Whisper：SenseVoice 对中文/粤语专训、比 Whisper 快约 15 倍且自带 VAD/情感标签；Whisper 即使 WebGPU 加速在粤语短句上仍更重、更慢、段级无词级时间戳。
- 兜底链：`SenseVoice(WASM) → Web Speech API zh-HK（现有 BrowserVoiceAdapter，零下载）→ 无声 QTE 模式`。设置页可切换，首次进入默认保底模式+显眼引导下载。

### 4.2 声调引擎（新增，差异化卖点）：pitchy 实时 F0 + 调型模板匹配

- **pitchy**（McLeod Pitch Method，纯 ESM、微秒级、无模型文件、MIT 协议）：在录音同时于主线程/AudioWorklet 抽 F0 序列。
- 玩法映射：每张技能卡已带粤拼（如 `ding2 ngaang6 soeng6`），把 2/6/6 映射为相对基频轮廓模板（1=高平 … 6=低平），对每个音节做 DTW（动态时间规整）相似度，得到"调准分"；与 ASR 字准分按策略加权（默认 字 60% / 调 40%，可在设置调整）。
- 防作弊/鲁棒：VAD 检出有效语音段；能量过低/无讲声判 0 调；结果全部可空回退（拿不到 F0 就只用字准）。
- 升级路径（可选）：CREPE（TensorFlow.js）更准但重，列为实验开关，不进默认管线。

### 4.3 TTS 示范发音：`speechSynthesis` zh-HK（免费零依赖）

- 技能卡"听一听"、教学内容、事件文案朗读全用系统语音（iOS/macOS 均有粤语声）。
- 可选升级：sherpa-onnx 的离线 TTS 模型（如粤语 camplus/xt-tts）进 Worker——列入 P5 候选，不阻塞主线。

### 4.4 渲染与动效：**保留 DOM UI**，不引 Phaser

- 依据：卡牌战为 UI 密集型、DOM 对无障碍/触控天然友好；社区实测 Phaser 对卡牌类过度设计、常驻 CPU 风扇起飞、有团队正从 Phaser 回迁 GSAP。
- 动效分层：CSS/View Transitions 覆盖 80% 常规 UI 动画；**Motion（≈12 KB）** 负责时间轴序列（出招演出、受击、浮字）；Canvas 2D 粒子只做标题/战斗氛围背景。无整页 WebGL，保住低端机帧预算。

### 4.5 音频：Howler 管理 SFX/BGM（Web Audio 封装、雪碧图、Unlock 处理成熟）

- `AudioContext` 在用户首次手势（点"开始登楼"）后创建，合规自动播放策略；`下蹲静音/仅音效/仅音乐`三档设置。
- 音效素材走免费商用源（Freesound CC0 精选 + 自生成），打包 snowpack 雪碧图。

### 4.6 参考复用的开源实现（只取架构/算法，不整壳搬入）

| 来源 | 复用内容 | License |
|---|---|---|
| `k2-fsa/sherpa-onnx` (+HF wasm 演示) | ASR Worker 管线与模型 | Apache-2.0 |
| `ianprime0509/pitchy` | F0 提取 | MIT |
| `oskarrough/slaytheweb` | 引擎分层/命令语义/地图接口 参考（MIT） | MIT |
| STS 地图生成公开逆向（yurkth/stsmapgen 等） | 分支路径算法：7×15 网格、路径不交叉、≥2 个不同起点、Boss 顶点 | 公开算法说明 |
| `goldfire/howler.js` | 音频管理 | MIT |
| `motion` / `gsap`（二选一，默认 Motion） | 动效时间轴 | MIT / 标准许可 |
| `vite-plugin-pwa`（Workbox） | PWA 离线 | MIT |

---

## 5. 重构方案：现有代码 → 新结构映射

| 现状 | 去向 | 动作 |
|---|---|---|
| `js/engine.js` | `src/core/engine.ts` | 移植 + 类型化 + 命令/事件化；**9 个现有测试原样通过**（golden master） |
| `js/data.js` | `src/core/content/*.ts` + zod schema | 内容分包（skills/enemies/relics/events/levels），构建时校验，运行时冻结 |
| `js/voice/scoring.js` | `src/core/scoring/text-similarity.ts` | 逻辑原样保留，注册为打分策略的一层 |
| `js/voice/adapters.js::BrowserVoiceAdapter` | `src/adapters/asr/web-speech.ts` | 保留为兜底实现，实现统一 `ASRPort` |
| `MiniGameRecorderAdapter` | 删除 | 随小游戏方向下线 |
| `js/platform.js` | `src/adapters/platform/*` | 仅保留 web 检测/震动/Wake Lock |
| `js/storage.js` | `src/adapters/storage/local.ts` + `migrations.ts` | slot 化（多档位）+ v2→v3 迁移 |
| `js/ui.js`/`styles.css` | `src/ui/**` 组件化重写 | 同视觉体系升级：主题 token 化（CSS custom properties）；卡片/血条/意图气泡组件 |
| `tests/game.test.mjs` | `tests/contract/*.test.ts`（Vitest） | 语义不动，全部转为 TS，守护重构 |
| `minigame/` `.wxmg-port/` `.browser-profile*/` | 删除分支保留 tag | 仓库瘦身 + `.gitignore` 规范化 |
| `globalThis.__VOICE_TOWER__` | `src/dev/expose.ts` | 保留调试钩子（Playwright 验收依赖） |

**存档兼容承诺**：老用户首次启动自动 v2→v3 迁移（楼层进度以"幕/层"换算为地图节点进度映射，失败则安全回退新档并保留旧档备份键）。

---

## 6. 闯关玩法与关卡系统（核心玩法升级）

### 6.1 战役地图：从"线性门选择"→ STS 式分支路径

- 生成算法（种子确定）：`7 列 × 15 行`不规则网格 → 自下而上连边（每层连到上一层最近 3 格之一，**边不交叉**）→ 首轮保证 ≥2 个不同起点 → 未通路节点剪除 → 顶点挂 Boss 节点。
- 节点类型沿用并扩展现有 `NODE_META`：`街巷战/奇遇/歇脚处/夜市/强敌关/声煞之巅（Boss）`，新增 `宝箱 node`（纯收益）与 `问答 node`（复用"骑楼字墙"题型，评星加分）。
- 位置分布规则（防止退化）：前 4 层不出精英；倒数 3 层不出现商店/歇脚之外的纯收益集簇；问"是否当前可到达"接口驱动 UI 高亮。
- **关卡评价**：每关 ★（1–3）由政府评分决定：无伤 ★、平均发音 ≥85 ★、限时内 ★——地图节点显示星级，激励复玩。

### 6.2 内容规模与难度曲线

- **三幕战役**：一幕="塔的一层主题"（现有 10 层名→第一幕主题包），每幕含 15 层 + 幕 Boss；Boss/精英/敌/事件/遗物/技能全部内容包化递进解锁。
- 第二、三幕内容以第一幕为模板复制→数值/文案差分（保住交付节奏；内容为手工定调 + 数据表驱动，不做生成式文案）。
- 难度缩放沿用现有 `scaledEnemy` 曲线，但系数迁移进 `balance.ts` 配置；**自适应微调**：连胜 3 场 +5% 生命/攻击系数，连败 2 场 -8%（有上下限、可在设置关闭）——降低新手流失。

### 6.3 模式矩阵

| 模式 | 说明 | 期次 |
|---|---|---|
| 闯关（战役） | 3 幕分支地图，存档制 | P2 |
| 每日挑战 | 服务器日期哈希为种子（纯本地可算），全服同局，本地榜 | P3 |
| 无尽塔 | 单段无限楼，层间只加难度，周重置 | P4 |
| 练习场 | 指定技能卡跟读训练 + 调准可视化（基频线叠加目标调型） | P3（与声调引擎同发） |

---

## 7. 新增模块与"未考虑到的方向"

1. **声调引擎 + 调准可视化**（见 §4.2）——把"讲粤语"从识别题变成可学习的曲线游戏。
2. **无声 QTE 模式**：麦克风不可用/嘈杂环境/静音场合时，施法改为节奏判定条（光标过甜区判定 0–100）。管线同源——评分接口一致，策略替换。
3. **新手教学关**：3 步（出手第一张卡→收听示范→跟读校准计），并把麦克风权限申请做成"剧情请求"（降低拒绝率）。
4. **SRS 钉子户（遗忘曲线复习）**：正音分 <65 的词自动进"错词本"；首页"每日 3 句"按 SM-2 简化调度弹出；学习报告（雷达图：字准/调准/信心/词汇量）。
5. **成就 + 图鉴**：技能/敌人/遗物/事件图鉴随解锁点亮；成就驱动成就点兑换装饰（主题皮肤）。
6. **HUD 内粤语小灶**：每张卡已带 `lesson`，战时浮层显示"这句怎么用"（已存在于数据，UI 未展现——补展示）。
7. **自动化平衡仿真**：无头引擎 + 两种策略 Bot（随机/贪心），每个技能组合 N=1000 局蒙特卡洛，产出胜率/回合长度报表，进 CI 阈值告警（难度回归测试）——数据驱动平衡。
8. **无障碍**：`prefers-reduced-motion` 全量降级；屏幕阅读器语义（战斗日志用 `aria-live` 轮播已存在→强化）；静音模式下全部语音玩法可替代完成（合规"无声 QTE"色盲安全配色 token）。
9. **隐私设计**：设置页明示"语音不出设备"；遥测默认关，开启仅记录匿名事件计数（无音频、无文本内容，本地存储、可清空）。
10. **分享传播**：战绩卡片图片（Canvas 绘制通关海报→`navigator.share`/下载）——零成本裂变素材。

---

## 8. 语音管线技术细则

**Worker 协议**（主线程 ↔ asr.worker）：

```
init {modelUrls, wasmBase}         → progress/ready
start  {windowMs: 6000}            → state(listening)
frame  {Float32Array@16k}          (Transferable) → vad状态/音量
stop   {}                          → state(processing) → 
result {text, confidence, durationMs, elapsedMs} 或 error {code}
release {}                         → freed
```

- 采集：`getUserMedia({ audio: { echoCancellation, noiseSuppression } })` → `AudioWorkletNode` 降采样 16 kHz 单声道，环形缓冲。
- VAD（Silero）：讲话段结束自动触发识别；整体硬上限 6 s（沿用现设定）。
- 模型下载：首次进入保底可玩；在设置/引导页发起下载，**进度条 + 分片 checksum + 断点续传 + IndexedDB 缓存**（复用社区成熟范式）；网络差时可整包 CDN 镜像（jsDelivr / ModelScope 镜源）。
- 评分合成：`final = round(w_text·ASR相似度 + w_tone·调准 + w_conf·引擎置信)`，权重与阈值入 `balance.ts`；引擎不变量由契约测试守护。
- 降级矩阵：

| 场景 | 结果 |
|---|---|
| WASM SIMD 可用（现代 Chrome/Edge/Safari） | SenseVoice 全量 |
| 无 WASM SIMD（老 iOS Safari 等） | Web Speech zh-HK |
| 无 SpeechRecognition（Firefox 等） | 无声 QTE + TTS 教学 |
| 拒绝麦克风权限 | 教学引导重试 → 无声 QTE |

- 部署可选增强：启用 COOP/COEP + `@origin` 隔离后可开 onnx 多线程（Cloudflare Pages/Netlify `_headers` 可设置；GitHub Pages 不可设头则单线程 SIMD，在可接受范围）。

---

## 9. 工程化与质量保障

- **工具链**：Vite 6 + TypeScript strict + Biome（替代 eslint/prettier 二合一、快）+ Vitest（单测/契约）+ Playwright（E2E：标题→选路→战斗→施法 Mock→存档恢复五条流）+ GitHub Actions（PR 跑 lint/test/build，main 自动部署）。
- **性能预算**：首包 JS ≤ 350 KB gzip（游戏本体）；模型不进首包；战斗场景 ≥ 55 fps（中端 Android）；TTI ≤ 2.5 s（PWA 二进）。bundle 分析进 CI 报表。
- **测试金字塔**：
  - 契约层：现有 9 用例 + 新内核（地图生成形状约束：无交叉、可达性、起点≥2；迁移链 v2→v3）。
  - 仿真层：平衡 Bot 蒙特卡洛（§7.7）。
  - 语音层：用预录粤语样本（WAV 夹具）喂 ASR 适配器做确定性单测（不依赖真麦）。
  - E2E：Playwright 的 `FakeMediaStream` 声源。
- **可复现/调试**：命令流 log 导出（`导出当局重现包` 按钮 → JSON），把用户崩溃转 1 次本地回放定位。
- **发布物**：纯静态 `dist/`（Cloudflare Pages 首选，可设 COOP/COEP；GitHub Pages 备选）。域名/图变在 PWA manifest 配置化。

---

## 10. 实施路线图

| 期 | 范围 | 交付验收 |
|---|---|---|
| **P0 基建重构** | 清理仓库垃圾文件+.gitignore；Vite/TS/Biome/CI；内核 1:1 TS 迁移；9 绿测通过；PWA 骨架（manifest+SW 预缓存、离线可玩） | `npm run ci` 全绿；离线重开可玩老 10 层 MVP |
| **P1 语音 v2** | ASR Worker（SenseVoice）+ 下载 UX + 兜底链 + 无声 QTE + TTS 示范；评分策略接口落地 | 粤语样例 WAV 端到端识别正确率达标；Firefox 全程可玩无声模式 |
| **P2 闯关战役** | 分支地图生成 + 节点 ★ 评价 + 第一幕 15 层重排 + 宝箱/问答节点 | 地图形状约束测试过；全程通关路径 Playwright 跑通 |
| **P3 声调+学习** | pitchy F0 + 调型 DTW + 练习场可视化 + 错词本/SRS + 学习报告 + 每日挑战 | 双通道评分回放一致；练习场 F0 曲线实时渲染 60fps |
| **P4 留存+打磨** | 成就/图鉴/主题皮肤；无尽塔；战绩海报分享；自适应难度；SEO/分享图 | Lighthouse PWA 100；LCP/INP 达标 |
| **P5 内容扩展** | 第二、三幕内容包（敌/精英/Boss/事件/技能/遗物）；离线 TTS（可选）；平衡仿真报告调参 | 三幕各 3 局仿真胜率 45–65% 区间 |

并行建议：P0 完成后 P1 与 P2 可两条工作流并行（语音管线和地图无耦合）。

---

## 11. 风险登记册

| 风险 | 等级 | 缓解 |
|---|---|---|
| 模型 234 MB 下载劝退 | 高 | 默认零下载保底即玩；下载是可选项；支持断点续传/镜像 CDN；首登 3 战后再引导 |
| 老 Safari WASM SIMD 缺失/性能差 | 中 | 降级矩阵已覆盖；Web Worker 隔离避免卡 UI |
| 粤语短句识别不准（专名/俚语） | 中 | 候选列表多目标匹配（现有 `alternatives` 机制扩展）；评分阈值可调；声调层补偿语义小错 |
| 麦克风权限被拒 | 中 | 教学化引导 + 无声 QTE 全程可玩兜底 |
| 环境噪声 | 中 | echoCancellation/noiseSuppression + VAD + 调准能量门限；提示重录 |
| 自动播放/音频策略 | 低 | 用户手势后建 AudioContext；Howler unlock |
| PWA 存储配额 | 低 | `navigator.storage.persist()` 申请持久化；模型可一键清除重下 |
| 授权合规 | 低 | 复用表逐一登记 LICENSE 于 `NOTICE`；SenseVoice/Apache-2.0 可商用 |
| iOS 安装形态 | 低 | manifest+apple-touch-icon；非 standalone 也可玩 |

---

## 12. 复用清单（含许可证登记）

```
sherpa-onnx (k2-fsa) ................ Apache-2.0   ASR WASM 运行时与 SenseVoice 模型
pitchy (ianprime0509) ............... MIT          实时 F0 提取
Howler.js (goldfire) ................ MIT          音频管理
Motion (motion.dev) ................. MIT          UI 动效时间轴（GSAP 为等价备选）
vite-plugin-pwa ..................... MIT          Workbox PWA
slaytheweb (oskarrough) ............. MIT          架构参考（不直接打包其代码）
zod / Vitest / Playwright / Biome ... MIT          工程基座
Vite + TypeScript ................... MIT/Apache-2.0
```

---

## 13. 待确认决策点

1. 部署目标：Cloudflare Pages（推荐，可设 COOP/COEP 开线程）还是 GitHub Pages？
2. 语义权重：字准/调准默认 60/40 是否合适？（练习场可先灰度收集）
3. 三幕战役首阶段是否要"只做第一幕 15 层 + 无尽塔"，P5 再铺二三幕内容？（推荐：是）
4. 是否保留多人/排行榜（当前方案为纯本地榜；云端榜需引入后端，违背零后端原则，列为待定）？

---

*本方案的 ASR/声调/地图/PWA 关键技术结论均经 2026-09 深度检索验证，来源：k2-fsa sherpa-onnx 官方 WASM 演示与模型发布、FunAudioLLM SenseVoice、Xenova transformers.js WebGPU、pitchy、slaytheweb、STS 地图生成逆向资料、社区 WASM ASR 实施记录（sokuji）等。*
