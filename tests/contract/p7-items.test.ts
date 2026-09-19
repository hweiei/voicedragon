import { describe, expect, test } from "vitest";
import { EXPANSION_ITEMS } from "../../src/core/content/expansion";
import { GameEngine } from "../../src/core/engine";

function battle(itemId: string): GameEngine {
  const e = new GameEngine();
  e.startCampaign(1, 51, "p7");
  e.startCombat();
  e.state.player!.items = [itemId];
  return e;
}

describe("P7 五种战术道具", () => {
  test.each(EXPANSION_ITEMS)("$name 非战斗或锁定中拒绝使用且不消耗", (item) => {
    const e = battle(item.id);
    e.state.phase = "tower";
    e.useItem(0);
    expect(e.state.player!.items).toEqual([item.id]);
    e.state.phase = "battle";
    e.state.combat!.locked = true;
    e.useItem(0);
    expect(e.state.player!.items).toEqual([item.id]);
  });
  test("护甲立即生效，下回合清零；只消耗一次", () => {
    const e = battle("p7-bamboo-shield");
    e.useItem(0);
    expect(e.state.player!.armor).toBe(12);
    expect(e.state.player!.items).toEqual([]);
    e.useItem(0);
    expect(e.state.player!.armor).toBe(12);
    e.endTurn();
    expect(e.state.player!.armor).toBe(0);
  });
  test("净化仅去除两种负面状态并加甲，不抹掉其他 buff", () => {
    const e = battle("p7-salt-rinse");
    e.state.player!.buffs = ["voice-interference", "vulnerable", "custom"].map((id) => ({
      id,
      name: id,
      turns: 1,
      value: 10
    }));
    e.useItem(0);
    expect(e.state.player!.buffs.map((b) => b.id)).toEqual(["custom"]);
    expect(e.state.player!.armor).toBe(4);
  });
  test("补气不超过3；满气/抢拍额外声气时保留；0气也能使用", () => {
    const e = battle("p7-ginger-shot");
    e.useItem(0);
    expect(e.state.player!.items).toHaveLength(1);
    e.state.combat!.energy = 4;
    e.useItem(0);
    expect(e.state.player!.items).toHaveLength(1);
    expect(e.state.combat!.energy).toBe(4);
    e.state.combat!.energy = 0;
    e.useItem(0);
    expect(e.state.combat!.energy).toBe(1);
    expect(e.state.player!.items).toHaveLength(0);
  });
  test("折扇按手牌数重抽、消耗道具但不消耗声气；同种子可复现", () => {
    const a = battle("p7-fan");
    const b = battle("p7-fan");
    a.state.combat!.handSize = b.state.combat!.handSize = 4;
    a.useItem(0);
    b.useItem(0);
    expect(a.state.combat!.hand).toHaveLength(4);
    expect(a.state.combat!.hand).toEqual(b.state.combat!.hand);
    expect(a.state.rngState).toBe(b.state.rngState);
    expect(a.state.combat!.energy).toBe(3);
  });
  test("响板实际放大攻击25%，两次敌方行动后易伤消退", () => {
    const e = battle("p7-crack-bell");
    e.state.combat!.enemy.hp = e.state.combat!.enemy.maxHp = 999;
    e.state.combat!.enemy.pattern = [{ type: "guard", guard: 1, label: "等待" }];
    e.useItem(0);
    expect(e.resolveSkill("ding-ngang-soeng", 74)!.damage).toBe(10);
    e.endTurn();
    expect(e.state.combat!.enemy.vulnerable).toBe(1);
    e.endTurn();
    expect(e.state.combat!.enemy.vulnerable).toBe(0);
  });
  test("非法道具索引不删除尾部物品", () => {
    const e = battle("p7-bamboo-shield");
    for (const i of [-1, 0.5, 999, Number.NaN]) e.useItem(i);
    expect(e.state.player!.items).toHaveLength(1);
  });
});
