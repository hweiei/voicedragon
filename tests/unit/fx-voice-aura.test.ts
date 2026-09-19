/**
 * P6-F2 语音光环纯逻辑：六调域色相映射 + 说话人音域归一器。
 * （画布渲染属浏览器域，由真机体验与 E2E 冒烟覆盖。）
 */

import { describe, expect, test } from "vitest";
import { PitchRange, TONE_HUES, auraHueFor } from "../../src/ui/fx/voice-aura";

describe("auraHueFor 六调域色相", () => {
  test("六个调域各占一段，且顺序与 TONE_HUES 一致", () => {
    expect(auraHueFor(0)).toBe(TONE_HUES[0]); // 阴平·金
    expect(auraHueFor(0.2)).toBe(TONE_HUES[1]); // 阴上·青
    expect(auraHueFor(0.4)).toBe(TONE_HUES[2]); // 阴去·朱
    expect(auraHueFor(0.6)).toBe(TONE_HUES[3]); // 阳平·蓝
    expect(auraHueFor(0.8)).toBe(TONE_HUES[4]); // 阳上·紫
    expect(auraHueFor(1)).toBe(TONE_HUES[5]); // 阳去·翠（边界夹取）
  });

  test("越界与非法值落回阴平金", () => {
    expect(auraHueFor(-0.5)).toBe(TONE_HUES[0]);
    expect(auraHueFor(1.7)).toBe(TONE_HUES[5]); // 上夹到末段
    expect(auraHueFor(Number.NaN)).toBe(TONE_HUES[0]);
  });
});

describe("PitchRange 说话人音域归一", () => {
  test("样本不足 3 帧或音域过窄时返回中性 0.5", () => {
    const range = new PitchRange();
    expect(range.push(200)).toBe(0.5);
    expect(range.push(220)).toBe(0.5);
    // 第三帧但音域仍 <20Hz → 中性
    expect(range.push(210)).toBe(0.5);
  });

  test("音域建立后按最低/最高归一到 [0,1]", () => {
    const range = new PitchRange();
    range.push(100);
    range.push(200);
    const mid = range.push(150);
    expect(mid).toBeCloseTo(0.5, 5);
    expect(range.push(100)).toBeCloseTo(0, 5);
    expect(range.push(200)).toBeCloseTo(1, 5);
  });

  test("非人声/非法频率被拒（不参与音域）", () => {
    const range = new PitchRange();
    expect(range.push(Number.NaN)).toBeNull();
    expect(range.push(30)).toBeNull(); // 低于人声下限
    expect(range.push(1200)).toBeNull(); // 高于人声上限
  });

  test("reset 后音域重建", () => {
    const range = new PitchRange();
    range.push(100);
    range.push(300);
    range.push(200);
    range.reset();
    expect(range.push(500)).toBe(0.5); // 重新计数
  });
});
