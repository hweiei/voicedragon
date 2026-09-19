/**
 * P6-F2 粒子对象池不变式：满池拒生 / 死粒尾交换回收 / 积分与阻尼。
 */

import { describe, expect, test } from "vitest";
import {
  PARTICLE_STRIDE,
  clearPool,
  createPool,
  spawn,
  step
} from "../../src/ui/fx/particles/pool";

describe("createPool / spawn", () => {
  test("满池返回 false 且不覆盖活粒子", () => {
    const pool = createPool(2);
    expect(spawn(pool, 0.1, 0.1, 0, 0, 0, 1, 1, 30)).toBe(true);
    expect(spawn(pool, 0.2, 0.2, 0, 0, 0, 1, 1, 40)).toBe(true);
    expect(spawn(pool, 0.3, 0.3, 0, 0, 0, 1, 1, 50)).toBe(false);
    expect(pool.count).toBe(2);
  });

  test("life 同时写入 maxLife（渲染透明度分母）", () => {
    const pool = createPool(1);
    spawn(pool, 0.5, 0.5, 0, 0, 0, 1.25, 2, 45);
    expect(pool.data[5]).toBe(1.25); // life
    expect(pool.data[6]).toBe(1.25); // maxLife
  });
});

describe("step 积分与回收", () => {
  test("位置随速度与时间积分", () => {
    const pool = createPool(1);
    spawn(pool, 0.5, 0.5, 0.2, -0.1, 0, 1, 1, 40);
    step(pool, 0.5, 0); // 半秒、无阻尼
    expect(pool.data[0]).toBeCloseTo(0.6, 5); // x += 0.2 × 0.5
    expect(pool.data[1]).toBeCloseTo(0.45, 5); // y += -0.1 × 0.5
  });

  test("重力作用于纵向速度", () => {
    const pool = createPool(1);
    spawn(pool, 0.5, 0.5, 0, 0, 0.4, 1, 1, 40);
    step(pool, 0.5, 0);
    expect(pool.data[3]).toBeCloseTo(0.2, 5); // vy += gy × dt
  });

  test("寿命归零即回收（尾交换，无洞）", () => {
    const pool = createPool(3);
    spawn(pool, 0.1, 0, 0, 0, 0, 0.01, 1, 1); // 将死
    spawn(pool, 0.2, 0, 0, 0, 0, 5, 1, 2);
    spawn(pool, 0.3, 0, 0, 0, 0, 5, 1, 3);
    step(pool, 0.1, 0);
    expect(pool.count).toBe(2);
    // 死粒位置 0.1 不再存在；尾粒交换进索引 0
    expect(pool.data[0]).toBeCloseTo(0.3, 5);
    expect(pool.data[PARTICLE_STRIDE]).toBeCloseTo(0.2, 5);
  });

  test("clearPool 归零", () => {
    const pool = createPool(4);
    spawn(pool, 0, 0, 0, 0, 0, 3, 1, 1);
    clearPool(pool);
    expect(pool.count).toBe(0);
  });
});
