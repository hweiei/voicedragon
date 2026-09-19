import { describe, expect, test } from "vitest";
import { UPGRADE_POWER, capabilities } from "../../src/core/buildcraft";
import { lookupSkill } from "../../src/core/content";
import { GameEngine } from "../../src/core/engine";
import { parentIds } from "../../src/core/levelgen";

function run(): GameEngine {
  const e = new GameEngine();
  e.startCampaign(1, 314159, "p7", 1);
  return e;
}
function beginCombat(e: GameEngine): void {
  e.startCombat();
  e.state.combat!.enemy.hp = e.state.combat!.enemy.maxHp = 999;
}

describe("P8-A 版本与删牌事务", () => {
  test("删除已升级牌移除其成果；读档后本店限次保持，新获得副本不继承", () => {
    const e = run();
    const p = e.state.player!;
    p.deck.push("ding-ngang-soeng");
    p.upgradedSlots = [1, 5];
    p.gold = 100;
    e.startShop();
    expect(e.removeDeckCard(1, p.deck[1])).toBe(true);
    expect(p.upgradedSlots).toEqual([4]);
    const loaded = new GameEngine();
    loaded.load(JSON.parse(JSON.stringify(e.state)));
    const before = JSON.stringify(loaded.state);
    expect(loaded.removeDeckCard(0, loaded.state.player!.deck[0])).toBe(false);
    expect(JSON.stringify(loaded.state)).toBe(before);
    loaded.state.player!.deck.push("ding-ngang-soeng");
    expect(loaded.getDeckSkill(5)!.power).toBe(8);
    expect(loaded.getDeckSkill(4)!.power).toBe(10);
  });

  test("API默认不开构筑；显式新战役开启；经典和每日不能操作", () => {
    const e = new GameEngine();
    e.startCampaign(1, 42, "p7");
    expect(e.state.buildVersion).toBeUndefined();
    e.state.phase = "rest";
    expect(e.upgradeDeckCard(0, e.state.player!.deck[0])).toBe(false);
    e.startDaily(42, "2026-09-19");
    e.state.phase = "rest";
    expect(e.upgradeDeckCard(0, e.state.player!.deck[0])).toBe(false);
    expect(run().state.buildVersion).toBe(1);
  });
  test("删除精确副本、重映射升级槽、只扣一次钱且不推进RNG", () => {
    const e = run();
    const p = e.state.player!;
    p.deck.push("hou-sai-lei");
    p.upgradedSlots = [0, 3, 5];
    p.gold = 100;
    e.startShop();
    const rng = e.state.rngState;
    const removedId = p.deck[1];
    expect(e.removeDeckCard(1, removedId)).toBe(true);
    expect(p.upgradedSlots).toEqual([0, 2, 4]);
    expect(p.deck).toHaveLength(5);
    expect(p.gold).toBe(75);
    expect(p.removedCards).toBe(1);
    expect(e.state.shop!.removalUsed).toBe(true);
    expect(e.state.rngState).toBe(rng);
    const before = JSON.stringify(e.state);
    expect(e.removeDeckCard(1, p.deck[1])).toBe(false);
    expect(JSON.stringify(e.state)).toBe(before);
  });
  test("价格逐次上升并封顶，新店可用一次", () => {
    const e = run();
    const p = e.state.player!;
    p.deck = Array(13).fill("ding-ngang-soeng");
    p.gold = 1000;
    const prices = [25, 35, 45, 55, 65, 75, 75, 75];
    for (const price of prices) {
      e.startShop();
      const before = p.gold;
      expect(e.removeDeckCard(0, p.deck[0])).toBe(true);
      expect(before - p.gold).toBe(price);
    }
    expect(p.deck).toHaveLength(5);
  });
  test("余额、索引、id、最低牌数、最后输出、错误阶段拒绝且零副作用", () => {
    const e = run();
    const p = e.state.player!;
    p.deck.push("hou-sai-lei");
    e.startShop();
    p.gold = 0;
    const rejects = () => {
      const before = JSON.stringify(e.state);
      for (const [i, id] of [
        [0, p.deck[0]],
        [-1, "wrong"],
        [0.5, p.deck[0]],
        [99, p.deck[0]],
        [0, "wrong"]
      ] as const)
        expect(e.removeDeckCard(i, id)).toBe(false);
      expect(JSON.stringify(e.state)).toBe(before);
    };
    rejects();
    p.gold = 999;
    e.state.phase = "battle";
    rejects();
    e.state.phase = "shop";
    p.deck = ["ding-ngang-soeng", ...Array(5).fill("m-sai-geng")];
    rejects();
    p.deck = Array(5).fill("ding-ngang-soeng");
    rejects();
  });
});

describe("P8-A 单卡升级及真实战斗", () => {
  test("同名副本独立数值，缺失/伪造槽位不能出牌", () => {
    const e = run();
    e.state.phase = "rest";
    const p = e.state.player!;
    expect(p.deck[0]).toBe(p.deck[1]);
    expect(e.upgradeDeckCard(1, p.deck[1])).toBe(true);
    beginCombat(e);
    e.state.combat!.hand = [
      { id: p.deck[0], index: 0 },
      { id: p.deck[1], index: 1 }
    ];
    expect(e.getDeckSkill(0)!.power).toBe(8);
    expect(e.getDeckSkill(1)!.power).toBe(10);
    const before = JSON.stringify(e.state);
    expect(e.resolveSkill(p.deck[0], 74)).toBeNull();
    expect(e.resolveSkill(p.deck[0], 74, {}, 4)).toBeNull();
    expect(e.resolveSkill("hou-sai-lei", 74, {}, 1)).toBeNull();
    expect(JSON.stringify(e.state)).toBe(before);
    expect(e.resolveSkill(p.deck[1], 74, {}, 1)!.damage).toBe(10);
    expect(e.resolveSkill(p.deck[0], 74, {}, 0)!.damage).toBe(8);
  });
  test.each(Object.keys(UPGRADE_POWER))("升级 %s 实际使用强化数值，原id与费用保持", (id) => {
    const e = run();
    const p = e.state.player!;
    const base = lookupSkill(id)!;
    p.deck.push(id);
    const index = p.deck.length - 1;
    e.state.phase = "rest";
    expect(e.upgradeDeckCard(index, id)).toBe(true);
    beginCombat(e);
    p.hp = 20;
    e.state.combat!.hand = [{ id, index }];
    const result = e.resolveSkill(id, 74, {}, index)!;
    const power = UPGRADE_POWER[id];
    expect(result.skillId).toBe(id);
    expect(e.state.combat!.energy).toBe(3 - base.cost);
    if (capabilities(base).includes("damage")) expect(result.damage).toBe(power * (base.hits ?? 1));
    if (["guard", "hybrid", "tempo", "cleanse"].includes(base.type))
      expect(result.armor).toBe(power + (id === "m-sai-geng" ? 2 : 0));
    if (base.type === "strength") expect(p.strength).toBe(Math.round(power * 1.2));
    if (base.type === "heal") expect(result.healing).toBe(power);
    expect(lookupSkill(id)!.name).not.toContain("＋");
  });
  test("真歇脚节点：升级完成即离开、计星、不再回血、不推进RNG", () => {
    const e = run();
    const c = e.state.campaign!;
    const node = c.map.nodes.find((n) => n.type === "rest")!;
    c.clearedIds.push(...parentIds(c.map, node.id));
    e.prepareFloorOptions();
    e.chooseFloorOption(node.id);
    const p = e.state.player!;
    p.hp = 20;
    const rng = e.state.rngState;
    expect(e.upgradeDeckCard(0, p.deck[0])).toBe(true);
    expect(e.state.phase).toBe("tower");
    expect(c.clearedIds).toContain(node.id);
    expect(e.state.rngState).toBe(rng);
    expect(p.hp).toBe(20);
    e.rest("heal");
    expect(p.hp).toBe(20);
  });
  test("升满、未开放、错误阶段或旧弹层id不一致时零副作用", () => {
    const e = run();
    const p = e.state.player!;
    p.deck.push("dim-gwo-luk-ze");
    e.state.phase = "rest";
    e.upgradeDeckCard(0, p.deck[0]);
    e.state.phase = "rest";
    for (const [i, id] of [
      [0, p.deck[0]],
      [5, "dim-gwo-luk-ze"],
      [1, "wrong"],
      [-1, "bad"],
      [Number.NaN, p.deck[0]]
    ] as const) {
      const before = JSON.stringify(e.state);
      expect(e.upgradeDeckCard(i, id)).toBe(false);
      expect(JSON.stringify(e.state)).toBe(before);
    }
    e.state.phase = "shop";
    const before = JSON.stringify(e.state);
    expect(e.upgradeDeckCard(1, p.deck[1])).toBe(false);
    expect(JSON.stringify(e.state)).toBe(before);
  });
  test("JSON读档与跨幕续行保留构筑，奖励追加不传染升级", () => {
    const e = run();
    e.state.phase = "rest";
    e.upgradeDeckCard(1, e.state.player!.deck[1]);
    const loaded = new GameEngine();
    loaded.load(JSON.parse(JSON.stringify(e.state)));
    expect(loaded.getDeckSkill(1)!.power).toBe(10);
    loaded.state.phase = "reward";
    loaded.state.reward = { gold: 0, choices: ["ding-ngang-soeng"], bonus: null };
    loaded.chooseReward("ding-ngang-soeng");
    expect(loaded.getDeckSkill(5)!.power).toBe(8);
    loaded.state.phase = "victory";
    loaded.continueNextAct();
    expect(loaded.state.buildVersion).toBe(1);
    expect(loaded.state.player!.upgradedSlots).toEqual([1]);
    expect(loaded.state.campaign!.act).toBe(2);
  });
});
