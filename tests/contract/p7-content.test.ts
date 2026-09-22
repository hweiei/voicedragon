import { describe, expect, test } from "vitest";
import {
  ALL_EVENTS,
  ALL_ITEMS,
  ALL_SKILLS,
  eventsFor,
  itemsFor,
  lookupSkill,
  skillsFor
} from "../../src/core/content";
import { EXPANSION_EVENTS, EXPANSION_SKILLS } from "../../src/core/content/expansion";
import { ITEMS, SKILLS } from "../../src/core/data";
import { GameEngine } from "../../src/core/engine";
import { scorePronunciation } from "../../src/core/scoring";
import { parseJyutpingTones } from "../../src/core/tone";

function battle(act = 1, seed = 123): GameEngine {
  const engine = new GameEngine();
  engine.startCampaign(act, seed, "p7");
  engine.chooseFloorOption(engine.state.floorOptions[0].id);
  return engine;
}

describe("P7 版本化内容契约", () => {
  test("269 技能 / 38 事件 / 8 道具；基础池与旧默认不变（P9 反击卡/P10 签名技/P11 绝技句仅进对应版本池）", () => {
    // P9/P10/P11：ALL_SKILLS 收录版本内容（图鉴/练习场可见），未开版本时池不变
    // P15：ALL_EVENTS 全集 26 → 38（+12 锻造事件，仅收录展示；抽选池门控见 eventsFor 断言）
    // P16：每幕 +2 乐学短句（入 EXPANSION_SKILLS，基础表不动）：43 → 49
    // P17：+220 词海短句（入 content/p17，仅 lexiconVersion=1 进池；ALL_SKILLS 全集收录展示）
    expect(ALL_SKILLS).toHaveLength(269);
    expect(ALL_EVENTS).toHaveLength(38);
    expect(ALL_ITEMS).toHaveLength(8);
    expect([1, 2, 3].map((act) => skillsFor(act, "p7").length)).toEqual([18, 30, 42]);
    expect([1, 2, 3].map((act) => skillsFor(act, "p7", 1).length)).toEqual([19, 31, 43]);
    // P10：签名技只进对应角色池（各 +1），其他角色与无角色调用不可获取
    expect([1, 2, 3].map((act) => skillsFor(act, "p7", 1, "faa-daan").length)).toEqual([
      20, 32, 44
    ]);
    expect(skillsFor(1, "p7", 1, "faa-daan").map((x) => x.id)).toContain("p10-gu-paan-saang-fai");
    expect(skillsFor(1, "p7", 1, "faa-daan").map((x) => x.id)).not.toContain(
      "p10-jat-fu-dong-gwaan"
    );
    expect(skillsFor(1, "p7", 1).map((x) => x.id)).not.toContain("p10-gu-paan-saang-fai");
    expect([1, 2, 3].map((act) => eventsFor(act, "p7").length)).toEqual([10, 8, 8]);
    // P15：锻造事件只进 forgeVersion=1 的 p7 新局；缺省逐位不变（各幕 +4）
    expect([1, 2, 3].map((act) => eventsFor(act, "p7", 1).length)).toEqual([14, 12, 12]);
    expect(skillsFor(1)).toEqual(SKILLS);
    expect(itemsFor()).toBe(ITEMS);
    for (const entries of [ALL_SKILLS, ALL_EVENTS, ALL_ITEMS])
      expect(new Set(entries.map((x) => x.id)).size).toBe(entries.length);
  });

  test("新增技能/事件粤拼逐字可解析，无空文案与跨幕泄漏", () => {
    for (const act of [1, 2, 3]) {
      for (const skill of EXPANSION_SKILLS[act]) {
        expect(lookupSkill(skill.id)).toEqual(skill);
        expect(parseJyutpingTones(skill.jyutping)).toHaveLength([...skill.phrase].length);
        expect(skill.alternatives).toContain(skill.phrase);
        for (const variant of skill.alternatives)
          expect(scorePronunciation(skill.alternatives, variant, 1).score).toBe(100);
        expect(skill.cost).toBeGreaterThan(0);
        if (act > 1) expect(skillsFor(act - 1, "p7").some((s) => s.id === skill.id)).toBe(false);
      }
      for (const event of EXPANSION_EVENTS[act]) {
        expect(parseJyutpingTones(event.lesson.jyutping)).toHaveLength(
          [...event.lesson.phrase].length
        );
        expect(event.choices.length).toBeGreaterThanOrEqual(2);
        expect(new Set(event.choices.map((c) => c.id)).size).toBe(event.choices.length);
        for (const choice of event.choices) expect(choice.hint.length).toBeGreaterThan(4);
      }
    }
  });

  test.each([1, 2, 3])("幕 %i 的新技能、事件、道具可由真实奖励/商店/事件路径抽到", (act) => {
    const rewardIds = new Set<string>();
    const eventIds = new Set<string>();
    const itemIds = new Set<string>();
    for (let seed = 1; seed <= 180; seed++) {
      const engine = battle(act, seed * 7919);
      engine.state.combat!.enemy.hp = 1;
      engine.resolveSkill("ding-ngang-soeng", 100);
      for (const id of engine.state.reward!.choices) rewardIds.add(id);
      engine.chooseReward();
      engine.startShop();
      for (const offer of engine.state.shop!.offers)
        if (offer.type === "item") itemIds.add(offer.id);
      engine.startEvent();
      eventIds.add(engine.state.event!.id);
    }
    for (const skill of EXPANSION_SKILLS[act]) expect(rewardIds.has(skill.id)).toBe(true);
    for (const event of EXPANSION_EVENTS[act]) expect(eventIds.has(event.id)).toBe(true);
    expect(itemIds.size).toBe(8);
  });

  test.each(Object.values(EXPANSION_SKILLS).flat())(
    "技能 $name 的战斗效果符合类型/数值",
    (skill) => {
      const engine = battle(3);
      const player = engine.state.player!;
      const combat = engine.state.combat!;
      player.hp = 30;
      player.armor = 0;
      player.deck = [skill.id, ...player.deck];
      player.buffs = [{ id: "vulnerable", name: "易伤", value: 2, turns: 1 }];
      combat.hand = [{ id: skill.id, index: 0 }];
      combat.enemy.hp = combat.enemy.maxHp = 999;
      const result = engine.resolveSkill(skill.id, 74)!;
      expect(result.score).toBe(74);
      expect(combat.energy).toBe(3 - skill.cost);
      if (["attack", "weaken", "hybrid"].includes(skill.type))
        expect(result.damage).toBe(skill.power);
      if (skill.type === "multi") expect(result.damage).toBe(skill.power * skill.hits!);
      if (["guard", "cleanse", "tempo", "hybrid"].includes(skill.type))
        expect(result.armor).toBe(skill.power);
      if (skill.type === "heal") {
        expect(result.healing).toBe(skill.power);
        expect(result.armor).toBe(5);
      }
      if (skill.type === "strength") expect(player.strength).toBe(Math.round(skill.power * 1.2));
      if (skill.type === "cleanse") expect(player.buffs).toEqual([]);
      if (skill.type === "weaken") expect(combat.enemy.weakness).toBe(2);
      if (skill.type === "tempo") expect(combat.hand).toHaveLength(3);
    }
  );

  test.each(Object.values(EXPANSION_EVENTS).flat())(
    "事件 $title 每个选项可结算且不重复领奖",
    (event) => {
      for (const choice of event.choices) {
        const engine = battle(3);
        engine.state.phase = "event";
        engine.state.event = { ...event, resolved: false, outcome: "" };
        engine.state.player!.gold = 100;
        engine.state.player!.hp = 30;
        engine.resolveEvent(choice.id);
        expect(engine.state.event.resolved).toBe(true);
        expect(engine.state.event.outcome.length).toBeGreaterThan(0);
        const saved = JSON.stringify(engine.state.player);
        engine.resolveEvent(choice.id);
        expect(JSON.stringify(engine.state.player)).toBe(saved);
        engine.leaveEvent();
        expect(engine.state.phase).toBe("tower");
      }
    }
  );

  test("缺字段旧档读回仍使用基础池，新局跨幕保持 P7", () => {
    const old = new GameEngine();
    old.startCampaign(1, 33);
    const restored = new GameEngine();
    restored.load(JSON.parse(JSON.stringify(old.state)));
    expect(restored.state.ruleset).toBeUndefined();
    expect(restored.state.challenge).toBeUndefined();
    restored.startShop();
    expect(restored.state.shop!.offers.every((o) => !o.id.startsWith("p7-"))).toBe(true);
    const next = battle();
    next.state.phase = "victory";
    next.continueNextAct();
    expect(next.state.campaign!.act).toBe(2);
    expect(next.state.ruleset).toBe("p7");
  });
});
