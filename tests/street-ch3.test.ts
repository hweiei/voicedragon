import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterUnlocked } from "../src/street/chapters";
import { CH3_STARTER } from "../src/street/content/ch3";
import { CARDS, NPCS, RELICS } from "../src/street/data";
import { cardPreview, newRun } from "../src/street/engine";
import { orderTokens, stripPunct } from "../src/street/school";

describe("第三章内容", () => {
  it("卡字段齐全、jp 合法、章节标号正确", () => {
    const ch3 = Object.values(CARDS).filter((c) => c.chapter === 3);
    expect(ch3.length).toBeGreaterThanOrEqual(18);
    for (const c of ch3) {
      expect(c.jp, c.id).toMatch(/^[a-z0-9 ]+$/);
      expect(c.meaning.length).toBeGreaterThan(1);
      if (c.kind === "persuade") expect((c.persuade ?? 0) + (c.calm ?? 0)).toBeGreaterThan(0);
    }
  });
  it("街坊意图 need 都有对应卡；起手卡 10 张", () => {
    for (const n of Object.values(NPCS).filter((n) => n.chapter === 3)) {
      expect(n.target).toBeGreaterThanOrEqual(44);
      for (const i of n.intents) {
        if (!i.need) continue;
        expect(
          Object.values(CARDS).some((c) => c.tags?.includes(i.need as never)),
          `${n.id}:${i.label}`
        ).toBe(true);
      }
    }
    expect(CH3_STARTER).toHaveLength(10);
    for (const id of CH3_STARTER) expect(CARDS[id].chapter).toBe(3);
  });
  it("解锁链：通关第 2 章先开第 3 章", () => {
    const ch3 = CHAPTERS.find((c) => c.id === 3);
    expect(ch3?.ready).toBe(true);
    expect(chapterUnlocked(3, [1])).toBe(false);
    expect(chapterUnlocked(3, [1, 2])).toBe(true);
  });
  it("体貌遗物：句子含 咗 → 说服 +2；含 紧 → 稳住 +2", () => {
    const run = newRun(1, 3);
    run.relics = ["zorelic", "ganrelic"];
    const zo = cardPreview(run, CARDS.bungei); // 部机坏咗好耐㖎
    expect(zo.persuade).toBe(CARDS.bungei.persuade! + 2);
    const gan = cardPreview(run, CARDS.saiseng); // 有人瞓紧（calm 卡）
    expect(gan.calm).toBe(CARDS.saiseng.calm! + 2);
    expect(RELICS.zorelic).toBeDefined();
    expect(RELICS.ganrelic).toBeDefined();
  });
  it("第 3 章砌句题库全部对得上原句", () => {
    for (const id of ["zebou6syun1", "saiseng", "gaautin", "jam2caa4", "bungei", "gaap3cin2"]) {
      const toks = orderTokens(id);
      expect(toks, id).toBeDefined();
      expect(toks!.join(""), id).toBe(stripPunct(CARDS[id].phrase));
    }
  });
});
