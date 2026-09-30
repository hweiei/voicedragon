import { describe, expect, it } from "vitest";
import { simChapter } from "../src/street/sim";

describe("数值平衡模拟（机器人 300 局/章）", () => {
  it.each([1, 2])("第 %i 章：三档水平嘅胜率分布合理", (ch) => {
    const noob = simChapter(ch, 300, 1, 0); // 完全接唔住招
    const mid = simChapter(ch, 300, 1, 0.5); // 接住一半
    const pro = simChapter(ch, 300, 1, 1); // 全部接住
    console.log(
      `第${ch}章 胜率：接招0%=${(noob.winRate * 100).toFixed(1)}% 50%=${(mid.winRate * 100).toFixed(1)}% 100%=${(pro.winRate * 100).toFixed(1)}% · 中期通关平均${mid.avgTurnsOnWin}回合 余耐心${mid.avgPatienceOnWin}`
    );
    expect(mid.winRate).toBeGreaterThan(0.3); // 太难得劝退
    expect(mid.winRate).toBeLessThan(0.75); // 太易冇追求
    expect(pro.winRate).toBeGreaterThan(noob.winRate - 0.05); // 方向唔可以倒转
    expect(noob.winRate).toBeLessThan(0.95);
  });
});
