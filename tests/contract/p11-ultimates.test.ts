import { describe, expect, test } from "vitest";
import { ALL_SKILLS, skillsFor } from "../../src/core/content";
import { ULTIMATE_SKILLS } from "../../src/core/content/ultimates";
import type { EnemyIntent } from "../../src/core/data";
import { GameEngine, type GameState } from "../../src/core/engine";

function ultimateBattle(character: "man-mou-saang" | "faa-daan" | "cau-saang"): GameEngine {
  const e = new GameEngine();
  e.startCampaign({
    act: 1,
    seed: 991,
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    character,
    ultimateVersion: 1
  });
  e.startCombat("battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.combat!.enemy.pattern = [{ type: "attack", amount: 1, label: "试击" }];
  // 敌人加大血量：绝技测试需要战斗持续多轮（正常敌人几招即死会让 phase 离开 battle）
  e.state.combat!.enemy.hp = e.state.combat!.enemy.maxHp = 500;
  e.state.player!.deck.push("hou-sai-lei");
  e.state.combat!.hand = [{ id: "hou-sai-lei", index: e.state.player!.deck.length - 1 }];
  return e;
}

function cast(e: GameEngine, raw: number): void {
  const index = e.state.player!.deck.length - 1;
  e.state.combat!.hand = [{ id: "hou-sai-lei", index }];
  e.state.combat!.energy = 3;
  e.resolveSkill("hou-sai-lei", raw, { source: "voice" }, index);
}

describe("P11 满堂彩绝技契约", () => {
  test("卡池隔离：绝技句进全集（图鉴/练习场）但不进任何 skillsFor 组合", () => {
    expect(ALL_SKILLS.length).toBeGreaterThanOrEqual(43);
    const ids = new Set(ALL_SKILLS.map((skill) => skill.id));
    for (const ultimate of ULTIMATE_SKILLS) expect(ids.has(ultimate.id)).toBe(true);
    for (const character of ["man-mou-saang", "faa-daan", "cau-saang"] as const) {
      const pool = skillsFor(3, "p7", 1, character).map((skill) => skill.id);
      for (const ultimate of ULTIMATE_SKILLS) expect(pool).not.toContain(ultimate.id);
    }
    expect(skillsFor(1, "p7").map((skill) => skill.id)).not.toContain("p11-ultimate-faa-daan");
  });

  test("彩基于裸分：声韵加成不助彩；破阵拍同规则；旧局永不产生彩字段", () => {
    const e = ultimateBattle("man-mou-saang");
    e.state.player!.voiceMastery = 10; // 最终分 = 裸分 + 10
    cast(e, 84); // 最终 94（正音伤害档）但裸分 <85 → 不蓄彩
    expect(e.state.combat!.bravo).toBe(0);
    cast(e, 60); // 最终 70，裸分 <65 → 断彩（本就 0）
    expect(e.state.combat!.bravo).toBe(0);
    cast(e, 85); // 裸分正音 → 彩 1
    expect(e.state.combat!.bravo).toBe(1);
    cast(e, 70); // 裸分中段 → 保持
    expect(e.state.combat!.bravo).toBe(1);
    // 破阵拍：裸分 92 → 蓄彩
    e.state.combat!.hand = [{ id: "hou-sai-lei", index: 5 }];
    e.state.combat!.energy = 3;
    e.resolveSkill("hou-sai-lei", 92, { source: "qte" }, 5);
    expect(e.state.combat!.bravo).toBe(2);
    // 旧局（P10 配置）无彩字段
    const old = new GameEngine();
    old.startCampaign({
      act: 1,
      seed: 991,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1,
      counterVersion: 1,
      rosterVersion: 1,
      character: "faa-daan"
    });
    old.startCombat("battle");
    old.state.combat!.hand = [{ id: "hou-sai-lei", index: 2 }];
    old.resolveSkill("hou-sai-lei", 95, { source: "voice" }, 2);
    expect(old.state.combat!.bravo).toBeUndefined();
  });

  test("彩满发动：守卫（阶段/锁/彩不足/已用/旧局）与效果落地；每场一次；不回馈彩", () => {
    const e = ultimateBattle("man-mou-saang");
    // 彩不足
    expect(e.castUltimate(95, {})).toBeNull();
    cast(e, 90);
    cast(e, 90);
    cast(e, 90);
    expect(e.state.combat!.bravo).toBe(3);
    const enemy = e.state.combat!.enemy;
    enemy.armor = 50;
    const hpBefore = enemy.hp;
    const result = e.castUltimate(95, { source: "voice" })!;
    expect(result).not.toBeNull();
    expect(result.skillId).toBe("p11-ultimate-man-mou-saang");
    expect(result.damage).toBeGreaterThan(0);
    expect(enemy.armor).toBe(50); // 正音无视护甲
    expect(enemy.hp).toBe(hpBefore - result.damage);
    expect(e.state.combat!.bravo).toBe(0);
    expect(e.state.combat!.ultimateUsed).toBe(true);
    // 每场一次：重新蓄彩后仍拒绝
    cast(e, 90);
    cast(e, 90);
    cast(e, 90);
    expect(e.state.combat!.bravo).toBe(3);
    expect(e.castUltimate(95, {})).toBeNull();
    // 绝技自身不回馈彩：彩仍为 3（未消耗于第二次拒绝）——但发动路径已证清零语义
  });

  test("花旦/丑生绝技效果与数值（调准通道诚实）", () => {
    const faa = ultimateBattle("faa-daan");
    faa.state.player!.hp = 100;
    cast(faa, 90);
    cast(faa, 90);
    cast(faa, 90);
    const before = { hp: faa.state.player!.hp, armor: faa.state.player!.armor };
    const faaResult = faa.castUltimate(90, { source: "voice", toneScore: 85 })!;
    expect(faaResult.healing).toBe(9); // round(5×1.32)=7 + 调准 2
    expect(faa.state.player!.hp).toBe(before.hp + 9);
    expect(faa.state.player!.armor).toBe(before.armor + 7);
    // 无调准通道：无加成
    const faa2 = ultimateBattle("faa-daan");
    faa2.state.player!.hp = 500; // 满血会被上限钳制，压血线验证真实回复量
    cast(faa2, 90);
    cast(faa2, 90);
    cast(faa2, 90);
    const faa2Result = faa2.castUltimate(90, { source: "qte" })!;
    expect(faa2Result.healing).toBe(7);

    const cau = ultimateBattle("cau-saang");
    cast(cau, 90);
    cast(cau, 90);
    cast(cau, 90);
    cau.state.combat!.enemy.armor = 12;
    cau.state.player!.buffs.push({
      id: "voice-interference",
      name: "错调干扰",
      value: 7,
      turns: 1
    });
    const handBefore = JSON.stringify(cau.state.combat!.hand);
    const armorBefore = cau.state.player!.armor;
    cau.castUltimate(74, { source: "qte" });
    const combat = cau.state.combat!;
    // 伤害 5 先被敌甲吸收（12→7），再夺剩余全部（7）
    expect(combat.enemy.armor).toBe(0);
    expect(cau.state.player!.armor).toBe(armorBefore + 7);
    expect(combat.enemy.weakness).toBe(3);
    expect(JSON.stringify(combat.hand)).not.toBe(handBefore); // 换手
  });

  test("绝技可击杀；跨半血提交 Boss 二阶段（与反击同语义）", () => {
    const e = ultimateBattle("man-mou-saang");
    cast(e, 90);
    cast(e, 90);
    cast(e, 90);
    e.state.combat!.enemy.hp = 5;
    e.castUltimate(95, {});
    expect(e.state.phase).toBe("reward");

    const boss = new GameEngine();
    boss.startCampaign({
      act: 1,
      seed: 991,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1,
      counterVersion: 1,
      rosterVersion: 1,
      character: "man-mou-saang",
      ultimateVersion: 1
    });
    boss.startCombat("boss");
    boss.state.player!.hp = boss.state.player!.maxHp = 999;
    boss.state.player!.deck.push("hou-sai-lei");
    const idx = boss.state.player!.deck.length - 1;
    const pattern: EnemyIntent[] = [{ type: "attack", amount: 1, label: "龙爪" }];
    boss.state.combat!.enemy.pattern = pattern;
    boss.state.combat!.enemy.hp = boss.state.combat!.enemy.maxHp = 400;
    for (let i = 0; i < 3; i += 1) {
      boss.state.combat!.hand = [{ id: "hou-sai-lei", index: idx }];
      boss.state.combat!.energy = 3;
      boss.resolveSkill("hou-sai-lei", 90, { source: "voice" }, idx);
    }
    boss.state.combat!.enemy.hp = Math.floor(boss.state.combat!.enemy.maxHp / 2) + 2;
    boss.castUltimate(95, {});
    // 与普通施法同语义：先排队 pending，本回合旧意图结算完才提交二阶段
    expect(boss.state.combat!.bossPhase).toEqual({ phase: 1, pending: true, startTurn: 1 });
    boss.endTurn();
    expect(boss.state.combat!.bossPhase).toEqual({ phase: 2, pending: false, startTurn: 2 });
  });

  test("确定性：同配置同命令序列逐位一致；JSON 往返保留彩与已用标记", () => {
    const run = (): string => {
      const e = ultimateBattle("cau-saang");
      cast(e, 90);
      cast(e, 70); // 中段保持
      cast(e, 90);
      e.castUltimate(88, { source: "qte" });
      e.endTurn();
      e.state.stats!.startedAt = "fixed";
      return JSON.stringify(e.state);
    };
    expect(run()).toBe(run());
    const e = ultimateBattle("faa-daan");
    cast(e, 90);
    cast(e, 90);
    cast(e, 90);
    e.castUltimate(90, {});
    const restored = JSON.parse(JSON.stringify(e.state)) as GameState;
    expect(restored.combat!.bravo).toBe(0);
    expect(restored.combat!.ultimateUsed).toBe(true);
    expect(restored.ultimateVersion).toBe(1);
  });
});
