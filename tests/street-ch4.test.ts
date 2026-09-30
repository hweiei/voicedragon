import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterUnlocked } from "../src/street/chapters";
import { CH4_STARTER } from "../src/street/content/ch4";
import { CARDS, NPCS, RELICS } from "../src/street/data";
import { cardPreview, newRun } from "../src/street/engine";
import { orderTokens, stripPunct } from "../src/street/school";

describe("第四章内容", () => {
  it("卡字段齐全、jp 合法、章节标号正确", () => {
    const ch4 = Object.values(CARDS).filter((c) => c.chapter === 4);
    expect(ch4.length).toBeGreaterThanOrEqual(18);
    for (const c of ch4) {
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
    expect(CH4_STARTER).toHaveLength(10);
    for (const id of CH4_STARTER) expect(CARDS[id].chapter).toBe(4);
  });
  it("解锁链：通关第 3 章先开第 4 章", () => {
    const ch4 = CHAPTERS.find((c) => c.id === 4);
    expect(ch4?.ready).toBe(true);
    expect(chapterUnlocked(4, [1, 2])).toBe(false);
    expect(chapterUnlocked(4, [1, 2, 3])).toBe(true);
  });
  it("写字楼遗物：句子含 识 → 说服 +2；含 可 → 稳住 +2", () => {
    const run = newRun(1, 4);
    run.relics = ["sikfan", "hoifan"];
    const sik = cardPreview(run, CARDS.sakdak1); // 我识得处理报表（persuade 7）
    expect(sik.persuade).toBe(CARDS.sakdak1.persuade! + 2);
    const hoi = cardPreview(run, CARDS.wunsoeng5); // 可唔可以听日先返？（calm 4）
    expect(hoi.calm).toBe(CARDS.wunsoeng5.calm! + 2);
    expect(RELICS.sikfan).toBeDefined();
    expect(RELICS.hoifan).toBeDefined();
  });
  it("第 4 章砌句题库全部对得上原句", () => {
    for (const id of ["mgoineoi", "sakdak1", "gaapsi4", "zing3geoi3", "m4haai3", "sik1sin1"]) {
      const toks = orderTokens(id);
      expect(toks, id).toBeDefined();
      expect(toks!.join(""), id).toBe(stripPunct(CARDS[id].phrase));
    }
  });
});
