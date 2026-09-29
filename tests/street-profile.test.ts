import { describe, expect, test } from "vitest";
import { CARDS } from "../src/street/data";
import { freshProfile, noteCards, noteScore, restoreProfile } from "../src/street/profile";

const [a, b] = Object.keys(CARDS);

describe("街坊档案", () => {
  test("损坏或非对象数据回退为全新档案", () => {
    expect(restoreProfile(null)).toEqual(freshProfile());
    expect(restoreProfile("x")).toEqual(freshProfile());
    expect(restoreProfile({ runs: "9", seen: "abc" }).runs).toBe(0);
  });

  test("白名单恢复：未知字段丢弃，非法设置夹回默认", () => {
    const p = restoreProfile({
      runs: 3,
      wins: 1,
      seen: [a, 5, "fake", b],
      best: { [a]: 88, [b]: "bad", fake: 50 },
      evil: "<script>",
      settings: { listen: true, rate: 99, autoSpeak: "yes" }
    }) as unknown as Record<string, unknown>;
    expect(p.evil).toBeUndefined();
    expect(p.runs).toBe(3);
    expect(p.seen).toEqual([a, b]);
    expect(p.best).toEqual({ [a]: 88, [b]: 0 });
    const s = p.settings as { listen: boolean; rate: number };
    expect(s.listen).toBe(true);
    expect(s.rate).toBeLessThanOrEqual(1.2);
  });

  test("记录见过的卡与最佳分只升不降", () => {
    const p = freshProfile();
    noteCards(p, ["a", "a", "b"]);
    expect(p.seen).toEqual(["a", "b"]);
    noteScore(p, "a", 60);
    noteScore(p, "a", 40);
    noteScore(p, "a", null);
    expect(p.best.a).toBe(60);
  });
});
