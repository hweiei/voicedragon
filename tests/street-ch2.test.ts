import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterUnlocked } from "../src/street/chapters";
import { CH2_STARTER } from "../src/street/content/ch2";
import { CARDS, NPCS } from "../src/street/data";
import { genMap, newRun, startReview } from "../src/street/engine";
import { rng } from "../src/street/engine";

describe("第二章内容", () => {
  it("每张卡字段齐全、属于第 2 章、jp 合法", () => {
    for (const c of Object.values(CARDS).filter((c) => c.chapter === 2)) {
      expect(c.phrase.length).toBeGreaterThan(1);
      expect(c.jp).toMatch(/^[a-z0-9 ]+$/);
      expect(c.cost).toBeGreaterThanOrEqual(0);
      if (c.kind === "persuade") expect((c.persuade ?? 0) + (c.calm ?? 0)).toBeGreaterThan(0);
    }
  });
  it("意图的 need 标签都有对应卡牌", () => {
    for (const n of Object.values(NPCS).filter((n) => n.chapter === 2)) {
      for (const i of n.intents) {
        if (!i.need) continue;
        const ok = Object.values(CARDS).some((c) => c.tags?.includes(i.need as never));
        expect(ok, `${n.id} 的意图「${i.label}」没有能接住的卡`).toBe(true);
      }
    }
  });
  it("街坊与 Boss 完整", () => {
    const ch2 = CHAPTERS[1];
    expect(ch2.ready).toBe(true);
    for (const id of [...ch2.npcsEarly, ...ch2.npcsLate, ch2.boss]) expect(NPCS[id]).toBeDefined();
    for (const id of CH2_STARTER) expect(CARDS[id]?.chapter).toBe(2);
  });
  it("章节解锁链", () => {
    expect(chapterUnlocked(2, [])).toBe(false);
    expect(chapterUnlocked(2, [1])).toBe(true);
    expect(chapterUnlocked(3, [1, 2])).toBe(false); // 第 3 章未制作
  });
});

describe("温习地摊", () => {
  it("每张地图恰有一个 review 节点", () => {
    for (let seed = 1; seed < 40; seed++) {
      const map = genMap(rng(seed), 1);
      expect(map.filter((n) => n.type === "review")).toHaveLength(1);
    }
  });
  it("复习局手牌 = 到期句子，目标随句数增长", () => {
    const run = newRun(42, 1);
    const due = ["peng", "mgoi", "zousan", "geido"];
    const c = startReview(run, due);
    expect(c.hand).toEqual(["peng", "mgoi", "zousan", "geido"]);
    expect(c.npc).toBe("recap");
    expect(c.target).toBe(14 + due.length * 4);
    expect(NPCS.recap.hidden).toBe(true);
  });
});
