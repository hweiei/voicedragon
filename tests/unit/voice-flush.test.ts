/**
 * P14-fix 移动端兜底契约：手动/超时 flush 必须终结判定（纯规则层）。
 * worker 搬运见 src/adapters/voice/sensevoice/sensevoice.worker.ts；
 * 端点策略（自动收音路径，不走本契约）见 ./endpoint.test.ts。
 */

import { describe, expect, test } from "vitest";
import { FLUSH_FALLBACK_RESULT, flushNeedsFallbackResult } from "../../src/core/voice-flush";

describe("P14-fix flush 终结契约", () => {
  test("引擎未就绪：无论解码出多少段都必须回兜底（UI 不能悬挂）", () => {
    expect(flushNeedsFallbackResult(false, 0)).toBe(true);
    expect(flushNeedsFallbackResult(false, 3)).toBe(true);
  });

  test("引擎就绪但零段可解（静音/上下文被挂起/解码为空）：必须回兜底", () => {
    expect(flushNeedsFallbackResult(true, 0)).toBe(true);
  });

  test("已按段回传过结果：不再重复发兜底", () => {
    expect(flushNeedsFallbackResult(true, 1)).toBe(false);
    expect(flushNeedsFallbackResult(true, 8)).toBe(false);
  });

  test("兜底载荷为空结果占位：字准层据此给 0 分，但判定流程必然收口", () => {
    expect(FLUSH_FALLBACK_RESULT.text).toBe("");
    expect(FLUSH_FALLBACK_RESULT.durationMs).toBe(0);
    expect(FLUSH_FALLBACK_RESULT.recognitionTimeMs).toBe(0);
  });
});
