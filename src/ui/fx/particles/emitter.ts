/**
 * P6-F2 发射器：BurstSpec 描述符 + 确定性发射（mulberry32 独立种子流）。
 *
 * 设计纪律：随机数来自 core/levelgen 的 mulberry32，但种子流与游戏
 * RNG 完全隔离——特效可复现、不污染黄金契约（方案 §2.2）。
 */

import { mulberry32 } from "../../../core/levelgen";
import { type ParticlePool, spawn } from "./pool";

export type BurstKind =
  | "spark" // 命中火花（琥珀）
  | "crit" // 暴击环爆（鎏金，更多更亮）
  | "firework" // 胜利烟花（三幕各配色由 field 注入 hue 偏移）
  | "ash"; // 败北灰烬（缓落、暗）

export interface BurstSpec {
  kind: BurstKind;
  /** 发射中心（归一化画布坐标 0..1） */
  x: number;
  y: number;
  count: number;
  speedMin: number;
  speedMax: number;
  lifeMin: number;
  lifeMax: number;
  sizeMin: number;
  sizeMax: number;
  hueA: number;
  hueB: number;
  /** 每粒子重力（归一化/秒²，正=下沉） */
  gravity: number;
  /** 发射锥角（弧度），2π = 全向 */
  spread: number;
  /** 锥中心角（0=向右，-π/2=向上） */
  angle: number;
}

/** 各 burst 的形状参数（位置由调用方按战斗锚点给出）。 */
export const BURST_PRESETS: Record<BurstKind, Omit<BurstSpec, "kind" | "x" | "y">> = {
  spark: {
    count: 26,
    speedMin: 0.1,
    speedMax: 0.38,
    lifeMin: 0.32,
    lifeMax: 0.66,
    sizeMin: 1,
    sizeMax: 2.6,
    hueA: 28,
    hueB: 50,
    gravity: 0.32,
    spread: Math.PI * 2,
    angle: 0
  },
  crit: {
    count: 46,
    speedMin: 0.16,
    speedMax: 0.56,
    lifeMin: 0.45,
    lifeMax: 0.95,
    sizeMin: 1.4,
    sizeMax: 3.4,
    hueA: 40,
    hueB: 56,
    gravity: 0.22,
    spread: Math.PI * 2,
    angle: 0
  },
  firework: {
    count: 84,
    speedMin: 0.18,
    speedMax: 0.6,
    lifeMin: 0.7,
    lifeMax: 1.5,
    sizeMin: 1.2,
    sizeMax: 3,
    hueA: 18,
    hueB: 58,
    gravity: 0.3,
    spread: Math.PI * 2,
    angle: 0
  },
  ash: {
    count: 40,
    speedMin: 0.01,
    speedMax: 0.06,
    lifeMin: 1.1,
    lifeMax: 2.1,
    sizeMin: 0.8,
    sizeMax: 2,
    hueA: 26,
    hueB: 34,
    gravity: 0.05,
    spread: Math.PI * 0.9,
    angle: Math.PI / 2 // 向下
  }
};

/** 以 spec 位置的微小抖动 + 锥角采样发射；返回实际生成数（池满会少）。 */
export function emitBurst(pool: ParticlePool, spec: BurstSpec, rng: () => number): number {
  let spawned = 0;
  for (let n = 0; n < spec.count; n += 1) {
    const angle = spec.angle + (rng() - 0.5) * spec.spread;
    const speed = spec.speedMin + rng() * (spec.speedMax - spec.speedMin);
    const life = spec.lifeMin + rng() * (spec.lifeMax - spec.lifeMin);
    const size = spec.sizeMin + rng() * (spec.sizeMax - spec.sizeMin);
    const hue = spec.hueA + rng() * (spec.hueB - spec.hueA);
    const jitterX = (rng() - 0.5) * 0.03;
    const jitterY = (rng() - 0.5) * 0.03;
    const ok = spawn(
      pool,
      spec.x + jitterX,
      spec.y + jitterY,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      spec.gravity,
      life,
      size,
      hue
    );
    if (!ok) break;
    spawned += 1;
  }
  return spawned;
}

/** 便捷构造：按种类 + 位置生成完整 spec（hueShift 用于三幕烟花换色）。 */
export function burstSpecFor(kind: BurstKind, x: number, y: number, hueShift = 0): BurstSpec {
  const preset = BURST_PRESETS[kind];
  return { kind, x, y, ...preset, hueA: preset.hueA + hueShift, hueB: preset.hueB + hueShift };
}

/** 每场会话一个确定性种子流（与游戏 rngState 隔离）。 */
export function createBurstRng(): () => number {
  return mulberry32((Date.now() ^ 0x5f3759df) >>> 0);
}
