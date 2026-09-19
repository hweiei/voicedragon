/**
 * P5 新遗物机制单元测试：十个钩子逐一锁定（第二幕 5 件 + 第三幕 5 件）。
 * 手法沿用契约测试：白箱布场 + 固定分数施法，只断言遗物增量。
 */

import { beforeEach, describe, expect, test } from "vitest";
import { clearSave } from "../../src/adapters/storage";
import { GameEngine } from "../../src/core/engine";

beforeEach(() => {
  clearSave();
});

/** 开一场战斗并装上指定遗物。 */
function setup(engine: GameEngine, relicId: string): void {
  engine.startNew(11);
  engine.state.floor = 1;
  engine.startCombat("battle");
  engine.state.player!.relics.push(relicId);
}

function giveHand(engine: GameEngine, skillId: string): void {
  engine.state.combat!.hand = [{ id: skillId, index: 0 }];
}

describe("act 2 relics", () => {
  test("ferry-lantern: 4 armor at combat start", () => {
    const engine = new GameEngine();
    setup(engine, "ferry-lantern");
    expect(engine.state.player!.armor).toBe(0); // 装遗物在 startCombat 之后
    const second = new GameEngine();
    second.startNew(11);
    second.state.floor = 1;
    second.state.player!.relics.push("ferry-lantern");
    second.startCombat("battle");
    expect(second.state.player!.armor).toBe(4);
  });

  test("harbor-bell: +2 armor on first cast each turn only", () => {
    const engine = new GameEngine();
    setup(engine, "harbor-bell");
    giveHand(engine, "hou-sai-lei");
    engine.state.combat!.energy = 10;
    engine.resolveSkill("hou-sai-lei", 70, { source: "test" });
    expect(engine.state.player!.armor).toBeGreaterThanOrEqual(2);
    const armorAfterFirst = engine.state.player!.armor;
    engine.state.combat!.enemy.hp = 500;
    engine.resolveSkill("hou-sai-lei", 70, { source: "test" }); // 同回合第二次：不再触发
    expect(engine.state.player!.armor).toBe(armorAfterFirst);
    engine.endTurn(); // 敌方回合后标记重置
    giveHand(engine, "hou-sai-lei");
    engine.state.combat!.energy = 10;
    engine.resolveSkill("hou-sai-lei", 70, { source: "test" });
    expect(engine.state.player!.armor).toBeGreaterThanOrEqual(2);
  });

  test("salty-lemon: heals 2 on score ≥70, once per turn", () => {
    const engine = new GameEngine();
    setup(engine, "salty-lemon");
    engine.state.player!.hp = 50;
    giveHand(engine, "hou-sai-lei");
    engine.state.combat!.energy = 10;
    engine.state.combat!.enemy.hp = 500;
    engine.resolveSkill("hou-sai-lei", 74, { source: "test" });
    expect(engine.state.player!.hp).toBe(52);
    engine.resolveSkill("hou-sai-lei", 74, { source: "test" }); // 每回合一次
    expect(engine.state.player!.hp).toBe(52);
    engine.state.combat!.enemy.pattern = [{ type: "guard", guard: 5, label: "蓄势" }]; // 敌方不攻击
    engine.endTurn();
    giveHand(engine, "hou-sai-lei");
    engine.state.combat!.energy = 10;
    engine.resolveSkill("hou-sai-lei", 60, { source: "test" }); // 分数不足
    expect(engine.state.player!.hp).toBe(52);
  });

  test("old-compass: +1 energy on turn 1 only", () => {
    const engine = new GameEngine();
    engine.startNew(11);
    engine.state.floor = 1;
    engine.state.player!.relics.push("old-compass"); // 开场结算前装备
    engine.startCombat("battle");
    expect(engine.state.combat!.energy).toBe(4);
    engine.state.combat!.energy = 0;
    engine.endTurn();
    expect(engine.state.combat!.energy).toBe(3);
  });

  test("night-market-vip: shop prices -15%", () => {
    const engine = new GameEngine();
    engine.startNew(11);
    engine.state.player!.relics.push("night-market-vip");
    engine.startShop();
    const prices = engine.state.shop!.offers.map((offer) => offer.price);
    expect(prices).toContain(19); // 22 × 0.85 ≈ 18.7 → 19
    expect(prices).toContain(15); // 18 × 0.85 ≈ 15.3 → 15
    expect(prices).not.toContain(22);
  });
});

describe("act 3 relics", () => {
  test("dragon-scale: 3 armor when hit without armor", () => {
    const engine = new GameEngine();
    setup(engine, "dragon-scale");
    engine.state.player!.hp = 72;
    engine.state.player!.armor = 0;
    const hit = engine.applyEnemyHit(10);
    // 触发鳞甲 3 点：实伤 7、格挡 3
    expect(hit).toEqual({ actual: 7, blocked: 3 });
    // 已有护甲时不再触发
    engine.state.player!.armor = 5;
    expect(engine.applyEnemyHit(10)).toEqual({ actual: 5, blocked: 5 });
  });

  test("thunder-drum: strength gain +50%", () => {
    const engine = new GameEngine();
    setup(engine, "thunder-drum");
    giveHand(engine, "gaa-jau"); // 声势 +2 基础
    engine.resolveSkill("gaa-jau", 70, { source: "test" });
    // 74 分（清晰档）：amount = round(2 × (0.7 + 1/2)) = round(2.4) = 2 → ×1.5 = 3
    expect(engine.state.player!.strength).toBeGreaterThanOrEqual(3);
  });

  test("jade-flute: hand size 4 at start and after endTurn", () => {
    const engine = new GameEngine();
    engine.startNew(11);
    engine.state.floor = 1;
    engine.state.player!.relics.push("jade-flute");
    engine.startCombat("battle");
    expect(engine.state.combat!.hand).toHaveLength(4);
    engine.state.combat!.energy = 3;
    engine.endTurn();
    expect(engine.state.combat!.hand).toHaveLength(4);
  });

  test("cloud-herb: heal 5 after combat victory", () => {
    const engine = new GameEngine();
    setup(engine, "cloud-herb");
    engine.state.player!.hp = 40;
    engine.state.combat!.enemy.hp = 1;
    giveHand(engine, "hou-sai-lei");
    engine.resolveSkill("hou-sai-lei", 100, { source: "test" });
    expect(engine.state.phase).toBe("reward");
    expect(engine.state.player!.hp).toBe(45);
  });

  test("nine-tone-pearl: master cast boosts the next judgment by 6", () => {
    const engine = new GameEngine();
    setup(engine, "nine-tone-pearl");
    giveHand(engine, "hou-sai-lei");
    engine.state.combat!.energy = 10;
    engine.state.combat!.enemy.hp = 500;
    engine.resolveSkill("hou-sai-lei", 85, { source: "test" });
    expect(engine.state.combat!.voiceBoost).toBe(6);
    const result = engine.resolveSkill("hou-sai-lei", 80, { source: "test" });
    expect(result!.score).toBe(86); // 80 + 6，且骊珠不再持有加成
    expect(engine.state.combat!.voiceBoost).toBe(6); // 86 ≥ 85 再次点亮
  });
});
