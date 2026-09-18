/**
 * 契约守护测试（Golden Master）：与原版 tests/game.test.mjs 语义一一对应。
 * 任何对内核的重构都必须保证这 9 个用例通过——它们锁定了：
 * 种子可复现性、发音评分、战斗结算、固定楼层、事件、存档兼容（v2）。
 */

import { beforeEach, describe, expect, test } from "vitest";
import { clearSave, loadGame, saveGame } from "../../src/adapters/storage";
import { GameEngine } from "../../src/core/engine";
import { scorePronunciation } from "../../src/core/scoring";

(globalThis as unknown as { localStorage: unknown }).localStorage = (() => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear()
  };
})();

beforeEach(() => {
  clearSave();
});

describe("deterministic routing", () => {
  test("same seed creates the same first-floor choices", () => {
    const first = new GameEngine();
    const second = new GameEngine();
    first.startNew(20260911);
    second.startNew(20260911);
    expect(first.state.floorOptions).toEqual(second.state.floorOptions);
    expect(first.state.floor).toBe(0);
    expect(first.state.floorOptions[0].floor).toBe(1);
  });
});

describe("pronunciation scoring", () => {
  test("pronunciation score rewards exact Cantonese transcript", () => {
    const exact = scorePronunciation(["顶硬上", "頂硬上"], "頂硬上！", 0.9);
    const partial = scorePronunciation(["顶硬上"], "顶上", 0.55);
    const wrong = scorePronunciation(["顶硬上"], "今日饮茶", 0.7);
    expect(exact.score).toBeGreaterThanOrEqual(95);
    expect(partial.score).toBeGreaterThan(wrong.score);
    expect(wrong.score).toBeLessThan(40);
  });
});

describe("combat", () => {
  test("high-score spoken skill deals damage and consumes energy", () => {
    const engine = new GameEngine();
    engine.startNew(99);
    engine.startCombat("battle");
    engine.state.combat!.hand = [{ id: "ding-ngang-soeng", index: 0 }];
    const before = engine.state.combat!.enemy.hp;
    const result = engine.resolveSkill("ding-ngang-soeng", 92, {
      transcript: "顶硬上",
      confidence: 92,
      similarity: 100,
      source: "test"
    })!;
    expect(engine.state.combat!.energy).toBe(2);
    expect(result.damage).toBeGreaterThanOrEqual(10);
    expect(engine.state.combat!.enemy.hp).toBeLessThan(before);
    expect(result.tier.key).toBe("master");
  });

  test("enemy turn resets energy and advances the turn", () => {
    const engine = new GameEngine();
    engine.startNew(18);
    engine.startCombat("battle");
    engine.state.combat!.energy = 0;
    engine.endTurn();
    expect(engine.state.combat!.turn).toBe(2);
    expect(engine.state.combat!.energy).toBe(3);
    expect(engine.state.phase).toBe("battle");
  });

  test("battle victory opens a three-skill reward", () => {
    const engine = new GameEngine();
    engine.startNew(7);
    engine.startCombat("battle");
    engine.state.combat!.enemy.hp = 1;
    engine.state.combat!.hand = [{ id: "hou-sai-lei", index: 0 }];
    engine.resolveSkill("hou-sai-lei", 100, { transcript: "好犀利" });
    expect(engine.state.phase).toBe("reward");
    expect(engine.state.reward!.choices.length).toBe(3);
    expect(new Set(engine.state.reward!.choices).size).toBe(3);
  });

  test("fifth and tenth floors are fixed encounters", () => {
    const engine = new GameEngine();
    engine.startNew(55);
    engine.state.floor = 4;
    engine.prepareFloorOptions();
    expect(engine.state.floorOptions.length).toBe(1);
    expect(engine.state.floorOptions[0].type).toBe("elite");
    engine.state.floor = 9;
    engine.prepareFloorOptions();
    expect(engine.state.floorOptions.length).toBe(1);
    expect(engine.state.floorOptions[0].type).toBe("boss");
  });

  test("voice boosting consumable affects one spoken skill", () => {
    const engine = new GameEngine();
    engine.startNew(101);
    engine.startCombat("battle");
    engine.state.player!.items = ["throat-candy"];
    engine.state.combat!.hand = [{ id: "hou-sai-lei", index: 0 }];
    engine.useItem(0);
    const result = engine.resolveSkill("hou-sai-lei", 70, { transcript: "好犀利" })!;
    expect(result.score).toBe(88);
    expect(engine.state.combat!.voiceBoost).toBe(0);
    expect(engine.state.player!.items.length).toBe(0);
  });
});

describe("events", () => {
  test("event resolution applies an outcome and returns to tower", () => {
    const engine = new GameEngine();
    engine.startNew(88);
    engine.state.floor = 2;
    engine.startEvent();
    const choice = engine.state.event!.choices[0];
    engine.resolveEvent(choice.id);
    expect(engine.state.event!.resolved).toBe(true);
    expect(engine.state.event!.outcome.length).toBeGreaterThan(0);
    engine.leaveEvent();
    expect(engine.state.phase).toBe("tower");
    expect(engine.state.floorOptions.length).toBeGreaterThan(0);
  });
});

describe("save migration compatibility", () => {
  test("versioned save round-trips the complete run", () => {
    const engine = new GameEngine();
    engine.startNew(1234);
    engine.state.player!.gold = 88;
    expect(saveGame(engine.state)).toBe(true);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(2);
    expect(loaded!.state.seed).toBe(1234);
    expect(loaded!.state.player!.gold).toBe(88);
  });
});
