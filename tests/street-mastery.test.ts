import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterOf, chapterUnlocked } from "../src/street/chapters";
import { CARDS, NPCS } from "../src/street/data";
import { cardPreview, newRun, rewardChoices, startCombat } from "../src/street/engine";
import {
  LEVEL_XP,
  type MasteryEntry,
  applyDecay,
  bonusTable,
  dueCards,
  gainXp,
  levelBonus,
  levelOf
} from "../src/street/mastery";
import { freshProfile, restoreProfile } from "../src/street/profile";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

describe("熟练度", () => {
  it("经验换等级，封顶 5 级", () => {
    expect(levelOf(0)).toBe(0);
    expect(levelOf(LEVEL_XP[1])).toBe(1);
    expect(levelOf(LEVEL_XP[5] + 100)).toBe(5);
  });

  it("开口暴击比单纯出牌涨得快，并报告升级", () => {
    const book: Record<string, MasteryEntry> = {};
    const r = gainXp(book, "peng", ["play", "spoke", "crit"], NOW);
    expect(r.before).toBe(0);
    expect(r.after).toBe(2);
    gainXp(book, "mgoi", ["play"], NOW);
    expect(levelOf(book.mgoi.xp)).toBe(0);
  });

  it("超过两倍复习间隔掉级，按时复习不掉", () => {
    const book: Record<string, MasteryEntry> = {
      a: { xp: LEVEL_XP[3], last: NOW - 3 * DAY },
      b: { xp: LEVEL_XP[3], last: NOW - 9 * DAY }
    };
    const dropped = applyDecay(book, NOW);
    expect(dropped).toEqual(["b"]);
    expect(levelOf(book.a.xp)).toBe(3);
    expect(levelOf(book.b.xp)).toBe(2);
  });

  it("等级加成表与到期复习", () => {
    expect([0, 1, 2, 3, 4, 5].map(levelBonus)).toEqual([0, 0, 1, 1, 2, 3]);
    const book: Record<string, MasteryEntry> = {
      peng: { xp: LEVEL_XP[4], last: NOW - 8 * DAY },
      mgoi: { xp: LEVEL_XP[1], last: NOW }
    };
    expect(bonusTable(book)).toEqual({ peng: 2 });
    expect(dueCards(book, NOW)).toEqual(["peng"]);
  });

  it("对局加成真正作用在出牌效果上", () => {
    const run = newRun(7);
    const npc = Object.values(NPCS).find((n) => !n.boss)?.id ?? "auntie";
    startCombat(run, npc);
    const card = CARDS.peng;
    const base = cardPreview(run, card).persuade;
    run.bonus = { peng: 2 };
    expect(cardPreview(run, card).persuade).toBe(base + 2);
  });
});

describe("章节", () => {
  it("第 1 章就绪且内容完整，其余章节未就绪时不可开局", () => {
    const ch1 = CHAPTERS[0];
    expect(ch1.ready).toBe(true);
    for (const id of [...ch1.npcsEarly, ...ch1.npcsLate, ch1.boss]) expect(NPCS[id]).toBeDefined();
    for (const id of ch1.starter) expect(CARDS[id]).toBeDefined();
    expect(chapterUnlocked(1, [])).toBe(true);
    expect(chapterUnlocked(2, [1])).toBe(CHAPTERS[1].ready);
    expect(chapterOf(99).id).toBe(1);
  });

  it("新开局记录章节，奖励只出本章及之前的卡", () => {
    const run = newRun(3, 1);
    expect(run.chapter).toBe(1);
    for (let i = 0; i < 20; i++)
      for (const id of rewardChoices(run)) expect(CARDS[id].chapter ?? 1).toBeLessThanOrEqual(1);
  });

  it("所有卡牌、街坊都标了章节", () => {
    for (const c of Object.values(CARDS)) expect(c.chapter).toBeGreaterThanOrEqual(1);
    for (const n of Object.values(NPCS)) expect(n.chapter).toBeGreaterThanOrEqual(1);
  });
});

describe("档案 v2 迁移", () => {
  it("v1 档案自动升级：补齐熟练度与章节，通关过视为第 1 章已通关", () => {
    const p = restoreProfile({ version: 1, runs: 5, wins: 1, seen: ["peng"] });
    expect(p.version).toBe(2);
    expect(p.mastery).toEqual({});
    expect(p.cleared).toEqual([1]);
    expect(freshProfile().cleared).toEqual([]);
  });

  it("熟练度白名单：未知卡、负数、未来时间都被丢弃或夹紧", () => {
    const future = Date.now() + 10 * DAY;
    const p = restoreProfile({
      mastery: {
        peng: { xp: 12.7, last: future },
        fake: { xp: 5, last: 1 },
        mgoi: { xp: -3, last: 1 },
        zousan: { xp: 9999, last: 5 }
      },
      cleared: [1, 1, 99, "2"]
    });
    expect(Object.keys(p.mastery).sort()).toEqual(["peng", "zousan"]);
    expect(p.mastery.peng.xp).toBe(12);
    expect(p.mastery.peng.last).toBeLessThanOrEqual(Date.now());
    expect(p.mastery.zousan.xp).toBe(60);
    expect(p.cleared).toEqual([1]);
  });
});
