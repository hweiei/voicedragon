/**
 * P14 端点策略（纯规则层）：开口/收口边界、边沿触发、时延如实、关闭即旧行为。
 * worker 只做搬运（见 sensevoice.worker.ts）；组合根调试口用同一份策略。
 */

import { describe, expect, test } from "vitest";
import {
  ENDPOINT_WINDOW_MS,
  EndpointPolicy,
  MIN_SILENCE_MS,
  MIN_SPEECH_MS
} from "../../src/core/endpoint";

/** 造一串窗：按「人声/静默」数组推进时间，返回事件序列。 */
function runPolicy(frames: boolean[]): { events: string[]; policy: EndpointPolicy } {
  const policy = new EndpointPolicy();
  const events: string[] = [];
  let now = 0;
  for (const voice of frames) {
    now += ENDPOINT_WINDOW_MS;
    events.push(policy.push(voice, now));
  }
  return { events, policy };
}

/** 说话 ms 毫秒后停 N 窗。 */
function speakThenSilence(speechMs: number, silenceWindows: number): boolean[] {
  const speechWindows = Math.round(speechMs / ENDPOINT_WINDOW_MS);
  return [
    ...Array.from({ length: speechWindows }, () => true),
    ...Array.from({ length: silenceWindows }, () => false)
  ];
}

describe("P14 端点策略边界", () => {
  test("常量：32ms 窗 / 400ms 开口 / 300ms 收口", () => {
    expect(ENDPOINT_WINDOW_MS).toBe(32);
    expect(MIN_SPEECH_MS).toBe(400);
    expect(MIN_SILENCE_MS).toBe(300);
  });

  test("开口线：累计人声 400ms 才 speech-start（差一窗不发）", () => {
    const justBelow = runPolicy(Array.from({ length: 12 }, () => true)); // 384ms
    expect(justBelow.events).not.toContain("speech-start");
    const exact = runPolicy(Array.from({ length: 13 }, () => true)); // 416ms ≥ 400
    expect(exact.events.filter((event) => event === "speech-start")).toHaveLength(1);
    expect(exact.events.indexOf("speech-start")).toBe(12);
  });

  test("收口线：静默 ≥300ms 才 auto-stop（差一窗不发），且每段只发一次", () => {
    const shortPause = runPolicy(speakThenSilence(800, 9)); // 288ms 静默
    expect(shortPause.events).not.toContain("auto-stop");
    const enoughPause = runPolicy(speakThenSilence(800, 10)); // 320ms 静默
    expect(enoughPause.events.filter((event) => event === "auto-stop")).toHaveLength(1);
    // 收口后继续静默不再重复触发
    const longPause = runPolicy(speakThenSilence(800, 40));
    expect(longPause.events.filter((event) => event === "auto-stop")).toHaveLength(1);
  });

  test("没开口就静的噪声不触发任何事件（咳嗽/翻页不误判）", () => {
    const { events, policy } = runPolicy([
      ...Array.from({ length: 5 }, () => true), // 160ms 杂音
      ...Array.from({ length: 40 }, () => false)
    ]);
    expect(events.every((event) => event === "none")).toBe(true);
    expect(policy.segmentCount).toBe(0);
    expect(policy.lastLatencyMs).toBeNull();
  });

  test("两段说话 = 两次 auto-stop；段间静默不串味", () => {
    const frames = [...speakThenSilence(600, 12), ...speakThenSilence(600, 12)];
    const { events, policy } = runPolicy(frames);
    expect(events.filter((event) => event === "speech-start")).toHaveLength(2);
    expect(events.filter((event) => event === "auto-stop")).toHaveLength(2);
    expect(policy.segmentCount).toBe(2);
  });

  test("时长如实：收口时延 = 最后一帧人声 → 判定（300–332ms，含一窗量化）", () => {
    const { policy } = runPolicy(speakThenSilence(960, 12));
    const latency = policy.lastLatencyMs!;
    expect(latency).toBeGreaterThanOrEqual(MIN_SILENCE_MS);
    expect(latency).toBeLessThan(MIN_SILENCE_MS + ENDPOINT_WINDOW_MS);
  });

  test("reset 回空闲但保留段计数与时延历史；reset 后重新计开口", () => {
    const { policy } = runPolicy(speakThenSilence(600, 12));
    expect(policy.isSpeaking).toBe(false);
    const segments = policy.segmentCount;
    policy.reset();
    expect(policy.segmentCount).toBe(segments);
    expect(policy.lastLatencyMs).not.toBeNull();
    expect(policy.push(true, 100_000)).toBe("none"); // 单窗人声不足以开口
  });

  test("可配置阈值（调试/实验用），且非法值钳到 ≥1ms", () => {
    const policy = new EndpointPolicy({ minSpeechMs: 64, minSilenceMs: 64 });
    const events = [
      policy.push(true, 32),
      policy.push(true, 64), // 累计 64ms ≥ 64 → 开口
      policy.push(false, 96), // 静默 32ms < 64
      policy.push(false, 128) // 静默 64ms ≥ 64 → 收口
    ];
    expect(events).toEqual(["none", "speech-start", "none", "auto-stop"]);
    // 0 / 负数 → 钳到 1ms：单窗人声即开口，单窗静默即收口
    const clamped = new EndpointPolicy({ minSpeechMs: 0, minSilenceMs: -5 });
    expect(clamped.push(true, 32)).toBe("speech-start");
    expect(clamped.push(false, 64)).toBe("auto-stop");
  });
});
