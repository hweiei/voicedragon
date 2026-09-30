import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterUnlocked } from "../src/street/chapters";
import { CH5_STARTER } from "../src/street/content/ch5";
import { CARDS, NPCS, RELICS } from "../src/street/data";
import { cardPreview, newRun } from "../src/street/engine";
import { orderTokens, stripPunct } from "../src/street/school";

describe("第五章内容", () => {
  it("卡字段齐全、jp 合法、章节标号正确", () => {
    const ch5 = Object.values(CARDS).filter((c) => c.chapter === 4);
    expect(ch5.length).toBeGreaterThanOrEqual(18);
    for (const c of ch5) {
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
    expect(CH5_STARTER).toHaveLength(10);
    for (const id of CH5_STARTER) expect(CARDS[id].chapter).toBe(5);
  });
  it("解锁链：通关第 4 章先开第 5 章", () => {
    const ch5 = CHAPTERS.find((c) => c.id === 5);
    expect(ch5?.ready).toBe(true);
    expect(chapterUnlocked(4, [1, 2])).toBe(false);
    expect(chapterUnlocked(4, [1, 2, 3])).toBe(true);
  });
  it("办事遗物：句子含 因 → 稳住 +2；含 比 → 说服 +2", () => {
    const run = newRun(1, 4);
    run.relics = ["jan2relic", "bei2relic"];
    const jan = cardPreview(run, CARDS.jan1wai4); // 因為塞車…（calm 4）
    expect(jan.calm).toBe(CARDS.jan1wai4.calm! + 2);
    const bei = cardPreview(run, CARDS.bei2jung6); // 呢隻藥比上次有用（persuade 7）
    expect(bei.persuade).toBe(CARDS.bei2jung6.persuade! + 2);
    expect(RELICS.jan2relic).toBeDefined();
    expect(RELICS.bei2relic).toBeDefined();
  });
  it("第 5 章砌句题库全部对得上原句", () => {
    for (const id of ["ho2lung4", "gaau1mun5", "tau4faat1", "lo2zi2", "daai6zi6", "m4zung1"]) {
      const toks = orderTokens(id);
      expect(toks, id).toBeDefined();
      expect(toks!.join(""), id).toBe(stripPunct(CARDS[id].phrase));
    }
  });
});
