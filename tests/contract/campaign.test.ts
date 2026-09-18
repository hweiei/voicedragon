/**
 * P2 契约：闯关战役端到端（引擎层全程，等价 REDESIGN-PLAN P2 验收「全程通关路径」）。
 * 锁定：战役开局确定性、节点战斗★结算、宝箱/问答节点、前线推进、
 * Boss 顶点通关、败北不掉星、存档与元存档往返。
 * （浏览器层 Playwright E2E 留待 CI 环境；__VOICE_TOWER__.startCampaign 钩子已就位。）
 */

import { beforeEach, describe, expect, test } from "vitest";
import {
  clearSave,
  loadCampaignMeta,
  loadGame,
  saveCampaignMeta,
  saveGame
} from "../../src/adapters/storage";
import { QUIZ_QUESTIONS } from "../../src/core/data";
import { GameEngine } from "../../src/core/engine";
import { availableNodeIds, nodeById, parentIds } from "../../src/core/levelgen";

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
  localStorage.removeItem("voice-tower-campaign-meta-v1");
});

/** 白箱开路：把目标节点的所有父节点标记为已清理，使其进入前线。 */
function makeAvailable(engine: GameEngine, nodeId: string): void {
  const campaign = engine.state.campaign!;
  for (const parent of parentIds(campaign.map, nodeId)) {
    if (!campaign.clearedIds.includes(parent)) campaign.clearedIds.push(parent);
  }
  engine.prepareFloorOptions();
}

/** 以完美发挥一拳结束当前战斗（路由/结算测试不重复伤害数学，那是黄金契约的职责）。 */
function winCombatFlawlessly(engine: GameEngine): void {
  engine.state.combat!.enemy.hp = 3;
  engine.state.combat!.hand = [{ id: "hou-sai-lei", index: 0 }];
  engine.resolveSkill("hou-sai-lei", 100, { transcript: "好犀利", source: "test" });
}

describe("campaign bootstrap", () => {
  test("startCampaign is deterministic: same seed, same map and same opening frontier", () => {
    const first = new GameEngine();
    const second = new GameEngine();
    first.startCampaign(1, 20260918);
    second.startCampaign(1, 20260918);
    expect(first.state.campaign!.map.nodes).toEqual(second.state.campaign!.map.nodes);
    expect(first.state.floorOptions.map((option) => option.id)).toEqual(
      second.state.floorOptions.map((option) => option.id)
    );
    expect(new Set(first.state.floorOptions.map((option) => option.id))).toEqual(
      new Set(first.state.campaign!.map.startIds)
    );
    expect(first.state.phase).toBe("tower");
  });

  test("command validation rejects nodes that are not on the frontier", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 7);
    const campaign = engine.state.campaign!;
    const farNode = campaign.map.nodes.find((node) => !campaign.map.startIds.includes(node.id))!;
    engine.chooseFloorOption(farNode.id);
    expect(engine.state.phase).toBe("tower"); // 未被采纳
    expect(campaign.clearedIds).toHaveLength(0);
  });
});

describe("node resolution and stars", () => {
  test("a flawless battle clears the node with three stars and opens its children", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 99);
    const startId = engine.state.campaign!.map.startIds[0];
    engine.chooseFloorOption(startId);
    expect(engine.state.phase).toBe("battle");
    expect(engine.state.campaign!.currentNodeId).toBe(startId);

    winCombatFlawlessly(engine);
    expect(engine.state.phase).toBe("reward");
    expect(engine.state.campaign!.clearedIds).toContain(startId);
    expect(engine.state.campaign!.stars[startId]).toBe(3);
    expect(engine.state.campaign!.currentNodeId).toBeNull();

    engine.chooseReward();
    expect(engine.state.phase).toBe("tower");
    const frontier = engine.state.floorOptions.map((option) => option.id);
    expect(frontier).toEqual(availableNodeIds(engine.state.campaign!.map, [startId]));
  });

  test("treasure resolves instantly with loot and one star, staying on the map", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 5150);
    const treasure = engine.state.campaign!.map.nodes.find((node) => node.type === "treasure")!;
    makeAvailable(engine, treasure.id);
    const goldBefore = engine.state.player!.gold;

    engine.chooseFloorOption(treasure.id);
    expect(engine.state.phase).toBe("tower");
    expect(engine.state.player!.gold).toBeGreaterThan(goldBefore);
    expect(engine.state.notice).toContain("藏宝箱");
    expect(engine.state.campaign!.stars[treasure.id]).toBe(1);
    expect(engine.state.campaign!.clearedIds).toContain(treasure.id);
  });

  test("quiz awards stars by correct answers (all correct = 3 stars)", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 8080);
    const quizNode = engine.state.campaign!.map.nodes.find((node) => node.type === "quiz")!;
    makeAvailable(engine, quizNode.id);
    engine.chooseFloorOption(quizNode.id);
    expect(engine.state.phase).toBe("quiz");
    expect(engine.state.quiz!.questions).toHaveLength(3);

    while (engine.state.quiz) {
      const quiz = engine.state.quiz;
      const question = quiz.questions[quiz.index];
      engine.answerQuizOption(question.answerIndex);
      expect(quiz.selected).toBe(question.answerIndex);
      engine.advanceQuiz();
    }
    expect(engine.state.phase).toBe("tower");
    expect(engine.state.campaign!.stars[quizNode.id]).toBe(3);
    expect(engine.state.campaign!.clearedIds).toContain(quizNode.id);
  });

  test("rest node is consumed after one visit (STS rule, no infinite healing)", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 2468);
    const restNode = engine.state.campaign!.map.nodes.find((node) => node.type === "rest")!;
    makeAvailable(engine, restNode.id);
    engine.chooseFloorOption(restNode.id);
    expect(engine.state.phase).toBe("rest");
    engine.rest("heal");
    expect(engine.state.phase).toBe("tower");
    expect(engine.state.campaign!.clearedIds).toContain(restNode.id);
    expect(engine.state.campaign!.stars[restNode.id]).toBe(1);
    expect(engine.state.floorOptions.map((option) => option.id)).not.toContain(restNode.id);
  });

  test("event and shop nodes are likewise consumed once resolved", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 1123);
    const map = engine.state.campaign!.map;
    const eventNode = map.nodes.find((node) => node.type === "event")!;
    makeAvailable(engine, eventNode.id);
    engine.chooseFloorOption(eventNode.id);
    engine.resolveEvent(engine.state.event!.choices[0].id);
    engine.leaveEvent();
    expect(engine.state.campaign!.clearedIds).toContain(eventNode.id);

    const shopNode = map.nodes.find((node) => node.type === "shop")!;
    makeAvailable(engine, shopNode.id);
    engine.chooseFloorOption(shopNode.id);
    expect(engine.state.phase).toBe("shop");
    engine.leaveShop();
    expect(engine.state.campaign!.clearedIds).toContain(shopNode.id);
    expect(engine.state.campaign!.stars[shopNode.id]).toBe(1);
  });

  test("boss victory clears the apex and ends the act", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 4242);
    const bossId = engine.state.campaign!.map.bossId;
    makeAvailable(engine, bossId);
    engine.chooseFloorOption(bossId);
    expect(engine.state.phase).toBe("battle");
    expect(engine.state.combat!.kind).toBe("boss");

    winCombatFlawlessly(engine);
    expect(engine.state.phase).toBe("victory");
    expect(engine.state.campaign!.clearedIds).toContain(bossId);
    expect(engine.state.campaign!.stars[bossId]).toBe(3);
  });

  test("defeat keeps banked stars and never clears the attempted node", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 1357);
    const startId = engine.state.campaign!.map.startIds[0];
    engine.chooseFloorOption(startId);
    // 故意惨败：限定敌人重击
    engine.state.combat!.enemy.pattern = [{ type: "attack", amount: 3, label: "重击" }];
    engine.state.combat!.enemy.baseAttack = 50;
    engine.state.player!.hp = 4;
    engine.endTurn();
    expect(engine.state.phase).toBe("defeat");
    expect(engine.state.campaign!.clearedIds).toHaveLength(0);
    expect(engine.state.campaign!.stars[startId] ?? 0).toBe(0);
  });
});

describe("full act playthrough (engine-level acceptance path)", () => {
  test("greedy climb from the frontier reaches victory, banking stars on every node", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 20260918);
    const campaign = engine.state.campaign!;

    for (let step = 0; step < 300 && engine.state.phase !== "victory"; step += 1) {
      if (engine.state.phase === "tower") {
        const frontier = engine.state.floorOptions.map((option) => option.id);
        expect(frontier).toEqual(availableNodeIds(campaign.map, campaign.clearedIds));
        expect(frontier.length).toBeGreaterThan(0);
        // 每次选离中轴最近的前线节点（单调推进）
        const center = (campaign.map.cols - 1) / 2;
        const next = frontier.sort((a, b) => {
          const na = nodeById(campaign.map, a)!;
          const nb = nodeById(campaign.map, b)!;
          return Math.abs(na.col - center) - Math.abs(nb.col - center);
        })[0];
        engine.chooseFloorOption(next);
      } else if (engine.state.phase === "battle") {
        winCombatFlawlessly(engine);
      } else if (engine.state.phase === "reward") {
        engine.chooseReward();
      } else if (engine.state.phase === "event") {
        engine.resolveEvent(engine.state.event!.choices[0].id);
        engine.leaveEvent();
      } else if (engine.state.phase === "rest") {
        engine.rest("heal");
      } else if (engine.state.phase === "shop") {
        engine.leaveShop();
      } else if (engine.state.phase === "quiz") {
        const quiz = engine.state.quiz!;
        engine.answerQuizOption(quiz.questions[quiz.index].answerIndex);
        engine.advanceQuiz();
      } else {
        throw new Error(`playthrough stuck in phase ${engine.state.phase}`);
      }
    }

    expect(engine.state.phase).toBe("victory");
    expect(campaign.clearedIds).toContain(campaign.map.bossId);
    // 战斗/问答完美发挥 3★；服务节点与宝箱按规则 1★参与星
    for (const id of campaign.clearedIds) {
      const node = nodeById(campaign.map, id)!;
      if (
        node.type === "treasure" ||
        node.type === "rest" ||
        node.type === "event" ||
        node.type === "shop"
      ) {
        expect(campaign.stars[id]).toBe(1);
      } else {
        expect(campaign.stars[id]).toBe(3);
      }
    }
  });
});

describe("campaign persistence", () => {
  test("run save round-trips the embedded campaign state", () => {
    const engine = new GameEngine();
    engine.startCampaign(1, 24601);
    const startId = engine.state.campaign!.map.startIds[0];
    engine.chooseFloorOption(startId);
    winCombatFlawlessly(engine);
    engine.chooseReward();

    expect(saveGame(engine.state)).toBe(true);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.campaign!.map.seed).toBe(24601);
    expect(loaded!.state.campaign!.stars[startId]).toBe(3);
    expect(loaded!.state.campaign!.clearedIds).toEqual(engine.state.campaign!.clearedIds);
  });

  test("campaign meta store round-trips star records across runs", () => {
    saveCampaignMeta({
      act: 1,
      mapSeed: 777,
      stars: { r0c1: 3, r1c3: 2 },
      updatedAt: new Date().toISOString()
    });
    const meta = loadCampaignMeta();
    expect(meta).not.toBeNull();
    expect(meta!.mapSeed).toBe(777);
    expect(meta!.stars.r0c1).toBe(3);
    // 重开同种子同幕：注入历史★（组合根模式），刷新只升不降
    const engine = new GameEngine();
    engine.startCampaign(1, 777);
    Object.assign(engine.state.campaign!.stars, meta!.stars);
    expect(engine.state.campaign!.stars.r0c1).toBe(3);
    engine.completeMapNode("r0c1", 1); // 低分重打不覆盖
    expect(engine.state.campaign!.stars.r0c1).toBe(3);
    engine.completeMapNode("r1c3", 3); // 高分刷新
    expect(engine.state.campaign!.stars.r1c3).toBe(3);
  });
});

describe("quiz content integrity", () => {
  test("question bank entries are well-formed", () => {
    const ids = new Set<string>();
    for (const question of QUIZ_QUESTIONS) {
      expect(ids.has(question.id)).toBe(false);
      ids.add(question.id);
      expect(question.options.length).toBe(4);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(question.options.length);
      expect(question.question.length).toBeGreaterThan(8);
      expect(question.explain.length).toBeGreaterThan(4);
    }
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(8);
  });
});
