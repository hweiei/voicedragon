/**
 * P14-fix 移动端兜底契约（纯规则层）：手动停止 / 8 秒兜底的 flush 是「最终判定路径」，
 * 必须终结本次判定——否则 UI 侧 pending 永远悬挂（手机浏览器"点开录音结束不了"的元凶之一：
 * 整段没采到可识别语音时，worker 一帧 result 都不发，界面卡死在"收音中/判定中"）。
 *
 * worker 只做搬运（见 sensevoice.worker.ts handleFlush）：
 * - 引擎未就绪或零段可解 → 回空结果占位，让 UI 收口；
 * - 已按段回传过结果 → 返回 false，不重复发消息。
 *
 * 本契约**不适用**自动收音端点路径：那里解码为空应继续听下一句，
 * 否则嘈杂环境里一次误检就会提前终结整次施法。
 */

/** 最终判定路径是否需要回一个兜底（空）结果。 */
export function flushNeedsFallbackResult(ready: boolean, decodedCount: number): boolean {
  return !ready || decodedCount === 0;
}

/** 兜底空结果的载荷（与 DownstreamMessage 的 result 分支字段对齐）。 */
export const FLUSH_FALLBACK_RESULT = {
  text: "",
  durationMs: 0,
  recognitionTimeMs: 0
} as const;
