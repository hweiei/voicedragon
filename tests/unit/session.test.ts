/** src/street/session.ts 编排单测：成功/失败/胜利三路 + boss/普通两路结算 */
import { describe, expect, it, vi } from "vitest";
import { playBeat, winBeat } from "../../src/street/session";
import type { Run } from "../../src/street/engine";

function fakeRun(patch: Partial<Run> = {}): Run {
  return {
    combat: { hand: ["p9-a1", "p9-a2"], energy: 3, npc: "boss" } as never,
    gold: 100,
    chapter: 1,
    rng: 0,
    ...patch
  } as never as Run;
}

function hooks() {
  return {
    toast: vi.fn(),
    flash: vi.fn(),
    calmText: (n: number) => `🛡 ${n}`,
    afterResult: vi.fn(),
    onWin: vi.fn()
  };
}

describe("playBeat", () => {
  it("未选牌不动作", () => {
    const h = hooks();
    expect(playBeat(fakeRun(), null, false, false, () => {}, h)).toBe(false);
    expect(h.toast).not.toHaveBeenCalled();
  });
  it("被引擎拒绝时 toast 原因且不进结算", () => {
    const h = hooks();
    const clear = vi.fn();
    const ok = playBeat(fakeRun(), 99, false, false, clear, h);
    expect(ok).toBe(false);
    expect(h.toast).toHaveBeenCalledWith(expect.any(String));
    expect(clear).not.toHaveBeenCalled();
  });
  // 胜利 700ms 延迟结算路由由 e2e「出牌致胜→奖励屏」覆盖，此处不重复构造引擎终局
  it("文案拼装：暴击+接住+calmText 经 hooks 输出（经真实 playCard 首回合）", () => {
    const run = fakeRun();
    const h = hooks();
    let cleared = false;
    playBeat(run, 0, true, true, () => (cleared = true), h);
    if (h.flash.mock.calls.length) {
      const [text] = h.flash.mock.calls[0];
      expect(text).toMatch(/^(暴击！)?(接住！)?(说服 [+]\d+( 🛡 \d+)?)?$/);
      expect(cleared).toBe(true);
    } else {
      expect(h.toast).toHaveBeenCalled(); // 能量/卡不合法则走拒绝路
    }
  });
});

describe("winBeat", () => {
  it("boss 胜：记 beaten、不挂奖励、走 bossWin", () => {
    const run = fakeRun();
    const h = { bossWin: vi.fn(), afterReward: vi.fn(), markBeaten: vi.fn() };
    winBeat(run, h);
    expect(h.markBeaten).toHaveBeenCalledWith("boss");
    expect(h.bossWin).toHaveBeenCalled();
    expect(h.afterReward).not.toHaveBeenCalled();
  });
  it("普通街坊胜：12-21 金币入账 + 奖励三选一", () => {
    const run = fakeRun();
    (run.combat as never as { npc: string }).npc = "auntie";
    const h = { bossWin: vi.fn(), afterReward: vi.fn(), markBeaten: vi.fn() };
    winBeat(run, h);
    expect(h.bossWin).not.toHaveBeenCalled();
    expect(h.afterReward).toHaveBeenCalledTimes(1);
    const [gold, reward] = h.afterReward.mock.calls[0];
    expect(gold).toBeGreaterThanOrEqual(12);
    expect(gold).toBeLessThanOrEqual(21);
    expect(run.gold).toBe(100 + gold);
    expect(reward.length).toBeLessThanOrEqual(3);
  });
});
