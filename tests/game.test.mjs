import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../js/engine.js";
import { loadGame, saveGame, clearSave } from "../js/storage.js";
import { scorePronunciation } from "../js/voice/scoring.js";

globalThis.localStorage = (() => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key)
  };
})();

test("same seed creates the same first-floor choices", () => {
  const first = new GameEngine();
  const second = new GameEngine();
  first.startNew(20260911);
  second.startNew(20260911);
  assert.deepEqual(first.state.floorOptions, second.state.floorOptions);
  assert.equal(first.state.floor, 0);
  assert.equal(first.state.floorOptions[0].floor, 1);
});

test("pronunciation score rewards exact Cantonese transcript", () => {
  const exact = scorePronunciation(["顶硬上", "頂硬上"], "頂硬上！", 0.9);
  const partial = scorePronunciation(["顶硬上"], "顶上", 0.55);
  const wrong = scorePronunciation(["顶硬上"], "今日饮茶", 0.7);
  assert.ok(exact.score >= 95);
  assert.ok(partial.score > wrong.score);
  assert.ok(wrong.score < 40);
});

test("high-score spoken skill deals damage and consumes energy", () => {
  const engine = new GameEngine();
  engine.startNew(99);
  engine.startCombat("battle");
  engine.state.combat.hand = [{ id: "ding-ngang-soeng", index: 0 }];
  const before = engine.state.combat.enemy.hp;
  const result = engine.resolveSkill("ding-ngang-soeng", 92, {
    transcript: "顶硬上",
    confidence: 92,
    similarity: 100,
    source: "test"
  });
  assert.equal(engine.state.combat.energy, 2);
  assert.ok(result.damage >= 10);
  assert.ok(engine.state.combat.enemy.hp < before);
  assert.equal(result.tier.key, "master");
});

test("enemy turn resets energy and advances the turn", () => {
  const engine = new GameEngine();
  engine.startNew(18);
  engine.startCombat("battle");
  engine.state.combat.energy = 0;
  engine.endTurn();
  assert.equal(engine.state.combat.turn, 2);
  assert.equal(engine.state.combat.energy, 3);
  assert.equal(engine.state.phase, "battle");
});

test("battle victory opens a three-skill reward", () => {
  const engine = new GameEngine();
  engine.startNew(7);
  engine.startCombat("battle");
  engine.state.combat.enemy.hp = 1;
  engine.state.combat.hand = [{ id: "hou-sai-lei", index: 0 }];
  engine.resolveSkill("hou-sai-lei", 100, { transcript: "好犀利" });
  assert.equal(engine.state.phase, "reward");
  assert.equal(engine.state.reward.choices.length, 3);
  assert.equal(new Set(engine.state.reward.choices).size, 3);
});

test("versioned save round-trips the complete run", () => {
  clearSave();
  const engine = new GameEngine();
  engine.startNew(1234);
  engine.state.player.gold = 88;
  assert.equal(saveGame(engine.state), true);
  const loaded = loadGame();
  assert.equal(loaded.version, 2);
  assert.equal(loaded.state.seed, 1234);
  assert.equal(loaded.state.player.gold, 88);
});

test("fifth and tenth floors are fixed encounters", () => {
  const engine = new GameEngine();
  engine.startNew(55);
  engine.state.floor = 4;
  engine.prepareFloorOptions();
  assert.equal(engine.state.floorOptions.length, 1);
  assert.equal(engine.state.floorOptions[0].type, "elite");
  engine.state.floor = 9;
  engine.prepareFloorOptions();
  assert.equal(engine.state.floorOptions.length, 1);
  assert.equal(engine.state.floorOptions[0].type, "boss");
});

test("event resolution applies an outcome and returns to tower", () => {
  const engine = new GameEngine();
  engine.startNew(88);
  engine.state.floor = 2;
  engine.startEvent();
  const choice = engine.state.event.choices[0];
  engine.resolveEvent(choice.id);
  assert.equal(engine.state.event.resolved, true);
  assert.ok(engine.state.event.outcome.length > 0);
  engine.leaveEvent();
  assert.equal(engine.state.phase, "tower");
  assert.ok(engine.state.floorOptions.length > 0);
});

test("voice boosting consumable affects one spoken skill", () => {
  const engine = new GameEngine();
  engine.startNew(101);
  engine.startCombat("battle");
  engine.state.player.items = ["throat-candy"];
  engine.state.combat.hand = [{ id: "hou-sai-lei", index: 0 }];
  engine.useItem(0);
  const result = engine.resolveSkill("hou-sai-lei", 70, { transcript: "好犀利" });
  assert.equal(result.score, 88);
  assert.equal(engine.state.combat.voiceBoost, 0);
  assert.equal(engine.state.player.items.length, 0);
});
