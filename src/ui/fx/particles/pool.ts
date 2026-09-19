/**
 * P6-F2 粒子对象池：Float32Array 结构体数组（SoA 热路径），零运行时分配。
 *
 * 纯逻辑、可单测（tests/unit/fx-pool.test.ts）：
 * - spawn 满池返回 false（不覆盖活粒子）；
 * - step 中死亡粒子与尾粒子交换（O(1) 回收，无洞）；
 * - 积分 = 位置 += 速度·dt，速度 += 重力·dt，附加全局阻尼。
 *
 * 坐标约定：x/y 归一化 [0,1]（渲染层乘画布尺寸），速度/秒，寿命/秒。
 */

/** 每粒子 9 个分量：x y vx vy gy life maxLife size hue */
export const PARTICLE_STRIDE = 9;

export interface ParticlePool {
  capacity: number;
  /** 存活粒子数（[0, capacity]） */
  count: number;
  data: Float32Array;
}

/** 阻尼系数（1/秒）：让爆发粒子自然减速，避免匀速飞散 */
export const POOL_DRAG = 0.9;

export function createPool(capacity: number): ParticlePool {
  const cap = Math.max(0, Math.floor(capacity));
  return { capacity: cap, count: 0, data: new Float32Array(cap * PARTICLE_STRIDE) };
}

/** 生成一枚粒子；池满返回 false。life 同时写入 maxLife（供渲染算透明度）。 */
export function spawn(
  pool: ParticlePool,
  x: number,
  y: number,
  vx: number,
  vy: number,
  gy: number,
  life: number,
  size: number,
  hue: number
): boolean {
  if (pool.count >= pool.capacity) return false;
  const o = pool.count * PARTICLE_STRIDE;
  const d = pool.data;
  d[o] = x;
  d[o + 1] = y;
  d[o + 2] = vx;
  d[o + 3] = vy;
  d[o + 4] = gy;
  d[o + 5] = life;
  d[o + 6] = life;
  d[o + 7] = size;
  d[o + 8] = hue;
  pool.count += 1;
  return true;
}

/**
 * 推进一帧：衰减寿命 → 死则与尾部交换回收 → 积分。
 * dt 单位秒；dragPerSecond 为速度阻尼率。
 */
export function step(pool: ParticlePool, dt: number, dragPerSecond = POOL_DRAG): void {
  if (dt <= 0) return;
  const d = pool.data;
  const damp = Math.max(0, 1 - dragPerSecond * dt);
  let i = 0;
  while (i < pool.count) {
    const o = i * PARTICLE_STRIDE;
    d[o + 5] -= dt;
    if (d[o + 5] <= 0) {
      pool.count -= 1;
      const lo = pool.count * PARTICLE_STRIDE;
      for (let k = 0; k < PARTICLE_STRIDE; k += 1) d[o + k] = d[lo + k];
      continue; // 交换进来的粒子仍需在本帧检查
    }
    d[o] += d[o + 2] * dt;
    d[o + 1] += d[o + 3] * dt;
    d[o + 3] += d[o + 4] * dt;
    d[o + 2] *= damp;
    d[o + 3] *= damp;
    i += 1;
  }
}

/** 清空（切幕/重开时）。 */
export function clearPool(pool: ParticlePool): void {
  pool.count = 0;
}
