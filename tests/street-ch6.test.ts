import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterUnlocked } from "../src/street/chapters";
import { CH6_STARTER } from "../src/street/content/ch6";
import { CARDS, NPCS, RELICS } from "../src/street/data";
import { cardPreview, newRun } from "../src/street/engine";
import { orderTokens, stripPunct } from "../src/street/school";

describe("第六章内容", () => {
  it("卡字段齐全、jp 合法、章节标号正确", () => {
    const ch6 = Object.values(CARDS).filter((c) => c.chapter === 4);
    expect(ch6.length).toBeGreaterThanOrEqual(18);
    for (const c of ch6) {
      expect(c.jp, c.id).toMatch(/^[a-z0-9 ]+$/);
      expect(c.meaning.length).toBeGreaterThan(1);
      if (c.kind === "persuade") expect((c.persuade ?? 0) + (c.calm ?? 0)).toBeGreaterThan(0);
    }
  });
  it("街坊意图 need 都有对应卡；起手卡 10 张", () => {
    for (const n of Object.values(NPCS).filter((n) => n.chapter === 4)) {
      expect(n.target).toBeGreaterThanOrEqual(44);
      for (const i of n.intents) {
        if (!i.need) continue;
        expect(
          Object.values(CARDS).some((c) => c.tags?.includes(i.need as never)),
          `${n.id}:${i.label}`
        ).toBe(true);
      }
    }
    expect(CH6_STARTER).toHaveLength(10);
    for (const id of CH6_STARTER) expect(CARDS[id].chapter).toBe(6);
  });
  it("解锁链：通关第 5 章先开第 6 章", () => {
    const ch6 = CHAPTERS.find((c) => c.id === 6);
    expect(ch6?.ready).toBe(true);
    expect(chapterUnlocked(4, [1, 2])).toBe(false);
    expect(chapterUnlocked(4, [1, 2, 3])).toBe(true);
  });
  it("语气遗物：句含「嗎/嘛」→ 稳住 +2；含「啦」→ 说服 +2", () => {
    const run = newRun(1, 4);
    run.relics = ["maa2relic", "laa1relic"];
    const maa = cardPreview(run, CARDS.bing5siu4); // 你好嗎？（calm 5）
    expect(maa.calm).toBe(CARDS.bing5siu4.calm! + 2);
    const laa = cardPreview(run, CARDS.hou2ji6); // 最緊要啦（persuade 6）
    expect(laa.persuade).toBe(CARDS.hou2ji6.persuade! + 2);
    expect(RELICS.maa2relic).toBeDefined();
    expect(RELICS.laa1relic).toBeDefined();
  });
  it("第 6 章砌句题库全部对得上原句", () => {
    for (const id of ["koi1sun1", "hou2ji6", "zik1sau2", "bing5siu4", "saai1ngo5", "cing4sau2"]) {
      const toks = orderTokens(id);
      expect(toks, id).toBeDefined();
      expect(toks!.join(""), id).toBe(stripPunct(CARDS[id].phrase));
    }
  });
});
