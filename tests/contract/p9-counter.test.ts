import { describe, expect, test } from "vitest";
import { ALL_SKILLS, skillsFor } from "../../src/core/content";
import { counterEnabled, resolveCounterDamage } from "../../src/core/counter";
import { type EnemyIntent, SKILLS } from "../../src/core/data";
import { GameEngine, type GameState } from "../../src/core/engine";

const COUNTER_ID = "p9-waan-faan-bei-nei";

/** 反击战役 + 受控敌意（单段普通攻击），手牌注入反击卡（构筑版规则要求槽位对应）。 */
function counterBattle(pattern: EnemyIntent[], kind = "battle"): GameEngine {
  const e = new GameEngine();
  e.startCampaign(1, 991, "p7", 1, 1, 1);
  e.startCombat(kind as "battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.player!.deck.push(COUNTER_ID);
  const index = e.state.player!.deck.length - 1;
  e.state.combat!.hand = [{ id: COUNTER_ID, index }];
  e.state.combat!.enemy.pattern = pattern;
  return e;
}

function castCounter(e: GameEngine): void {
  const index = e.state.player!.deck.length - 1;
  e.resolveSkill(COUNTER_ID, 74, {}, index);
}

describe("P9 守势反击契约", () => {
  test("卡池隔离：反击卡只在 counterVersion 战役可获取；全集其余技能无 counter 字段", () => {
    expect(skillsFor(1, "p7", 1).map((s) => s.id)).toContain(COUNTER_ID);
    expect(skillsFor(1, "p7").map((s) => s.id)).not.toContain(COUNTER_ID);
    expect(skillsFor(1)).toEqual(SKILLS);
    expect(skillsFor(1).map((s) => s.id)).not.toContain(COUNTER_ID);
    for (const skill of ALL_SKILLS) {
      if (skill.id !== COUNTER_ID) expect(skill.counter).toBeUndefined();
    }
    expect(ALL_SKILLS.find((s) => s.id === COUNTER_ID)!.counter).toEqual({ ratio: 50 });
  });

  test("版本门控：第 6 参数仅在 p7 落位；旧战役状态无 counterVersion、旧局永不产生姿态", () => {
    const e = new GameEngine();
    e.startCampaign(1, 7, "p7", 1, 1);
    expect(e.state.counterVersion).toBeUndefined();
    expect(counterEnabled(e.state)).toBe(false);
    e.startCampaign(1, 7, "legacy", undefined, undefined, 1);
    expect(e.state.counterVersion).toBeUndefined();
    e.startCampaign(1, 7, "p7", 1, 1, 1);
    expect(e.state.counterVersion).toBe(1);
    // 旧局（P8-B）施放护甲技能不会摆姿态
    const old = new GameEngine();
    old.startCampaign(1, 7, "p7", 1, 1);
    old.startCombat("battle");
    old.state.player!.hp = old.state.player!.maxHp = 999;
    old.state.combat!.hand = [{ id: "m-sai-geng", index: 2 }];
    old.resolveSkill("m-sai-geng", 74, {}, 2);
    expect(old.state.combat!.counter).toBeUndefined();
  });

  test("施展反击卡获得护甲并摆出姿态；敌方攻击被挡后按预测值还击、姿态消耗", () => {
    const e = counterBattle([{ type: "attack", amount: 1, label: "试击" }]);
    castCounter(e);
    const combat = e.state.combat!;
    expect(combat.counter).toEqual({ ratio: 50 });
    expect(e.state.player!.armor).toBe(7); // 74 分＝清晰档 ×1.0
    const predicted = e.getIntentPreview()!.counter!;
    expect(predicted).toBeGreaterThan(0);
    const hpBefore = combat.enemy.hp;
    e.endTurn();
    expect(combat.enemy.hp).toBe(hpBefore - predicted);
    expect(combat.counter).toBeUndefined();
    expect(combat.log.some((line) => line.includes("反击姿态生效"))).toBe(true);
    // 预测与实际共用 resolveCounterDamage：被挡 = min(护甲, 敌方单段伤害)
    const blocked = Math.min(7, combat.enemy.baseAttack);
    expect(predicted).toBe(
      resolveCounterDamage({ blocked, ratio: 50, enemyArmor: 0, enemyVulnerable: false }).damage
    );
  });

  test("穿甲不触发也不消耗姿态；纯护甲回合姿态保持", () => {
    const e = counterBattle([{ type: "attack", amount: 1, pierce: true, label: "穿心" }]);
    castCounter(e);
    expect(e.getIntentPreview()!.counter).toBeUndefined();
    const hp = e.state.combat!.enemy.hp;
    e.endTurn();
    expect(e.state.combat!.enemy.hp).toBe(hp); // 穿甲段 blocked=0，无还击
    expect(e.state.combat!.counter).toEqual({ ratio: 50 }); // 姿态保留
    e.state.combat!.enemy.pattern = [{ type: "guard", guard: 4, label: "扎马" }];
    e.endTurn();
    expect(e.state.combat!.counter).toEqual({ ratio: 50 }); // 无伤害回合不消耗
  });

  test("guardAttack 先得甲再吃还击：还击被敌方护甲吸收", () => {
    const e = counterBattle([{ type: "guardAttack", amount: 1, guard: 20, label: "压阵" }]);
    castCounter(e);
    const blocked = Math.min(7, e.state.combat!.enemy.baseAttack);
    const expected = resolveCounterDamage({
      blocked,
      ratio: 50,
      enemyArmor: 20,
      enemyVulnerable: false
    });
    const hp = e.state.combat!.enemy.hp;
    e.endTurn();
    const combat = e.state.combat!;
    expect(combat.enemy.hp).toBe(hp - expected.damage);
    expect(combat.enemy.armor).toBe(expected.armorAfter);
    expect(combat.counter).toBeUndefined();
  });

  test("还击可于敌方回合内直接击杀", () => {
    const e = counterBattle([{ type: "attack", amount: 1, label: "试击" }]);
    castCounter(e);
    e.state.combat!.enemy.hp = 1;
    e.endTurn();
    expect(e.state.combat!.enemy.hp).toBe(0);
    expect(e.state.phase).toBe("reward");
  });

  test("还击把 Boss 打到半血：本回合行动结束即提交二阶段", () => {
    const e = counterBattle([{ type: "attack", amount: 1, label: "龙爪" }], "boss");
    castCounter(e);
    const combat = e.state.combat!;
    // 半血之上 2 点：还击至少 1 点必跨阈值
    combat.enemy.hp = Math.floor(combat.enemy.maxHp / 2) + 2;
    e.endTurn();
    expect(combat.bossPhase).toEqual({ phase: 2, pending: false, startTurn: 2 });
    expect(e.currentIntent()!.type).toBe("charge"); // 二阶段以蓄势开场
  });

  test("姿态随存档 JSON 往返；旧档无 counterVersion 永不结算还击", () => {
    const e = counterBattle([{ type: "attack", amount: 1, label: "试击" }]);
    castCounter(e);
    const restored = JSON.parse(JSON.stringify(e.state)) as GameState;
    expect(restored.combat!.counter).toEqual({ ratio: 50 });
    expect(counterEnabled(restored)).toBe(true);
    const legacyFull = JSON.parse(JSON.stringify(e.state)) as GameState;
    const { counterVersion: _cv, ...legacy } = legacyFull;
    expect(counterEnabled(legacy)).toBe(false);
  });

  test("确定性：同 (act, seed) 同操作序列状态逐位一致", () => {
    const run = (): string => {
      const e = counterBattle([
        { type: "attack", amount: 1, label: "试击" },
        { type: "attack", amount: 0.8, hits: 2, label: "连击" },
        { type: "guard", guard: 5, label: "扎马" }
      ]);
      castCounter(e);
      e.endTurn();
      castCounter(e); // 再次摆姿态（能量回满）
      e.endTurn();
      e.endTurn();
      e.state.stats!.startedAt = "fixed"; // 时间戳不参与确定性比较
      return JSON.stringify(e.state);
    };
    expect(run()).toBe(run());
  });
});
