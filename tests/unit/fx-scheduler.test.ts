/**
 * P6-F1 演出调度器纯逻辑测试：去抖窗口 / 优先级豁免 / 浮字并发预算 / hit-stop 时钟门。
 * 时钟可注入，全部断言确定性。
 */

import { describe, expect, test } from "vitest";
import { FxScheduler, HITSTOP_RATE } from "../../src/ui/fx/scheduler";

function makeClock(start = 0): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    }
  };
}

describe("去抖与优先级", () => {
  test("同 id 计划在 60ms 去抖窗口内被丢弃，出窗恢复", () => {
    const clock = makeClock();
    const scheduler = new FxScheduler({ now: clock.now });
    expect(scheduler.admit({ id: "hit", priority: 1 })).toBe(true);
    clock.advance(30);
    expect(scheduler.admit({ id: "hit", priority: 1 })).toBe(false);
    clock.advance(31); // 累计 61ms > 60ms
    expect(scheduler.admit({ id: "hit", priority: 1 })).toBe(true);
  });

  test("不同 id 互不影响", () => {
    const scheduler = new FxScheduler();
    expect(scheduler.admit({ id: "hit", priority: 1 })).toBe(true);
    expect(scheduler.admit({ id: "enemy", priority: 1 })).toBe(true);
  });

  test("priority 2（胜负演出）豁免去抖，永不丢弃", () => {
    const scheduler = new FxScheduler();
    expect(scheduler.admit({ id: "victory", priority: 2 })).toBe(true);
    expect(scheduler.admit({ id: "victory", priority: 2 })).toBe(true);
  });
});

describe("浮字并发预算", () => {
  test("达到上限后拒绝新浮字，释放后恢复", () => {
    const scheduler = new FxScheduler({ maxFloaters: 2 });
    expect(scheduler.registerFloater()).toBe(true);
    expect(scheduler.registerFloater()).toBe(true);
    expect(scheduler.registerFloater()).toBe(false); // 预算满
    scheduler.releaseFloater();
    expect(scheduler.registerFloater()).toBe(true);
  });

  test("释放不会把计数降到 0 以下", () => {
    const scheduler = new FxScheduler({ maxFloaters: 1 });
    scheduler.releaseFloater(); // 多余释放
    scheduler.releaseFloater();
    expect(scheduler.registerFloater()).toBe(true); // 仍有 1 个名额
  });
});

describe("hit-stop 时钟门", () => {
  test("窗口内演出时钟降至 0.05×，窗口结束恢复 1×", () => {
    const clock = makeClock();
    const scheduler = new FxScheduler({ now: clock.now });
    expect(scheduler.playbackRate).toBe(1);
    expect(scheduler.inHitstop()).toBe(false);

    scheduler.enterHitstop(40);
    expect(scheduler.inHitstop()).toBe(true);
    expect(scheduler.playbackRate).toBe(HITSTOP_RATE);

    clock.advance(39);
    expect(scheduler.inHitstop()).toBe(true);
    clock.advance(1);
    expect(scheduler.inHitstop()).toBe(false);
    expect(scheduler.playbackRate).toBe(1);
  });

  test("非正时长不进入 hit-stop", () => {
    const scheduler = new FxScheduler();
    scheduler.enterHitstop(0);
    expect(scheduler.inHitstop()).toBe(false);
  });
});
