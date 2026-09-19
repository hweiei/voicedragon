/**
 * P6-F1 打击感关键帧生成器：纯函数，零 DOM（WAAPI keyframes 的图纸）。
 *
 * 依据（方案 §5-M2 / 调研 §8.5/8.6）：
 * - 抖动首尾归零（不残留 transform）、4 拍衰减，像"被打了一记"而非"在颤抖"；
 * - 闪光先于抖动 16ms 由 director 排布，此处只给帧形。
 */

export type MotionFrame = {
  offset: number;
  transform: string;
};

export type FilterFrame = {
  offset: number;
  filter: string;
};

const px1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * 水平受击抖动：振幅 amp（px），verticalRatio 控制少量纵向"颠"感。
 * 帧序：静止 → 反向满幅 → 正向 88% → 反向 55% → 正向 25% → 静止。
 */
export function shakeKeyframes(amp: number, verticalRatio = 0.3): MotionFrame[] {
  const a = Math.max(0, amp);
  const v = a * verticalRatio;
  const at = (x: number, y: number): string => `translate(${px1(x)}px, ${px1(y)}px)`;
  return [
    { offset: 0, transform: at(0, 0) },
    { offset: 0.2, transform: at(-a, v) },
    { offset: 0.45, transform: at(a * 0.88, -v) },
    { offset: 0.7, transform: at(-a * 0.55, v * 0.5) },
    { offset: 0.88, transform: at(a * 0.25, 0) },
    { offset: 1, transform: at(0, 0) }
  ];
}

/** 命中白闪（敌方受击）：亮度冲高 90ms 内回落，走 filter 不动 layout。 */
export function flashKeyframes(): FilterFrame[] {
  return [
    { offset: 0, filter: "brightness(1)" },
    { offset: 0.35, filter: "brightness(1.9) saturate(1.2)" },
    { offset: 1, filter: "brightness(1)" }
  ];
}

/** 我方受创红闪：与原 fx-hurt-flash 同款观感（WAAPI 化以便 hit-stop 控速）。 */
export function hurtFlashKeyframes(): FilterFrame[] {
  return [
    { offset: 0, filter: "none" },
    { offset: 0.4, filter: "drop-shadow(0 0 10px rgb(220 70 60 / 0.8)) brightness(1.25)" },
    { offset: 1, filter: "none" }
  ];
}
