/**
 * P6-F3 汉字粒子采样：单测跑在 node（无 DOM），锁定安全降级；
 * 浏览器域的点云质量由真机体验验证（告警档回退环爆已在 field 内保证）。
 */

import { describe, expect, test } from "vitest";
import { clearKanjiCache, kanjiPoints } from "../../src/ui/fx/kanji";

describe("kanjiPoints", () => {
  test("非浏览器环境安全返回空数组（不抛异常）", () => {
    expect(kanjiPoints("声")).toEqual([]);
    expect(kanjiPoints("震")).toEqual([]);
  });

  test("缓存清理幂等", () => {
    clearKanjiCache();
    clearKanjiCache();
    expect(kanjiPoints("声")).toEqual([]);
  });
});
