import { describe, expect, test } from "vitest";
import { skillsFor } from "../../src/core/content";
import { lookupSkill } from "../../src/core/content";
import { CHARACTERS, lookupCharacter } from "../../src/core/content/roster";
import type { EnemyIntent } from "../../src/core/data";
import { GameEngine, type GameState } from "../../src/core/engine";

function hash(state: GameState): string {
  return JSON.stringify({ ...state, stats: { ...state.stats!, startedAt: "fixed" } });
}

function rosterBattle(character: string, pattern: EnemyIntent[]): GameEngine {
  const e = new GameEngine();
  e.startCampaign({
    act: 1,
    seed: 991,
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    character: character as "faa-daan"
  });
  e.startCombat("battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.combat!.enemy.pattern = pattern;
  return e;
}

describe("P10 名伶登场契约", () => {
  test("参数对象与旧位置签名等价：同参同状态哈希；旧契约路径零改动", () => {
    const a = new GameEngine();
    a.startCampaign(1, 777, "p7", 1, 1, 1);
    const b = new GameEngine();
    b.startCampaign({
      act: 1,
      seed: 777,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1,
      counterVersion: 1
    });
    expect(hash(a.state)).toBe(hash(b.state));
  });

  test("roster 落位：角色缺省文武生；起始牌组按角色覆写；legacy 局保持原牌组逐位不变", () => {
    const e = new GameEngine();
    e.startCampaign({ act: 1, seed: 42, ruleset: "p7", rosterVersion: 1 });
    expect(e.state.rosterVersion).toBe(1);
    expect(e.state.characterId).toBe("man-mou-saang");
    expect(e.state.player!.deck).toEqual(lookupCharacter("man-mou-saang")!.startingDeck);
    const legacy = new GameEngine();
    legacy.startCampaign(1, 42, "p7", 1, 1, 1);
    expect(legacy.state.rosterVersion).toBeUndefined();
    expect(legacy.state.characterId).toBeUndefined();
    const classic = new GameEngine();
    classic.startCampaign({ act: 1, seed: 42, rosterVersion: 1 }); // 非 p7 不落 roster
    expect(classic.state.rosterVersion).toBeUndefined();
    const legacyDeck = new GameEngine();
    legacyDeck.startCampaign({ act: 1, seed: 42, ruleset: "legacy" });
    const positionalDeck = new GameEngine();
    positionalDeck.startCampaign(1, 42);
    expect(legacyDeck.state.player!.deck).toEqual(positionalDeck.state.player!.deck);
  });

  test("亮相：首次正音施法当次伤害 +4（对比同局未开被动），标记每场一次", () => {
    const pattern: EnemyIntent[] = [{ type: "attack", amount: 1, label: "试击" }];
    const on = rosterBattle("man-mou-saang", pattern);
    const off = rosterBattle("faa-daan", pattern); // 花旦无调准通道 → 无被动
    on.state.player!.deck.push("hou-sai-lei");
    off.state.player!.deck.push("hou-sai-lei");
    for (const e of [on, off]) {
      e.state.combat!.hand = [{ id: "hou-sai-lei", index: e.state.player!.deck.length - 1 }];
    }
    const rOn = on.resolveSkill("hou-sai-lei", 85, {}, 5)!;
    const rOff = off.resolveSkill("hou-sai-lei", 85, {}, 5)!;
    expect(rOn.damage).toBe(rOff.damage + 4);
    expect(on.state.combat!.passives?.limelight).toBe(true);
    // 同场第二次正音不再加成（回到与无被动局相同的伤害）
    on.state.combat!.hand = [{ id: "hou-sai-lei", index: 5 }];
    on.state.combat!.energy = 3;
    const rOn2 = on.resolveSkill("hou-sai-lei", 90, {}, 5)!;
    expect(rOn2.damage).toBe(rOff.damage);
  });

  test("绕梁：调准 ≥80 施法额外护甲；QTE 通道不触发", () => {
    const e = rosterBattle("faa-daan", [{ type: "attack", amount: 1, label: "试击" }]);
    e.state.player!.deck.push("m-sai-geng");
    e.state.combat!.hand = [{ id: "m-sai-geng", index: 5 }];
    // 唔使惊自带 ≥65 时 +2 甲：74分清晰档 9+2(自带)+2(绕梁)=13
    const withTone = e.resolveSkill("m-sai-geng", 74, { toneScore: 85, source: "voice" }, 5)!;
    expect(withTone.armor).toBe(13);
    e.state.combat!.hand = [{ id: "m-sai-geng", index: 5 }];
    e.state.combat!.energy = 3;
    // 92 分为正音档：round(9×1.32)=12 + 自带2 = 14，无绕梁加成
    const qte = e.resolveSkill("m-sai-geng", 92, { source: "qte" }, 5)!;
    expect(qte.armor).toBe(14);
  });

  test("打诨：破阵拍 ≥92 回气一次/回合；endTurn 后标记重置；旧局无 passives 字段", () => {
    const e = rosterBattle("cau-saang", [{ type: "attack", amount: 1, label: "试击" }]);
    e.state.player!.deck.push("hou-sai-lei");
    const index = e.state.player!.deck.length - 1;
    e.state.combat!.hand = [{ id: "hou-sai-lei", index }];
    // 92 分 QTE：3 气 - 1(施法) + 1(打诨) = 3
    e.resolveSkill("hou-sai-lei", 92, { source: "qte" }, index);
    expect(e.state.combat!.energy).toBe(3);
    expect(e.state.combat!.passives?.["jest-turn"]).toBe(true);
    e.state.combat!.hand = [{ id: "hou-sai-lei", index }];
    e.state.combat!.energy = 3;
    e.resolveSkill("hou-sai-lei", 95, { source: "qte" }, index); // 同回合不再触发：3-1=2
    expect(e.state.combat!.energy).toBe(2);
    e.endTurn();
    expect(e.state.combat!.passives?.["jest-turn"]).toBeUndefined();
    const legacy = new GameEngine();
    legacy.startCampaign(1, 7, "p7", 1, 1, 1);
    legacy.startCombat("battle");
    expect(legacy.state.combat!.passives).toBeUndefined();
  });

  test("签名技：各角色池一张且互斥；效果钩子（破甲/清干扰/夺甲）确定性", () => {
    for (const character of CHARACTERS) {
      const pool = skillsFor(1, "p7", 1, character.id);
      const ids = pool.map((skill) => skill.id);
      expect(ids).toContain(character.signature);
      for (const other of CHARACTERS) {
        if (other.id !== character.id) expect(ids).not.toContain(other.signature);
      }
    }
    // 一夫当关：正音破甲
    const e = rosterBattle("man-mou-saang", [{ type: "attack", amount: 1, label: "试击" }]);
    e.state.combat!.enemy.armor = 30;
    e.state.player!.deck.push("p10-jat-fu-dong-gwaan");
    const idx = e.state.player!.deck.length - 1;
    e.state.combat!.hand = [{ id: "p10-jat-fu-dong-gwaan", index: idx }];
    const r = e.resolveSkill("p10-jat-fu-dong-gwaan", 85, {}, idx)!;
    expect(r.damage).toBeGreaterThan(0);
    expect(e.state.combat!.enemy.armor).toBe(30); // 破甲：护甲未消耗
    // 搞掂晒：夺半数护甲
    const c = rosterBattle("cau-saang", [{ type: "attack", amount: 1, label: "试击" }]);
    c.state.combat!.enemy.armor = 10;
    c.state.player!.deck.push("p10-gaau-ding-saai");
    const cidx = c.state.player!.deck.length - 1;
    c.state.combat!.hand = [{ id: "p10-gaau-ding-saai", index: cidx }];
    const armorBefore = c.state.player!.armor;
    c.resolveSkill("p10-gaau-ding-saai", 74, {}, cidx);
    // 伤害 7 先被敌甲抵消（10→3），再夺 floor(3/2)=1
    expect(c.state.combat!.enemy.armor).toBe(2);
    expect(c.state.player!.armor).toBe(armorBefore + 1);
    // 顾盼生辉：≥65 清干扰
    const f = rosterBattle("faa-daan", [{ type: "attack", amount: 1, label: "试击" }]);
    f.state.player!.buffs.push({ id: "voice-interference", name: "错调干扰", value: 7, turns: 1 });
    f.state.player!.deck.push("p10-gu-paan-saang-fai");
    const fidx = f.state.player!.deck.length - 1;
    f.state.combat!.hand = [{ id: "p10-gu-paan-saang-fai", index: fidx }];
    f.resolveSkill("p10-gu-paan-saang-fai", 74, {}, fidx);
    expect(f.state.player!.buffs.some((buff) => buff.id === "voice-interference")).toBe(false);
  });

  test("升级表：签名技只加威力，不改全局定义；JSON 往返保留 roster 字段", () => {
    const signature = lookupSkill("p10-jat-fu-dong-gwaan")!;
    expect(signature.power).toBe(16);
    const e = rosterBattle("faa-daan", [{ type: "attack", amount: 1, label: "试击" }]);
    e.state.combat!.passives = { limelight: true };
    const restored = JSON.parse(JSON.stringify(e.state)) as GameState;
    expect(restored.characterId).toBe("faa-daan");
    expect(restored.rosterVersion).toBe(1);
    expect(restored.combat!.passives).toEqual({ limelight: true });
  });

  test("确定性：同配置同命令序列逐位一致；跨幕续行保留角色", () => {
    const run = (): string => {
      const e = rosterBattle("cau-saang", [{ type: "attack", amount: 1, label: "试击" }]);
      e.state.player!.deck.push("hou-sai-lei");
      const idx = e.state.player!.deck.length - 1;
      e.state.combat!.hand = [{ id: "hou-sai-lei", index: idx }];
      e.resolveSkill("hou-sai-lei", 92, { source: "qte" }, idx);
      e.endTurn();
      e.state.stats!.startedAt = "fixed";
      return JSON.stringify(e.state);
    };
    expect(run()).toBe(run());
    const e = rosterBattle("faa-daan", [{ type: "attack", amount: 1, label: "试击" }]);
    e.state.combat!.enemy.hp = 0;
    // 直接构造 victory 相验证跨幕
    e.state.phase = "victory";
    e.continueNextAct(123);
    expect(e.state.characterId).toBe("faa-daan");
    expect(e.state.rosterVersion).toBe(1);
  });
});
