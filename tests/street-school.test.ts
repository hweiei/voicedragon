import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../src/street/chapters";
import { CARDS, RELICS } from "../src/street/data";
import { genMap, rng } from "../src/street/engine";
import { type MasteryEntry, gainXp, levelOf } from "../src/street/mastery";
import { gradeAnswer, makeQuizSet, orderTokens, quizPool, stripPunct } from "../src/street/school";

describe("学堂题库生成", () => {
  it("砌句题库的词块拼回去 = 去标点原句", () => {
    let n = 0;
    for (const id of Object.keys(CARDS)) {
      const toks = orderTokens(id);
      if (!toks || toks.length < 2) continue;
      n += 1;
      expect(toks.join(""), id).toBe(stripPunct(CARDS[id].phrase));
    }
    expect(n).toBeGreaterThanOrEqual(12);
  });
  it("四选一嘅正确项一定喺选项入面，选项唔重复", () => {
    const pool = Object.keys(CARDS);
    for (let seed = 1; seed < 30; seed++) {
      for (const q of makeQuizSet(pool, rng(seed), 4)) {
        if (q.type === "mean") {
          expect(q.opts[q.right]).toBe(CARDS[q.card].meaning);
          expect(new Set(q.opts).size).toBe(q.opts.length);
        }
        if (q.type === "listen") {
          expect(q.opts[q.right]).toBe(q.card);
          expect(new Set(q.opts).size).toBe(q.opts.length);
        }
        if (q.type === "order") {
          expect(q.tokens.join("")).toBe(stripPunct(CARDS[q.card].phrase));
          expect([...q.tiles].sort().join("|")).toBe([...q.tokens].sort().join("|"));
        }
      }
    }
  });
  it("判分：order 睇词块次序、mean/listen 睇下标", () => {
    const q = {
      type: "order" as const,
      card: "naaicaa",
      tokens: ["我要", "一杯", "冻奶茶"],
      tiles: ["冻奶茶", "我要", "一杯"]
    };
    expect(gradeAnswer(q, [1, 2, 0])).toBe(true); // 按 tiles 下标砌返原句
    expect(gradeAnswer(q, [0, 1, 2])).toBe(false);
    const mean = { type: "mean" as const, card: "peng", prompt: "", opts: ["a", "b"], right: 1 };
    expect(gradeAnswer(mean, 1)).toBe(true);
    expect(gradeAnswer(mean, 0)).toBe(false);
  });
  it("quiz 事件 +2 经验", () => {
    const book: Record<string, MasteryEntry> = {};
    const up = gainXp(book, "peng", ["quiz"], Date.now());
    expect(levelOf(2)).toBe(0);
    expect(up).toEqual({ before: 0, after: levelOf(2) });
    gainXp(book, "peng", ["quiz", "quiz"], Date.now());
    expect(book.peng.xp).toBe(6);
  });
  it("出题池优先无记录/生疏嘅卡", () => {
    const now = Date.now();
    const pool = quizPool(
      1,
      { peng: { xp: 40, last: now }, mgoi: { xp: 1, last: now - 30 * 864e5 } },
      now
    );
    expect(pool[0]).not.toBe("peng"); // peng 已经滚瓜烂熟且啱啱温过
    expect(pool).toContain("peng");
  });
  it("每张地图第 1 行有学堂节点", () => {
    for (let seed = 1; seed < 30; seed++) {
      const map = genMap(rng(seed), 1);
      expect(map.filter((n) => n.type === "school").length).toBe(1);
    }
  });
  it("章节起手卡都有音频键（c- 前缀由构建保证），且喺出题池", () => {
    for (const ch of CHAPTERS.filter((c) => c.ready)) {
      const pool = new Set(quizPool(ch.id, {}, Date.now()));
      for (const id of ch.starter) expect(pool.has(id), `${ch.title}:${id}`).toBe(true);
    }
    expect(Object.keys(RELICS).length).toBeGreaterThan(0);
  });
});
