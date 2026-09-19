/**
 * P5 契约：三幕内容包 + 引擎接线。
 * 锁定：内容包形状完整（id 唯一 / 粤拼可解析 / 意图合法）、
 * 幕内容隔离（一幕奖励不漏二三幕内容、二幕敌人不出现在一幕）、
 * 跨幕续行 continueNextAct（保留玩家、换图、仅胜利相可用、终幕拒绝）、
 * 吞音固定伤害回归（原版 ×baseAttack 秒杀 bug 的修复守卫）。
 */

import { beforeEach, describe, expect, test } from "vitest";
import { clearSave } from "../../src/adapters/storage";
import {
  ACT_PACKS,
  actContent,
  lookupSkill,
  relicsUpToAct,
  skillsUpToAct
} from "../../src/core/content";
import type { EnemyIntent } from "../../src/core/data";
import { ENEMIES, FLOOR_NAMES, RELICS, SKILLS } from "../../src/core/data";
import { GameEngine } from "../../src/core/engine";
import { parentIds } from "../../src/core/levelgen";
import { parseJyutpingTones } from "../../src/core/tone";

beforeEach(() => {
  clearSave();
});

const INTENT_TYPES = ["attack", "guardAttack", "guard", "debuff", "silence"];

function validIntents(pattern: EnemyIntent[]): boolean {
  return pattern.every((intent) => {
    if (!INTENT_TYPES.includes(intent.type)) return false;
    if (!intent.label) return false;
    if ((intent.type === "attack" || intent.type === "guardAttack") && !(intent.amount! > 0)) {
      return false;
    }
    if (intent.type === "guard" && !(intent.guard! > 0)) return false;
    return true;
  });
}

describe("content pack integrity", () => {
  test("three acts registered with themes and full floor names", () => {
    expect(ACT_PACKS).toHaveLength(3);
    for (const pack of ACT_PACKS) {
      expect(pack.theme.length).toBeGreaterThan(1);
      expect(pack.notice).toContain(`第${["一", "二", "三"][pack.act - 1]}幕`);
      // 新幕楼层名覆盖 15 行；一幕沿用经典 10 名 + 塔门回退（行为不变）
      if (pack.act >= 2) expect(pack.floorNames).toHaveLength(15);
      expect(pack.fallbackName.length).toBeGreaterThan(0);
      expect(pack.enemies).toHaveLength(5);
      expect(pack.elites).toHaveLength(2);
      // 一幕包裹既有 12 张经典技能；新幕各 5 张
      expect(pack.skills).toHaveLength(pack.act === 1 ? 12 : 5);
      expect(pack.relics).toHaveLength(5);
      expect(pack.events.length).toBeGreaterThanOrEqual(4);
    }
  });

  test("all ids unique within and across packs", () => {
    const ids = ACT_PACKS.flatMap((pack) => [
      ...pack.skills.map((s) => `skill:${s.id}`),
      ...pack.enemies.map((e) => `enemy:${e.id}`),
      ...pack.elites.map((e) => `elite:${e.id}`),
      `boss:${pack.boss.id}`,
      ...pack.relics.map((r) => `relic:${r.id}`),
      ...pack.events.map((e) => `event:${e.id}`)
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every skill jyutping parses into cantonese tone digits", () => {
    for (const pack of ACT_PACKS) {
      for (const skill of pack.skills) {
        const tones = parseJyutpingTones(skill.jyutping);
        expect(tones.length).toBeGreaterThan(0);
        expect(tones.every((tone) => tone >= 1 && tone <= 6)).toBe(true);
      }
    }
  });

  test("enemy intents are well-formed", () => {
    for (const pack of ACT_PACKS) {
      for (const blueprint of [...pack.enemies, ...pack.elites, pack.boss]) {
        expect(validIntents(blueprint.pattern)).toBe(true);
        expect(blueprint.hp).toBeGreaterThan(0);
        expect(blueprint.attack).toBeGreaterThan(0);
      }
    }
  });

  test("merged registries resolve every skill/relic id", () => {
    for (const pack of ACT_PACKS) {
      for (const skill of pack.skills) expect(lookupSkill(skill.id)?.id).toBe(skill.id);
      for (const relic of pack.relics)
        expect(relicsUpToAct(pack.act).some((r) => r.id === relic.id)).toBe(true);
    }
  });
});

describe("act-scoped pools (act 1 behavior preserved)", () => {
  test("act 1 pools are exactly the legacy tables", () => {
    expect(skillsUpToAct(1)).toEqual(SKILLS);
    expect(relicsUpToAct(1)).toEqual(RELICS);
    expect(actContent(1).enemies).toEqual(ENEMIES);
    expect(actContent(1).floorNames).toEqual(FLOOR_NAMES);
  });

  test("pools accumulate by act without leaking backwards", () => {
    expect(skillsUpToAct(1).some((s) => s.id === "gaau-dim-saai")).toBe(false);
    expect(skillsUpToAct(2).some((s) => s.id === "gaau-dim-saai")).toBe(true);
    expect(skillsUpToAct(2).some((s) => s.id === "hou-je")).toBe(false);
    expect(skillsUpToAct(3).some((s) => s.id === "hou-je")).toBe(true);
    expect(relicsUpToAct(2).some((r) => r.id === "ferry-lantern")).toBe(true);
    expect(relicsUpToAct(1).some((r) => r.id === "ferry-lantern")).toBe(false);
  });

  test("actContent clamps out-of-range act numbers", () => {
    expect(actContent(0).act).toBe(1);
    expect(actContent(99).act).toBe(3);
  });
});

/** 白箱开路（同 campaign.test 手法）。 */
function makeAvailable(engine: GameEngine, nodeId: string): void {
  const campaign = engine.state.campaign!;
  for (const parent of parentIds(campaign.map, nodeId)) {
    if (!campaign.clearedIds.includes(parent)) campaign.clearedIds.push(parent);
  }
  engine.prepareFloorOptions();
}

/** 以完美发挥秒杀当前战斗。 */
function winCombatFlawlessly(engine: GameEngine): void {
  engine.state.combat!.enemy.hp = 1;
  engine.state.combat!.hand = [{ id: "hou-sai-lei", index: 0 }];
  engine.resolveSkill("hou-sai-lei", 100, { transcript: "好犀利", source: "test" });
}

describe("campaign act wiring", () => {
  test("act 2 spawns act-2 enemies and act-scoped rewards", () => {
    const engine = new GameEngine();
    engine.startCampaign(2, 20260919);
    expect(engine.state.campaign!.act).toBe(2);
    expect(engine.state.notice).toContain("雾海码头");
    expect(engine.getFloorName(3)).toBe("咸鱼市灯");

    const startId = engine.state.campaign!.map.startIds[0];
    engine.chooseFloorOption(startId);
    expect(engine.state.phase).toBe("battle");
    const enemyIds = actContent(2).enemies.map((e) => e.id);
    expect(enemyIds).toContain(engine.state.combat!.enemy.id);

    winCombatFlawlessly(engine);
    const reward = engine.state.reward!;
    const act1Ids = new Set([...skillsUpToAct(1).map((s) => s.id)]);
    const act2Ids = new Set([...skillsUpToAct(2).map((s) => s.id)]);
    for (const choice of reward.choices) {
      expect(act2Ids.has(choice)).toBe(true);
      if (act1Ids.has(choice)) continue;
      expect(act2Ids.size).toBeGreaterThan(act1Ids.size); // 必然包含新增
    }
    // 一幕奖励永远不出现二三幕技能
    const act3Only = skillsUpToAct(3)
      .filter((s) => !act2Ids.has(s.id))
      .map((s) => s.id);
    for (const choice of reward.choices) expect(act3Only).not.toContain(choice);
  });

  test("act 3 events come from the act-3 pool", () => {
    const engine = new GameEngine();
    engine.startCampaign(3, 4321);
    const eventNode = engine.state.campaign!.map.nodes.find((node) => node.type === "event")!;
    makeAvailable(engine, eventNode.id);
    engine.chooseFloorOption(eventNode.id);
    expect(engine.state.phase).toBe("event");
    const act3EventIds = actContent(3).events.map((e) => e.id);
    expect(act3EventIds).toContain(engine.state.event!.id);
    // 事件选项合法且可结算
    engine.resolveEvent(engine.state.event!.choices[0].id);
    expect(engine.state.event!.resolved).toBe(true);
    engine.leaveEvent();
    expect(engine.state.phase).toBe("tower");
  });

  test("act 2 shop prices and relic offers use accumulated pools", () => {
    const engine = new GameEngine();
    engine.startCampaign(2, 777);
    engine.state.player!.gold = 200;
    const shopNode = engine.state.campaign!.map.nodes.find((node) => node.type === "shop")!;
    makeAvailable(engine, shopNode.id);
    engine.chooseFloorOption(shopNode.id);
    expect(engine.state.phase).toBe("shop");
    const pool = new Set(skillsUpToAct(2).map((s) => s.id));
    for (const offer of engine.state.shop!.offers) {
      if (offer.type === "skill") expect(pool.has(offer.id)).toBe(true);
    }
    engine.leaveShop();
  });
});

describe("cross-act continuation (continueNextAct)", () => {
  test("boss victory in act 1 continues into act 2 keeping the runner", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 31415);
    const player = engine.state.player!;
    player.deck.push("dim-gwo-luk-ze");
    player.relics.push("metronome");
    player.hp = 40;

    // 直取 Boss：白箱清空 boss 的全部父节点（campaign 为可变引用，先快照旧图）
    const campaign = engine.state.campaign!;
    const oldMap = structuredClone(campaign.map);
    for (const parent of parentIds(campaign.map, campaign.map.bossId)) {
      if (!campaign.clearedIds.includes(parent)) campaign.clearedIds.push(parent);
    }
    engine.prepareFloorOptions();
    engine.chooseFloorOption(campaign.map.bossId);
    expect(engine.state.combat!.enemy.id).toBe("nine-tone-dragon");
    winCombatFlawlessly(engine);
    expect(engine.state.phase).toBe("victory");

    engine.continueNextAct();
    expect(engine.state.phase).toBe("tower");
    expect(engine.state.campaign!.act).toBe(2);
    expect(engine.state.campaign!.clearedIds).toHaveLength(0);
    expect(engine.state.campaign!.map.nodes).not.toEqual(oldMap.nodes);
    // 玩家状态保留 + 塔间小憩回血
    expect(engine.state.player!.deck).toContain("dim-gwo-luk-ze");
    expect(engine.state.player!.relics).toContain("metronome");
    expect(engine.state.player!.hp).toBeGreaterThan(40);
    expect(engine.state.floorOptions.length).toBeGreaterThan(0);
    expect(engine.state.notice).toContain("第二幕");

    // 二幕敌人来自二幕包
    engine.chooseFloorOption(engine.state.floorOptions[0].id);
    if (engine.state.phase === "battle") {
      const ids = actContent(2).enemies.map((e) => e.id);
      expect(ids).toContain(engine.state.combat!.enemy.id);
    }
  });

  test("continuation is refused outside victory phase and at the final act", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 99);
    engine.continueNextAct(); // tower 相：无效
    expect(engine.state.phase).toBe("tower");
    expect(engine.state.campaign!.act).toBe(1);

    engine.startCampaign(3, 99);
    const campaign = engine.state.campaign!;
    for (const parent of parentIds(campaign.map, campaign.map.bossId)) {
      if (!campaign.clearedIds.includes(parent)) campaign.clearedIds.push(parent);
    }
    engine.prepareFloorOptions();
    engine.chooseFloorOption(campaign.map.bossId);
    winCombatFlawlessly(engine);
    expect(engine.state.phase).toBe("victory");
    engine.continueNextAct(); // 第三幕：无下一幕
    expect(engine.state.campaign!.act).toBe(3);
    expect(engine.state.phase).toBe("victory");
  });

  test("continuation seed is derived deterministically", () => {
    const run = (seed: number): number => {
      const engine = new GameEngine();
      engine.startCampaign(1, seed);
      const campaign = engine.state.campaign!;
      for (const parent of parentIds(campaign.map, campaign.map.bossId)) {
        if (!campaign.clearedIds.includes(parent)) campaign.clearedIds.push(parent);
      }
      engine.prepareFloorOptions();
      engine.chooseFloorOption(campaign.map.bossId);
      winCombatFlawlessly(engine);
      engine.continueNextAct();
      return engine.state.campaign!.map.seed;
    };
    expect(run(555)).toBe(run(555));
    expect(run(555)).not.toBe(run(556));
  });
});

describe("silence intent flat damage (original one-shot bug regression)", () => {
  test("吞音 deals its flat amount, not amount × baseAttack", () => {
    const engine = new GameEngine();
    engine.startNew(7);
    engine.startCombat("battle");
    const combat = engine.state.combat!;
    // 白箱换成带吞音的敌人，并把回合对准吞音意图
    combat.enemy.baseAttack = 20;
    combat.enemy.pattern = [{ type: "silence", amount: 8, label: "吞音" }];
    combat.enemy.hp = 500;
    engine.state.player!.hp = 72;
    engine.state.player!.armor = 0;

    engine.endTurn();
    // 修复前：20 × 8 = 160 → 秒杀；修复后：固定 8 点
    expect(engine.state.player!.hp).toBe(64);
    expect(engine.state.phase).toBe("battle");

    // 意图预览同样按固定伤害展示
    combat.enemy.pattern = [{ type: "silence", amount: 9, label: "吞音" }];
    const preview = engine.getIntentPreview()!;
    expect(preview.detail).toContain("9 伤害");
  });
});
