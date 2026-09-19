/**
 * P6-F2 发射器：确定性（同种子同结果）、数量/池满行为、三幕主题映射。
 */

import { describe, expect, test } from "vitest";
import { mulberry32 } from "../../src/core/levelgen";
import { BURST_PRESETS, burstSpecFor, emitBurst } from "../../src/ui/fx/particles/emitter";
import { ACT_THEMES, actThemeFor } from "../../src/ui/fx/particles/field";
import { PARTICLE_STRIDE, createPool } from "../../src/ui/fx/particles/pool";

function snapshot(pool: ReturnType<typeof createPool>): number[] {
  return Array.from(pool.data.subarray(0, pool.count * PARTICLE_STRIDE));
}

describe("emitBurst 确定性", () => {
  test("同种子 + 同 spec → 逐位相同；异种子 → 不同", () => {
    const spec = burstSpecFor("spark", 0.5, 0.3);
    const a = createPool(64);
    const b = createPool(64);
    const c = createPool(64);
    expect(emitBurst(a, spec, mulberry32(42))).toBe(BURST_PRESETS.spark.count);
    expect(emitBurst(b, spec, mulberry32(42))).toBe(BURST_PRESETS.spark.count);
    emitBurst(c, spec, mulberry32(43));
    expect(snapshot(a)).toEqual(snapshot(b));
    expect(snapshot(a)).not.toEqual(snapshot(c));
  });

  test("池满时少发不崩（返回实际数）", () => {
    const pool = createPool(5);
    const spec = burstSpecFor("firework", 0.5, 0.5); // count 84
    expect(emitBurst(pool, spec, mulberry32(7))).toBe(5);
    expect(pool.count).toBe(5);
  });

  test("hueShift 整体平移色带（三幕烟花换色）", () => {
    const base = burstSpecFor("firework", 0.5, 0.5);
    const shifted = burstSpecFor("firework", 0.5, 0.5, 40);
    expect(shifted.hueA - base.hueA).toBe(40);
    expect(shifted.hueB - base.hueB).toBe(40);
  });
});

describe("actThemeFor 三幕氛围", () => {
  test("战役按幕、经典/无尽/标题回一幕龙楼", () => {
    expect(actThemeFor({ campaign: { act: 2 } })).toBe(ACT_THEMES.act2);
    expect(actThemeFor({ campaign: { act: 3 } })).toBe(ACT_THEMES.act3);
    expect(actThemeFor({ campaign: { act: 1 } })).toBe(ACT_THEMES.act1);
    expect(actThemeFor({})).toBe(ACT_THEMES.act1);
    expect(actThemeFor({ endless: true })).toBe(ACT_THEMES.act1);
  });

  test("三幕主题动力学各有性格（雾海横移、云顶急升）", () => {
    expect(ACT_THEMES.act2.drift).toBeGreaterThan(ACT_THEMES.act1.drift);
    expect(ACT_THEMES.act3.rise).toBeGreaterThan(ACT_THEMES.act1.rise);
    expect(ACT_THEMES.act2.moteHueA).toBeGreaterThan(150); // 冷色
  });
});
