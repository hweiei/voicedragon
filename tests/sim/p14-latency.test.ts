/**
 * P14 端点时延报表（策略级，确定性）：
 *
 * ⚠ 诚实边界：CI 没有麦克风、Silero 模型 238MB 也不进 CI，所以这里量的是**策略级**收口时延
 * ——「最后一帧人声 → 判定」的毫秒数，不含识别与设备采样开销。真机端到端时延必须在设备上量
 * （docs/DEVICE-TEST-MATRIX.md）。本表不得当作端到端数字引用。
 *
 * 对照口径：
 * - 自动收音（端点策略）：判定发生在静默 ≥300ms 时 → 时延 = 300–332ms（含一窗 32ms 量化）；
 * - 旧行为（固定窗口）：收口只能等手动松手或 8 秒上限（VOICE_CAPTURE_MAX_MS = 8000） → 时延 = 8000 − 说话结束时刻，
 *   即「说得越早停，白等越久」。
 */

import { describe, expect, test } from "vitest";
import { VOICE_CAPTURE_MAX_MS } from "../../src/core/config/balance";
import { ENDPOINT_WINDOW_MS, EndpointPolicy, MIN_SILENCE_MS } from "../../src/core/endpoint";

/** 确定性伪随机（mulberry32，与引擎无关的独立流）。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

interface Trace {
  /** 说话时长（毫秒） */
  speechMs: number;
  /** 说话前后的静默窗数（模拟点按后的迟疑） */
  leadInWindows: number;
  tailWindows: number;
}

/** 造 48 条确定性轨迹：说话 0.4–3s，长短静默混合（真人节奏的粗模型）。 */
function buildTraces(): Trace[] {
  const rng = mulberry32(0x2026_0920);
  return Array.from({ length: 48 }, () => ({
    speechMs: 400 + Math.round(rng() * 2600),
    leadInWindows: Math.floor(rng() * 6),
    tailWindows: 12 + Math.floor(rng() * 6)
  }));
}

/** 策略级收口时延（毫秒）。 */
function latencyFor(trace: Trace, mode: "auto" | "fixed"): number {
  const policy = new EndpointPolicy();
  let now = 0;
  const speechWindows = Math.max(1, Math.round(trace.speechMs / ENDPOINT_WINDOW_MS));
  const frames = [
    ...Array.from({ length: trace.leadInWindows }, () => false),
    ...Array.from({ length: speechWindows }, () => true),
    ...Array.from({ length: trace.tailWindows }, () => false)
  ];
  let lastVoiceAt = 0;
  for (const voice of frames) {
    now += ENDPOINT_WINDOW_MS;
    if (voice) lastVoiceAt = now;
    const event = mode === "auto" ? policy.push(voice, now) : "none";
    if (event === "auto-stop") return policy.lastLatencyMs ?? 0;
  }
  // 固定窗口：只能等 8 秒上限（CI 里没有人类手指来松手）
  return Math.max(0, VOICE_CAPTURE_MAX_MS - lastVoiceAt);
}

describe("P14 端点时延（策略级）", () => {
  const traces = buildTraces();

  test("自动收音：收口时延与说话长短无关，恒在 300–332ms（静默常数 + 一窗）", () => {
    const latencies = traces.map((trace) => latencyFor(trace, "auto"));
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    expect(min).toBeGreaterThanOrEqual(MIN_SILENCE_MS);
    expect(max).toBeLessThan(MIN_SILENCE_MS + ENDPOINT_WINDOW_MS);
    const p50 = percentile(latencies, 50);
    const p90 = percentile(latencies, 90);
    expect(p50).toBeLessThanOrEqual(MIN_SILENCE_MS + ENDPOINT_WINDOW_MS);
    expect(p90).toBeLessThanOrEqual(MIN_SILENCE_MS + ENDPOINT_WINDOW_MS);
    // 报表数据（真机复核前，这里只做策略级断言）
    console.log(
      `P14 策略级收口时延：自动收音 p50 ${p50}ms / p90 ${p90}ms（n=${latencies.length}）`
    );
  });

  test("旧行为对照：固定窗口 p50 秒级（等 8 秒上限），下降一个数量级", () => {
    const auto = traces.map((trace) => latencyFor(trace, "auto"));
    const fixed = traces.map((trace) => latencyFor(trace, "fixed"));
    const autoP50 = percentile(auto, 50);
    const fixedP50 = percentile(fixed, 50);
    const fixedP90 = percentile(fixed, 90);
    console.log(
      `P14 策略级对照：固定窗口 p50 ${fixedP50}ms / p90 ${fixedP90}ms → 自动收音 p50 ${autoP50}ms`
    );
    expect(fixedP50).toBeGreaterThan(1000);
    expect(fixedP50 / autoP50).toBeGreaterThan(3);
    // 说话越早停，固定窗口白等越久：这两条应成反比
    const shortTrace = traces.reduce((a, b) => (a.speechMs <= b.speechMs ? a : b));
    const longTrace = traces.reduce((a, b) => (a.speechMs >= b.speechMs ? a : b));
    expect(latencyFor(shortTrace, "fixed")).toBeGreaterThan(latencyFor(longTrace, "fixed"));
    expect(latencyFor(shortTrace, "auto")).toBe(latencyFor(longTrace, "auto"));
  });

  test("确定性：同轨迹两次运行逐位一致（无隐藏时钟/随机）", () => {
    for (const trace of traces.slice(0, 8)) {
      expect(latencyFor(trace, "auto")).toBe(latencyFor(trace, "auto"));
      expect(latencyFor(trace, "fixed")).toBe(latencyFor(trace, "fixed"));
    }
  });
});
