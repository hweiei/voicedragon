/**
 * P13 词林（纯函数层）：点数规则、称号阶梯、条目覆盖、补练排序。
 * 「奖励不出售强度」由 ../contract/p13-wordbook.test.ts 的字段白名单锁定。
 */

import { describe, expect, test } from "vitest";
import { ALL_EVENTS, ALL_SKILLS } from "../../src/core/content";
import type { Skill } from "../../src/core/data";
import { syntheticMasteryStore } from "../../src/core/mastery";
import { parseJyutpingTones } from "../../src/core/tone";
import {
  WORDBOOK_POINTS_PER_ENTRY,
  WORDBOOK_POINTS_PER_TIER1,
  WORDBOOK_POINTS_PER_TIER2,
  WORDBOOK_TITLES,
  wordbookEntries,
  wordbookFocusIds,
  wordbookProgress,
  wordbookTitleFor
} from "../../src/core/wordbook";

const SKILLS: Skill[] = ALL_SKILLS.slice(0, 3);

function storeFor(score: number, attempts: number, skills: readonly Skill[] = SKILLS) {
  return syntheticMasteryStore(
    skills.map((skill) => ({ id: skill.id, tones: parseJyutpingTones(skill.jyutping) })),
    score,
    attempts
  );
}

describe("P13 词林点数与称号", () => {
  test("点数 = 收录 +2 / tier1 +6 / tier2 +12（取最高，不叠加）", () => {
    const none = wordbookProgress(wordbookEntries(null, { skills: [], events: [] }, SKILLS));
    expect(none.points).toBe(0);
    // 只收录（无练习数据）：每个条目 +2
    const collected = wordbookProgress(
      wordbookEntries(null, { skills: SKILLS.map((skill) => skill.id), events: [] }, SKILLS)
    );
    expect(collected.points).toBe(SKILLS.length * WORDBOOK_POINTS_PER_ENTRY);
    // tier1：收录 2 + 掌握 6
    const tier1 = wordbookProgress(
      wordbookEntries(
        storeFor(85, 2),
        { skills: SKILLS.map((skill) => skill.id), events: [] },
        SKILLS
      )
    );
    expect(tier1.points).toBe(
      SKILLS.length * (WORDBOOK_POINTS_PER_ENTRY + WORDBOOK_POINTS_PER_TIER1)
    );
    expect(tier1.tier1).toBe(SKILLS.length);
    expect(tier1.tier2).toBe(0);
    // tier2：收录 2 + 掌握 12
    const tier2 = wordbookProgress(
      wordbookEntries(
        storeFor(95, 4),
        { skills: SKILLS.map((skill) => skill.id), events: [] },
        SKILLS
      )
    );
    expect(tier2.points).toBe(
      SKILLS.length * (WORDBOOK_POINTS_PER_ENTRY + WORDBOOK_POINTS_PER_TIER2)
    );
    expect(tier2.tier2).toBe(SKILLS.length);
  });

  test("称号阶梯边界（0 / 20 / 60 / 120 / 200）", () => {
    expect(WORDBOOK_TITLES.map((title) => title.requirement)).toEqual([0, 20, 60, 120, 200]);
    expect(wordbookTitleFor(0).name).toBe("新声");
    expect(wordbookTitleFor(19).name).toBe("新声");
    expect(wordbookTitleFor(20).name).toBe("识曲");
    expect(wordbookTitleFor(59).name).toBe("识曲");
    expect(wordbookTitleFor(60).name).toBe("通韵");
    expect(wordbookTitleFor(120).name).toBe("六调了然");
    expect(wordbookTitleFor(199).name).toBe("六调了然");
    expect(wordbookTitleFor(10_000).name).toBe("词林班主");
  });

  test("进度汇总：下一称号、音节覆盖、场景词不评掌握度", () => {
    const entries = wordbookEntries(
      storeFor(95, 4),
      { skills: [SKILLS[0].id], events: [ALL_EVENTS[0].id] },
      SKILLS
    );
    const progress = wordbookProgress(entries);
    expect(progress.total).toBe(SKILLS.length + ALL_EVENTS.length);
    expect(progress.skillTotal).toBe(SKILLS.length);
    expect(progress.sceneTotal).toBe(ALL_EVENTS.length);
    expect(progress.sceneCollected).toBe(1);
    expect(progress.collected).toBe(2);
    // 点数 = 收录 2 + 2（一条技能 + 一条场景）+ 三条 tier2 ×12 = 40 → 识曲，下一档 通韵
    expect(progress.points).toBe(40);
    expect(progress.title.name).toBe("识曲");
    expect(progress.nextTitle?.name).toBe("通韵");
    const scene = entries.find((entry) => entry.kind === "scene");
    expect(scene?.mastery).toBeNull();
    // 场景词没有练习数据，绝不假装有掌握度
    expect(entries.filter((entry) => entry.mastery).length).toBe(SKILLS.length);
  });

  test("条目覆盖全部技能与全部奇遇，且顺序稳定", () => {
    const entries = wordbookEntries(null, { skills: [], events: [] });
    expect(entries.length).toBe(ALL_SKILLS.length + ALL_EVENTS.length);
    expect(entries.slice(0, ALL_SKILLS.length).map((entry) => entry.id)).toEqual(
      ALL_SKILLS.map((skill) => skill.id)
    );
    for (const entry of entries) {
      expect(entry.phrase.length).toBeGreaterThan(0);
      expect(entry.lesson.length).toBeGreaterThan(0);
    }
  });

  test("补练排序：先练最差的（有数据且未练透，按均分升序）", () => {
    const entries = wordbookEntries(storeFor(70, 3), { skills: [], events: [] }, SKILLS);
    const ids = wordbookFocusIds(entries, 2);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => SKILLS.some((skill) => skill.id === id))).toBe(true);
    // 完全没练过的句子不会被排进「补练」
    const empty = wordbookFocusIds(wordbookEntries(null, { skills: [], events: [] }, SKILLS));
    expect(empty).toEqual([]);
    expect(wordbookFocusIds(entries, 0)).toEqual([]);
  });
});
