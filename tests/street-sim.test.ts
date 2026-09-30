import { describe, expect, it } from "vitest";
import { simChapter } from "../src/street/sim";

/**
 * 街线六章平衡带（H-08/阶段5.5 固化）。
 * 300 局/档同种子确定性；带值 = 2026-09-30 实测（±8pp 容差防样本抖动，
 * 任何内容/数值改动越带都要求显式重校并在 docs/references/balance.md 记录）。
 * noob=接招0% / mid=50% / pro=100%。
 */
const BANDS: Record<number, [number, number, number]> = {
  1: [46, 49, 51],
  2: [42, 63, 71],
  3: [38, 43, 43],
  4: [24, 49, 53],
  5: [21, 45, 46],
  6: [30, 54, 64]
};
const TOL = 8;

describe("数值平衡模拟（机器人 300 局/章）", () => {
  it.each([1, 2, 3, 4, 5, 6])("第 %i 章：三档胜率落在固化带内", (ch) => {
    const [b1, b2, b3] = BANDS[ch];
    const r = [0, 0.5, 1].map((acc) => simChapter(ch, 300, 1, acc));
    const got = r.map((x) => x.winRate * 100);
    console.log(
      `第${ch}章 实测 ${got.map((v) => v.toFixed(1)).join("/")}（带 ${b1}/${b2}/${b3}±${TOL}）`
    );
    got.forEach((v, i) => {
      expect(Math.abs(v - [b1, b2, b3][i]), `第${ch}档${i}`).toBeLessThan(TOL);
    });
    // 技能单调性：发音越准不差（ch3 设计上限处持平合法）
    expect(r[2].winRate).toBeGreaterThanOrEqual(r[1].winRate - 0.05);
    expect(r[1].winRate).toBeGreaterThanOrEqual(r[0].winRate - 0.05);
    // 全局体验带：mid 不早夭
    expect(r[1].winRate).toBeGreaterThan(0.3);
    expect(r[1].winRate).toBeLessThan(0.75);
  });
});
