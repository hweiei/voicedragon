/**
 * P6-F1 打击感关键帧纯函数测试：抖动帧形（首尾归零/振幅单调）、闪光帧存在。
 */

import { describe, expect, test } from "vitest";
import { flashKeyframes, hurtFlashKeyframes, shakeKeyframes } from "../../src/ui/fx/juice";

/** 提取帧序列中最大的水平位移绝对值。 */
function peakX(frames: Array<{ transform: string }>): number {
  return Math.max(
    ...frames.map((frame) => {
      const match = frame.transform.match(/translate\((-?[\d.]+)px/);
      return match ? Math.abs(Number.parseFloat(match[1])) : 0;
    })
  );
}

describe("shakeKeyframes", () => {
  test("首尾帧归零（不残留 transform）", () => {
    const frames = shakeKeyframes(6);
    expect(frames[0].transform).toBe("translate(0px, 0px)");
    expect(frames[frames.length - 1].transform).toBe("translate(0px, 0px)");
  });

  test("峰值位移随振幅单调增长", () => {
    expect(peakX(shakeKeyframes(8))).toBeGreaterThan(peakX(shakeKeyframes(2)));
    expect(peakX(shakeKeyframes(2))).toBeCloseTo(2, 1);
  });

  test("负振幅被夹取为静止", () => {
    for (const frame of shakeKeyframes(-4)) {
      expect(frame.transform).toBe("translate(0px, 0px)");
    }
  });

  test("帧序完整覆盖 [0,1]", () => {
    const frames = shakeKeyframes(5);
    expect(frames[0].offset).toBe(0);
    expect(frames[frames.length - 1].offset).toBe(1);
  });
});

describe("闪光关键帧", () => {
  test("命中白闪：中段亮度冲高后回落", () => {
    const frames = flashKeyframes();
    expect(frames.length).toBeGreaterThanOrEqual(3);
    expect(frames[0].filter).toBe("brightness(1)");
    expect(frames[1].filter).toContain("brightness(1.9)");
    expect(frames[frames.length - 1].filter).toBe("brightness(1)");
  });

  test("我方受创红闪：中段带红色 drop-shadow", () => {
    const frames = hurtFlashKeyframes();
    expect(frames[1].filter).toContain("drop-shadow");
    expect(frames[frames.length - 1].filter).toBe("none");
  });
});
