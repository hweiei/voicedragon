import { describe, expect, test } from "vitest";
import { GameEngine } from "../../src/core/engine";
import {
  MUTATORS,
  mutationEffects,
  mutationList,
  mutationStage,
  selectMutators
} from "../../src/core/mutators";

function daily(ids?: string[]): GameEngine {
  const e = new GameEngine();
  e.startDaily(1001, "2026-09-19");
  if (ids) e.state.challenge!.mutatorIds = ids;
  e.startCombat();
  return e;
}

describe("P7 词缀纯函数与版本", () => {
  test("12个唯一词缀；选择器稳定且每组一利一弊", () => {
    expect(MUTATORS).toHaveLength(12);
    const all = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const ids = selectMutators(seed, 3);
      expect(ids).toEqual(selectMutators(seed, 3));
      expect(mutationList(ids).map((m) => m.kind)).toEqual(["pressure", "boon"]);
      for (const id of ids) all.add(id);
    }
    expect(all.size).toBe(12);
    expect(mutationEffects(["ironcoat", "ironcoat", "unknown"]).enemyArmor).toBe(6);
  });
  test("无尽每5层换组，每日跨层保持不变；准备路线不额外消耗词缀随机", () => {
    expect([0, 1, 5, 6, 10, 11].map((f) => mutationStage("endless", f))).toEqual([
      0, 0, 0, 1, 1, 2
    ]);
    expect(mutationStage("daily", 10)).toBe(0);
    const old = new GameEngine();
    const p7 = new GameEngine();
    old.startEndless(88);
    p7.startEndless(88, "p7");
    expect(p7.state.rngState).toBe(old.state.rngState);
    p7.state.floor = 5;
    p7.prepareFloorOptions();
    expect(p7.state.challenge!.stage).toBe(1);
    expect(p7.state.challenge!.mutatorIds).toEqual(selectMutators(88, 1));
    old.startNew(88);
    p7.startDaily(88, "2026-09-19");
    expect(p7.state.rngState).toBe(old.state.rngState);
    const ids = [...p7.state.challenge!.mutatorIds];
    p7.state.floor = 8;
    p7.prepareFloorOptions();
    expect(p7.state.challenge!.mutatorIds).toEqual(ids);
  });
  test("每日不受个人自适应影响；刷新状态含身份且不重复施加开场效果", () => {
    const a = new GameEngine();
    const b = new GameEngine();
    a.adaptiveProvider = () => 0.15;
    b.adaptiveProvider = () => -0.15;
    a.startDaily(99, "2026-09-19");
    b.startDaily(99, "2026-09-19");
    a.startCombat();
    b.startCombat();
    expect(a.state.combat).toEqual(b.state.combat);
    const restored = new GameEngine();
    restored.load(JSON.parse(JSON.stringify(a.state)));
    expect(restored.state.challenge).toEqual(a.state.challenge);
    expect(restored.state.player).toEqual(a.state.player);
    expect(restored.state.combat).toEqual(a.state.combat);
    restored.endTurn();
    a.endTurn();
    expect(restored.state.combat).toEqual(a.state.combat);
    expect(restored.state.rngState).toEqual(a.state.rngState);
  });
});

describe("词缀逐个挂载到引擎", () => {
  test.each(MUTATORS)("$name 的状态修正与规则表吻合", (mutator) => {
    const base = daily([]);
    const active = daily([mutator.id]);
    const fx = mutationEffects([mutator.id]);
    const before = base.state.combat!;
    const after = active.state.combat!;
    expect(after.enemy.maxHp).toBe(Math.max(1, Math.round(before.enemy.maxHp * fx.hpScale)));
    expect(after.enemy.baseAttack).toBe(
      Math.max(1, Math.round(before.enemy.baseAttack * fx.attackScale))
    );
    expect(after.enemy.armor).toBe(fx.enemyArmor);
    expect(after.enemy.vulnerable).toBe(fx.vulnerable);
    expect(after.energy).toBe(3 + fx.energy);
    expect(after.voiceBoost).toBe(fx.voiceBoost);
    expect(active.state.player!.strength).toBe(fx.strength);
    expect(active.state.player!.armor).toBe(fx.playerArmor);
    expect(active.state.rngState).toBe(base.state.rngState);
  });
  test("首句声韵加成只用一次，rawScore不变", () => {
    const e = daily(["noise", "clarity"]);
    e.state.combat!.enemy.hp = 999;
    expect(e.resolveSkill("ding-ngang-soeng", 74)).toMatchObject({ rawScore: 74, score: 78 });
    expect(e.resolveSkill("ding-ngang-soeng", 74)).toMatchObject({ rawScore: 74, score: 74 });
  });
  test("层甲每次敌方行动后增加；回春不超过上限", () => {
    const e = daily(["plating", "spring"]);
    e.state.combat!.enemy.pattern = [{ type: "guard", guard: 1, label: "守" }];
    e.endTurn();
    expect(e.state.combat!.enemy.armor).toBe(3);
    e.endTurn();
    expect(e.state.combat!.enemy.armor).toBe(6);
    e.state.player!.hp = 30;
    e.startCombat();
    expect(e.state.player!.hp).toBe(34);
    e.state.player!.hp = e.state.player!.maxHp - 1;
    e.startCombat();
    expect(e.state.player!.hp).toBe(e.state.player!.maxHp);
  });
  test("36种合法组合可有限回合执行并重复回放", () => {
    const run = (ids: string[]) => {
      const e = daily(ids);
      // 测试基础战斗是否可执行，不把固定出牌烟测冒充胜率报告。
      for (let turn = 0; turn < 40 && e.state.phase === "battle"; turn++) {
        while (e.state.phase === "battle" && e.canUseSkill("ding-ngang-soeng"))
          e.resolveSkill("ding-ngang-soeng", 85);
        if (e.state.phase === "battle") e.endTurn();
      }
      expect(["reward", "defeat"]).toContain(e.state.phase);
      return [e.state.phase, e.state.player!.hp, e.state.rngState];
    };
    for (const pressure of MUTATORS.filter((m) => m.kind === "pressure")) {
      for (const boon of MUTATORS.filter((m) => m.kind === "boon")) {
        const ids = [pressure.id, boon.id];
        expect(run(ids)).toEqual(run(ids));
      }
    }
  });
});
