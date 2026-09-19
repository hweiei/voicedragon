import { describe, expect, test } from "vitest";
import { actContent, codexEnemyList } from "../../src/core/content";
import { BOSS_EVOLUTIONS, EVOLVED_ELITES } from "../../src/core/content/encounters";
import type { EnemyIntent } from "../../src/core/data";
import { GameEngine } from "../../src/core/engine";

function boss(act = 1): GameEngine {
  const e = new GameEngine();
  e.startCampaign(act, 991, "p7", 1, 1);
  e.startCombat("boss");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.combat!.hand = [{ id: "ding-ngang-soeng", index: 0 }];
  return e;
}
function queue(e: GameEngine): void {
  e.state.combat!.enemy.hp = Math.floor(e.state.combat!.enemy.maxHp / 2) + 1;
  e.resolveSkill("ding-ngang-soeng", 74, {}, 0);
}

describe("Boss阶段事务", () => {
  test.each([1, 2, 3])("幕%i跨半血先排队，旧意图结算完才换阶段；第一招无伤害", (act) => {
    const e = boss(act);
    const combat = e.state.combat!;
    const oldPattern = JSON.stringify(combat.enemy.pattern);
    const original = JSON.stringify(BOSS_EVOLUTIONS);
    const oldLabel = e.currentIntent()!.label;
    queue(e);
    expect(combat.bossPhase).toMatchObject({ phase: 1, pending: true });
    expect(e.currentIntent()!.label).toBe(oldLabel);
    expect(JSON.stringify(combat.enemy.pattern)).toBe(oldPattern);
    const predicted = e.getIntentPreview()!.hpLoss!;
    const hp = e.state.player!.hp;
    e.endTurn();
    expect(hp - e.state.player!.hp).toBe(predicted);
    expect(combat.bossPhase).toEqual({ phase: 2, pending: false, startTurn: 2 });
    expect(e.currentIntent()!.type).toBe("charge");
    const hp2 = e.state.player!.hp;
    e.endTurn();
    expect(e.state.player!.hp).toBe(hp2);
    expect(combat.enemy.vulnerable).toBe(1);
    expect(JSON.stringify(BOSS_EVOLUTIONS)).toBe(original);
    expect(JSON.stringify(actContent(act).boss.pattern)).toBe(oldPattern);
  });
  test("多段完整结算后才排队、跨阈值不打断伤害", () => {
    const e = boss();
    const combat = e.state.combat!;
    e.state.player!.deck.push("jat-cai-soeng");
    combat.hand = [{ id: "jat-cai-soeng", index: 5 }];
    combat.enemy.maxHp = 100;
    combat.enemy.hp = 58;
    const events: boolean[] = [];
    e.subscribe((state) => events.push(Boolean(state.combat?.bossPhase?.pending)));
    const result = e.resolveSkill("jat-cai-soeng", 74, {}, 5)!;
    expect(result.damage).toBe(12);
    expect(combat.enemy.hp).toBe(46);
    expect(events).toEqual([true]);
    expect(combat.bossPhase!.phase).toBe(1);
  });
  test("致死攻击直接获胜，不锁血复活，也不切阶段", () => {
    const e = boss();
    e.state.combat!.enemy.hp = 1;
    e.resolveSkill("ding-ngang-soeng", 100, {}, 0);
    expect(e.state.phase).toBe("victory");
    expect(e.state.combat!.enemy.hp).toBe(0);
    expect(e.state.combat!.bossPhase).toMatchObject({ phase: 1, pending: false });
    e.endTurn();
    expect(e.state.phase).toBe("victory");
  });
  test("玩家死于旧意图时不切入第二阶段", () => {
    const e = boss();
    queue(e);
    e.state.player!.hp = 1;
    e.endTurn();
    expect(e.state.phase).toBe("defeat");
    expect(e.state.combat!.bossPhase!.phase).toBe(1);
  });
  test("露隙加伤一轮；阶段只切一次、索引不跟全场回合错位", () => {
    const e = boss(3);
    const combat = e.state.combat!;
    combat.turn = 3;
    const preservedArmor = e.currentIntent()!.guard!;
    expect(preservedArmor).toBeGreaterThan(0);
    queue(e);
    e.endTurn();
    expect(combat.bossPhase!.startTurn).toBe(4);
    expect(e.currentIntent()!.label).toBe("凝声蓄势");
    e.endTurn();
    expect(combat.enemy.vulnerable).toBe(1);
    combat.hand = [{ id: "ding-ngang-soeng", index: 0 }];
    expect(combat.enemy.armor).toBe(preservedArmor); // 阶段切换不抹掉原有护甲
    combat.enemy.armor = 0;
    expect(e.resolveSkill("ding-ngang-soeng", 74, {}, 0)!.damage).toBe(10);
    expect(combat.bossPhase!.pending).toBe(false);
    e.endTurn();
    expect(combat.enemy.vulnerable).toBe(0);
    expect(combat.bossPhase!.startTurn).toBe(4);
  });
  test("pending与二阶段读档原样恢复，同命令流同结果、不额外消费随机", () => {
    const e = boss();
    queue(e);
    const restored = new GameEngine();
    restored.load(JSON.parse(JSON.stringify(e.state)));
    expect(restored.state.combat).toEqual(e.state.combat);
    e.endTurn();
    restored.endTurn();
    expect(restored.state.combat).toEqual(e.state.combat);
    expect(restored.state.rngState).toBe(e.state.rngState);
    const again = new GameEngine();
    again.load(JSON.parse(JSON.stringify(e.state)));
    e.endTurn();
    again.endTurn();
    expect(again.state.combat).toEqual(e.state.combat);
    expect(again.state.player).toEqual(e.state.player);
  });
  test("新版本跨幕保留，旧版Boss不会自动增加阶段", () => {
    const e = boss();
    e.state.phase = "victory";
    e.continueNextAct();
    expect(e.state.encounterVersion).toBe(1);
    e.startCombat("boss");
    expect(e.state.combat!.bossPhase).toMatchObject({ phase: 1, pending: false });
    const old = new GameEngine();
    old.startCampaign(1, 991, "p7", 1);
    old.startCombat("boss");
    old.state.combat!.enemy.hp = 20;
    old.state.combat!.hand = [{ id: "ding-ngang-soeng", index: 0 }];
    old.resolveSkill("ding-ngang-soeng", 74, {}, 0);
    expect(old.state.combat!.bossPhase).toBeUndefined();
    expect(old.getIntentPreview()!.forecast).toBeUndefined();
  });
  test("同种子开Boss及提交阶段不插入RNG抽样", () => {
    const evolved = boss();
    const old = new GameEngine();
    old.startCampaign(1, 991, "p7", 1);
    old.startCombat("boss");
    expect(evolved.state.rngState).toBe(old.state.rngState);
    queue(evolved);
    old.state.player!.hp = 999;
    old.endTurn();
    evolved.endTurn();
    expect(evolved.state.rngState).toBe(old.state.rngState);
  });
});

const INTENTS: EnemyIntent[] = [
  { type: "attack", amount: 0.65, hits: 3, label: "三击" },
  { type: "attack", amount: 0.95, pierce: true, label: "穿甲" },
  { type: "guardAttack", amount: 1.1, guard: 8, label: "攻守" },
  { type: "silence", amount: 8, label: "吞音" },
  { type: "debuff", amount: 2, label: "扰音" },
  { type: "charge", selfVulnerable: 1, label: "蓄势" },
  { type: "guard", guard: 12, selfVulnerable: 1, label: "护湾" }
];
describe("预览与真实扣血矩阵", () => {
  test.each(INTENTS)("$label：护甲/双方状态/龙鳞/致死边界预测一致", (intent) => {
    for (const armor of [0, 5, 20])
      for (const weakness of [0, 2])
        for (const vulnerable of [false, true])
          for (const dragonScale of [false, true])
            for (const hp of [3, 72]) {
              const e = boss();
              const combat = e.state.combat!;
              const player = e.state.player!;
              combat.enemy.pattern = [intent];
              combat.enemy.baseAttack = 13;
              combat.enemy.weakness = weakness;
              player.hp = hp;
              player.armor = armor;
              player.relics = dragonScale ? ["dragon-scale"] : [];
              player.buffs = vulnerable
                ? [{ id: "vulnerable", name: "易伤", value: 1, turns: 1 }]
                : [];
              const preview = e.getIntentPreview()!;
              e.endTurn();
              expect(hp - player.hp).toBe(preview.hpLoss);
              if (hp > player.hp && intent.pierce) expect(preview.detail).toContain("穿甲");
              if (intent.type === "silence")
                expect(player.buffs.find((b) => b.id === "voice-interference")!.value).toBe(10);
              if (intent.guard) expect(combat.enemy.armor).toBe(intent.guard);
            }
  });
});

describe("新精英版本隔离", () => {
  test.each([1, 2, 3])("幕%i新精英能由实际池抽到、旧池不泄漏且图鉴可见", (act) => {
    const seen = new Set<string>();
    for (let n = 1; n <= 120; n++) {
      const e = new GameEngine();
      e.startCampaign(act, n * 7919, "p7", 1, 1);
      e.startCombat("elite");
      seen.add(e.state.combat!.enemy.id);
      const afterPick = e.state.rngState;
      e.startCampaign(act, n * 7919, "p7", 1);
      e.startCombat("elite");
      expect(e.state.combat!.enemy.id.startsWith("p8b-")).toBe(false);
      expect(e.state.rngState).toBe(afterPick); // 扩池仍然只pick一次
    }
    expect(seen.size).toBe(3);
    expect(seen.has(EVOLVED_ELITES[act].id)).toBe(true);
    expect(codexEnemyList().some((e) => e.id === EVOLVED_ELITES[act].id)).toBe(true);
  });
});

test("encounter版本独立于build版本，只允许p7战役；经典/每日/无尽不继承", () => {
  const e = new GameEngine();
  e.startCampaign(1, 19, "p7", undefined, 1);
  e.startCombat("boss");
  expect(e.state.buildVersion).toBeUndefined();
  expect(e.state.combat!.bossPhase?.phase).toBe(1);
  e.startCampaign(1, 19, "legacy", 1, 1);
  e.startCombat("boss");
  expect(e.state.encounterVersion).toBeUndefined();
  expect(e.state.combat!.bossPhase).toBeUndefined();
  e.startCampaign(1, 19, "p7", 1, 1);
  e.startNew(19);
  expect(e.state.encounterVersion).toBeUndefined();
  e.startCampaign(1, 19, "p7", 1, 1);
  e.startDaily(19, "2026-09-19");
  expect(e.state.encounterVersion).toBeUndefined();
  e.startCampaign(1, 19, "p7", 1, 1);
  e.startEndless(19, "p7");
  expect(e.state.encounterVersion).toBeUndefined();
});
