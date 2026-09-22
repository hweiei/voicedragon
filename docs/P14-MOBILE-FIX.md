# P14-fix · 移动端「点开录音结束不了」修复方案

> 症状：手机浏览器点「开始收音」后无法结束（界面停在"收音中/判定中"），桌面端自动收音/兜底一切正常。

## 1. 根因（三个问题叠加）

### A. AudioContext 未在手势内解锁（移动端特有，主犯）

点击「开始收音」→ `adapter.start()` → `prepare()` **异步**等模型 → `beginCapture()` → 此时才 `new AudioContext()`。
iOS（及部分 Android）要求音频上下文的首次创建/恢复发生在**用户手势同步段**，否则一直 `suspended`；
原代码全仓库**没有一处 `resume()`**。后果：AudioWorklet 一帧不出 → VAD 收不到音频 →
`speech-start`/`auto-stop` 永不触发，龙吟环也不动。

### B. 静音时 flush 不回结果，pending 永久悬挂（任何平台都会挂）

8 秒兜底定时器其实会响 → `stop()` 向 worker 发 `flush` → 但没采到音频时 VAD 队列为空，
`drainVadAndDecode()` 循环 0 次 → **一个 `result` 都不发** → 适配器 `pending` 永不落地 → 界面卡死。

### C. 没有手动停止按钮

`ui.ts` 有 `stop-listening` 事件处理器，但**没有任何地方渲染这个按钮**。
手机上既没有"松手即停"语义，管线又静默，用户彻底没有结束手段。

桌面为什么正常：有近期用户交互时桌面 Chrome/Firefox 的 AudioContext 创建即 `running`，
音频流通 → 停顿 0.3 秒自动收音触发，或 8 秒兜底真能解码出东西返回。

## 2. 修复（四层，全部带回归测试）

| 层 | 文件 | 修复 |
| --- | --- | --- |
| 采集 | `src/adapters/voice/sensevoice/recorder.ts` | 新增共享 `unlockAudioContext()`：点击的同步段预热；录音时复用并 `resume()`；仍被锁定则**显式报错**（"请再点一次"）而非静默失败。共享上下文不随单次录音关闭 |
| 契约 | `src/core/voice-flush.ts` | 纯规则：手动/超时 flush（最终判定路径）**必须终结本次判定**——引擎未就绪或零段可解时回空结果占位。自动收音端点路径不走此契约（空结果继续听下一句） |
| 搬运 | `src/adapters/voice/sensevoice/sensevoice.worker.ts` | `handleFlush` 按契约兜底；`drainVadAndDecode` 返回实际回传段数 |
| 端口 | `src/adapters/voice.ts` / `sensevoice/adapter.ts` | `VoiceAdapter` 增可选 `unlockCapture()`；SenseVoice 实现为手势预热 |
| UI | `src/ui/ui.ts` | `startListening`/`practiceRecord` 在手势同步段调 `unlockCapture()`；收音中主按钮切换为**「结束并判定」**（`stop-listening` 第一次有真实渲染入口），判定收口后自动恢复「开始收音」 |

## 3. 回归测试

- 单元：`tests/unit/voice-flush.test.ts`（flush 终结契约纯规则）
- E2E：`tests/e2e/p14-stop.spec.ts`（stub 适配器注入 → 按钮切换 → `stop()` 走 flush → 收口恢复；调试口 `__VOICE_TOWER__.voice.injectAdapter`，不参与真实判定）
- 原有 479 项单元/契约测试全绿，`biome` / `tsc` / `vite build` 通过

## 4. 真机验收要点（补进 DEVICE-TEST-MATRIX §2/§3）

1. 点「开始收音」→ 龙吟环随音量涨落（证明音频帧真的在流动）。
2. 说话 → 停顿 0.3 秒 → 自动判定上屏。
3. 说话中途点「结束并判定」→ 立即进入判定。
4. 全程不说话等 8 秒 → 自动收口出结果（不再卡死）。
5. 锁屏/切后台再回来重点「开始收音」：若被系统锁音频，应看到"请再点一次"提示而非假死。
