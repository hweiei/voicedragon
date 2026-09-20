# P12 · 切磋码（零后端异步对战）详细方案

> 2026-09-20 · GROWTH-PLAN §4 的实施文档。把一局的「身份」编码成短码：**种子即链接、链接即赛局**。
> 本期不新增战斗数值、不改任何平衡曲线与门；旧局（无切磋码）行为逐位不变，自适应难度只在新入口关闭。
> 总纪律继承 AGENTS.md：零后端、隐私不出设备、零素材、≤350KB gzip、reduce-motion 降级、确定性（同码同局）。

## 1. 定位与不变量

| 不变量 | 含义 | 由谁保证 |
|---|---|---|
| **同码同局** | 同码 + 同内容版本 = 同地图、同敌人、同卡池、同词缀 | `startChallenge` 把码内 seed/版本束原样透传既有开局路径 |
| **不静默降级** | 版本束不被本引擎支持时**明确拒绝**，绝不开一局「近似」的局 | `decodeChallenge` 返回 `unsupported` / `mismatch`，UI 只显示拒绝原因 |
| **零副作用** | 解码畸形输入不抛异常、不改任何状态 | 纯函数 + `ok/理由` 判别联合，无 `throw` |
| **凭码自证** | 无排行榜、无云端、无账号；战绩簿只在本机 | 战绩簿存 `code hash → 个人最佳` |
| **隐私** | 码内只有幕/种子/版本/角色/词缀，不含昵称、时间、设备信息 | 码内字段白名单，解码拒绝未知字段 |

## 2. 码格式 — `src/core/challenge.ts`

```
VT1.<base64url(紧凑 JSON)>.<checksum32>
```

- 紧凑 JSON 字段顺序固定（编码确定性）：`v, m, a, s, r, b, e, c, n, u, ch, d, mu`
  - `v` 格式版本（=1）、`m` 模式 `campaign|endless|daily`、`a` 幕、`s` 种子（uint32）、`r` 规则集 `legacy|p7`
  - `b/e/c/n/u` = 构筑 / 对手 / 反击 / 名伶 / 绝技版本（**只认 1**；出现别的值 = 版本不匹配）
  - `ch` 角色 id、`d` 每日日期键、`mu` 词缀 id（无尽/每日：`selectMutators(seed,0)`
- 前缀 `VT1.` 便于人工识别；`checksum32` 为载荷 FNV-1a 的 base36 后 4 位（防手抄错）。
- 自实现 base64url（不依赖 `btoa`/`TextEncoder`，编码拒绝非 ASCII ⇒ 内核零平台依赖、跨环境逐位一致）。
- 长度上限 240 字符（典型战役码 ~140 字符）；超长/含非法字符/非 ASCII/校验错 → `malformed`。
- 接收侧宽容：整串复制也认（可带 URL、可带 `#c=`、可带空白，解码前剥离）。

### 公开 API（全纯函数）

| 函数 | 职责 |
|---|---|
| `encodeChallenge(bundle)` | 校验 + 编码 → `{ok:true, code}` / `{ok:false, reason, detail}` |
| `decodeChallenge(input)` | 剥离外壳 → 校验格式/范围/版本束/内容重算 → `{ok:true, code, payload, hash, challenge}` / `{ok:false, reason: malformed\|unsupported\|mismatch, detail}` |
| `challengeFromRun(state)` | 从**当前局**状态反推 bundle（结算屏「发起切磋」用；不可击败的局返回 null） |
| `challengeHash(code)` | FNV-1a → 8 位 hex（战绩簿键；同码不同书写形式归一后同键） |
| `challengeVersionLabel(bundle)` | 版本束中文标签（UI 展示「构筑 v1 · 绝技 v1」） |
| `challengeShareLine(input)` | spoiler-free 战绩行（wordle 风格）：`声震龙楼 · 二幕 · 第 12 层 ⭐⭐⭐ 声韵 84 🐉` |
| `challengeRecordFrom(...)` / `compareChallengeRecords` | 战绩簿记录与比较（通关 > 楼层 > 声韵；与每日挑战同一比较器） |

**内容版本自校验**：无尽/每日码内 `mu` 必须等于本地 `selectMutators(seed, 0)` 重算结果 —— 不一致说明码来自不同内容世代的引擎，归 `mismatch` 拒绝（这是「同码同局」的可执行证明）。

## 3. 引擎 — `GameState.duel` / `challengeVersion`

- 新增 `GameState.challengeVersion?: 1` 与 `GameState.duel?: DuelState{ code, hash, mode, act, seed }`。
- `GameEngine.startChallenge(run)`：按模式透传既有开局路径（战役 → `startCampaign`（版本束直通）；无尽 → `startEndless`；每日 → `startDaily`），随后盖上切磋身份、通知文案，并 **`adaptiveBoost = 0`**（GROWTH §6.2：切磋码局禁用自适应，同码同难），最后一次 emit（save）。
- 旧局（无码）不产生 `duel`/`challengeVersion` 字段 ⇒ 存档与既有契约逐位不变。
- `continueNextAct`（幕间续行）**清除 `duel` 身份**：码只约定它写明的那一幕，续行后的塔是玩家自己的局，不再挂在他人码的哈希下（避免战绩簿串幕）。
- 战役码与本地战役元存档共存：同 seed = 同一张图，★只升不降的既有语义不变。

## 4. 存储与分享

- `voice-tower-challenge-v1`：`{ hash → ChallengeRecord }`，同码只保留更优者（复用每日挑战比较器）；写入上限 50 条（按完成时间淘汰最旧），避免无限增长。
- 分享三件套（零后端）：**码**（复制到剪贴板）、**链接**（`#c=<码>`，PWA 与 GitHub Pages 子路径下同样安全）、**战绩行**（无剧透文案 + 码）。
- 战绩行由纯函数生成，只含：幕 / 层 / ★ / 声韵均值 / 角色徽记；不含路线、牌组、敌人等剧透。

## 5. UI 入口（`src/ui/ui.ts`）

1. **标题屏**：新增「切磋码 · 应战同局」按钮 → 弹层：粘贴码 → 解析 → 契约卡（幕/种子/版本束/角色/词缀）→「以这个码开局」；下方列出**本机战绩簿**（按 hash 折叠，只读）。
2. **URL 片段检测**：开局时读 `location.hash` 的 `c=`；解析成功 → 自动弹「收到切磋码」弹层（可关闭，标题屏保留待应战入口）；解析失败 → 弹「拒绝」警告（版本不匹配 / 码已损坏），**绝不放行**。应战后 `history.replaceState` 清掉片段，防刷新重弹。
3. **结算屏**：切磋局显示身份块（码、同码最佳对比、复制码/链接/战绩行）；非切磋局显示「发起切磋」按钮（把刚打完的局变成码）。
4. **挑战横幅**：切磋局在 `challengeBanner` 上显示「切磋局 · #hash」+ 版本束标签。
5. 所有新文案走既有 `modal-sheet` / `notice-strip` / `mutation-rule` 体系，390px 与 reduce-motion 不新增特殊处理（纯静态 DOM，无新特效）。

## 6. 测试与验收

- `tests/unit/challenge.test.ts`：编码∘解码恒等（三角色 × 三模式 × 版本束组合）；长度上限；非法输入全谱（空串/空白/URL 外壳/坏 base64/非 ASCII/坏 JSON/坏校验/越界幕/越界种子/未知角色/未知模式/非法词缀/`legacy+版本束`）；fmt 不支持（`v=2`、`b=2`）→ `unsupported`；词缀重算不符 → `mismatch`；解码零副作用（对象冻结 + 输入不被修改）；`challengeHash` 归一；战绩行/版本束标签文案；`challengeFromRun` 三模式。
- `tests/contract/p12-challenge.test.ts`：**同码两开逐位一致**（战役全版本束 + 命令序列）；引擎解码拒绝路径不改状态；`duel` JSON 往返；自适应在切磋局被钉死 0；旧局零漂移（无 `duel`/`challengeVersion`）；`continueNextAct` 清身份；战绩簿只升不降 + 上限淘汰；`challengeFromRun` 与 `startChallenge` 往返（码 → 局 → 码 等价）。
- `tests/e2e/p12.spec.ts`：① 标题屏粘码应战 → 进入同局（地图种子/幕/牌组与码一致）；② 结算屏「发起切磋」→ 另开页面同码开局 → 初态逐位一致；③ 版本不匹配/畸形片段 → 明确警告且不放行、旧链接不崩。
- 全量门：biome / tsc / vitest（416 → 递增）/ build + perf-budget / release-readiness 44 项 / Chromium E2E（41 → 递增）；六条仿真门不在本期改动范围（无战斗数值变更），跑一遍确认逐位零漂移。
- 预算：本体 JS 预估 +4 KB gzip 内（现 89.9/350）；**实测 +6.8 KB（96.7/350）**，超出部分来自应战弹层 / 战绩簿 / 结算身份块与三件套文案。

## 7. 明确不做

- 不做在线排行榜、云端存档、房间实时对战、服务器校验（违背零后端与隐私红线）。
- 不做码内嵌牌组/路线回放（码只约定种子与版本，不携带玩家行为数据）。
- 不做跨版本码迁移/近似降级（不静默降级是明写的红线）。
- 不引任何新运行时依赖。

## 8. 实施与验收记录（2026-09-20 回填）

- **落地范围**：`src/core/challenge.ts`（编解码 + 版本束校验 + 词缀重算自校验 + 战绩行/哈希/战绩簿比较）、`src/core/daily.ts`（抽出通用 `compareRunRecords`，每日与切磋共用同一比较器）、engine（`challengeVersion`/`duel`/`startChallenge`/续幕清身份）、`src/adapters/storage.ts`（`voice-tower-challenge-v1` 战绩簿）、ui（标题入口 + 收到码弹层 + URL 片段检测 + 结算屏身份块与分享三件套 + 横幅 + 「再闯一局」重开同码）、`src/main.ts`（`__VOICE_TOWER__` 暴露 `challenge.encode/decode/start` 供 E2E 驱动）。
- **编解码定案**：紧凑字段名用**显式映射**（`b/e/c/n/u`），不得用 `key[0]`——roster 与 ruleset 都首字母 `r` 会撞名并把规则集写成数字（实现期真实踩坑，单测已锁定载荷字符串）。
- **单位约定**：码内 `ab` 是百分点整数（5 / -8），引擎内 `adaptiveBoost` 是比值（0.05 / -0.08）；`startChallenge` 负责 ÷100，两端一致才有「同码同难」。
- **验收**：`docs/P12-BALANCE-REPORT.md` —— vitest 448/448（+23 unit / +9 contract）、Chromium E2E 46/46（+5）、release-readiness 44 ✅、预算 96.7/350 KB gzip（+6.8）、七条仿真与基线树逐行零漂移（仅写入路径行不同）。
