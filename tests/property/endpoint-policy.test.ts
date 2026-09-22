/**
 * P15 铸剑炉 · 属性测试：P14 端点策略（`src/core/endpoint.ts`）。
 *
 * 不变量（任意帧序列）：
 * 1) 事件合法性——`speech-start` 只在非说话态发出、每段一次；`auto-stop` 只在
 *    本段已 `speech-start` 后发出、一次即回 idle；故 #start ≤ #stop + 1；
 * 2) 收口时延如实且有界——`auto-stop` 时 `lastLatencyMs ∈ [minSilence, minSilence + 一窗]`；
 * 3) 确定性——同帧序列喂两个策略实例，事件流逐位一致；
 * 4) `reset` 无记忆——重置后纯静默帧不再产生任何事件；
 * 5) 纯静默永不开口——从头到尾无 `speech-start`。
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  ENDPOINT_WINDOW_MS,
  type EndpointEvent,
  EndpointPolicy,
  MIN_SILENCE_MS
} from "../../src/core/endpoint";

/** 一帧 = 一窗 VAD 结果；nowMs 按窗推进（与 worker 的真实喂法同构）。 */
const framesArb = fc.array(fc.boolean(), { maxLength: 400 });

function replay(frames: boolean[]): EndpointEvent[] {
  const policy = new EndpointPolicy();
  const events: EndpointEvent[] = [];
  frames.forEach((voice, index) => {
    events.push(policy.push(voice, (index + 1) * ENDPOINT_WINDOW_MS));
  });
  return events;
}

describe("属性：端点策略事件序列合法", () => {
  test("speech-start 与 auto-stop 边沿触发、成序出现", () => {
    fc.assert(
      fc.property(framesArb, (frames) => {
        const policy = new EndpointPolicy();
        let started = false;
        let starts = 0;
        let stops = 0;
        frames.forEach((voice, index) => {
          const event = policy.push(voice, (index + 1) * ENDPOINT_WINDOW_MS);
          if (event === "speech-start") {
            expect(started).toBe(false); // 未收口不得重发
            started = true;
            starts += 1;
          } else if (event === "auto-stop") {
            expect(started).toBe(true); // 没开口不许收口
            expect(policy.isSpeaking).toBe(false);
            // 收口时延有界：不小于静默阈值、不多于阈值 + 一窗量化误差
            const latency = policy.lastLatencyMs;
            expect(latency).not.toBeNull();
            expect(latency!).toBeGreaterThanOrEqual(MIN_SILENCE_MS);
            expect(latency!).toBeLessThanOrEqual(MIN_SILENCE_MS + ENDPOINT_WINDOW_MS);
            started = false;
            stops += 1;
          } else {
            expect(event).toBe("none");
          }
        });
        expect(starts).toBeLessThanOrEqual(stops + 1);
        expect(policy.segmentCount).toBe(stops);
      }),
      { numRuns: 200 }
    );
  });

  test("确定性：同帧序列两实例事件流逐位一致", () => {
    fc.assert(
      fc.property(framesArb, (frames) => {
        expect(replay(frames)).toEqual(replay(frames));
      }),
      { numRuns: 200 }
    );
  });

  test("reset 无记忆、纯静默永不开口", () => {
    fc.assert(
      fc.property(framesArb, fc.integer({ min: 1, max: 120 }), (frames, tail) => {
        const policy = new EndpointPolicy();
        frames.forEach((voice, index) => policy.push(voice, (index + 1) * ENDPOINT_WINDOW_MS));
        policy.reset();
        expect(policy.isSpeaking).toBe(false);
        for (let i = 0; i < tail; i += 1) {
          expect(policy.push(false, (frames.length + i + 1) * ENDPOINT_WINDOW_MS)).toBe("none");
        }
      }),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), (length) => {
        const policy = new EndpointPolicy();
        for (let i = 0; i < length; i += 1) {
          expect(policy.push(false, (i + 1) * ENDPOINT_WINDOW_MS)).toBe("none");
        }
        expect(policy.segmentCount).toBe(0);
      }),
      { numRuns: 50 }
    );
  });
});
