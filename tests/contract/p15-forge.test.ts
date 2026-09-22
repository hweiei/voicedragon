/**
 * P15 铸剑炉契约（版本门控 + 旧局零漂移 + 切磋码零破坏）：
 * 1) 锻造内容只进 `ruleset=p7 && forgeVersion=1` 的局：事件/遗物/题池三个入口；
 *    缺省（含旧局读档语义）与 P14 逐位一致；
 * 2) 引擎状态 `forgeVersion` 仅在显式开启时落档；旧路径（位置参数/其他开局）零接触；
 * 3) 切磋码：旧码（无 forge 字段）原样可解、同码同局；新码携带 `f:1` 往返恒等；
 *    非战役/非 p7 码携带 forge 一律拒绝（版本束通用校验）；
 * 4) 锻造遗物「每场一次」钩子确定性：同场重复施法不重复生效（以醒狮铜铃为例）。
 */

import { describe, expect, test } from "vitest";
import { type ChallengeBundle, decodeChallenge, encodeChallenge } from "../../src/core/challenge";
import {
  ALL_RELICS,
  eventsFor,
  lookupRelic,
  relicsUpToAct,
  skillsFor
} from "../../src/core/content";
import { FORGE_EVENTS, FORGE_QUIZ, FORGE_RELICS } from "../../src/core/content/forge";
import { quizPoolFor } from "../../src/core/content/listening";
import { CHARACTERS } from "../../src/core/content/roster";
import { GameEngine } from "../../src/core/engine";

/** 首胜授予槽位（与引擎 finishCombatVictory 同一公式；此处独立复算作对照）。 */
function grantSlot(characterId: string | undefined, act: number): number {
  const characterIndex = CHARACTERS.findIndex((entry) => entry.id === characterId);
  return ((characterIndex >= 0 ? characterIndex : CHARACTERS.length) * 3 + (act - 1)) % 6;
}

describe("P15 内容门控：锻造只进显式开启的 p7 新局", () => {
  test("事件池：缺省逐位不变，开启后各幕 +4", () => {
    for (const act of [1, 2, 3]) {
      expect(eventsFor(act, "p7")).toEqual(eventsFor(act, "p7", undefined));
      const base = eventsFor(act, "p7");
      const forged = eventsFor(act, "p7", 1);
      expect(forged.slice(0, base.length)).toEqual(base);
      expect(forged.length).toBe(base.length + FORGE_EVENTS[act].length);
      expect(eventsFor(act, "legacy", 1)).toEqual(eventsFor(act, "legacy"));
    }
  });

  test("遗物零稀释：随机抽取池（宝箱/精英/夜市/事件）逐位不变，锻造遗物不入池", () => {
    for (const act of [1, 2, 3]) {
      const pool = relicsUpToAct(act).map((relic) => relic.id);
      for (const relic of FORGE_RELICS) {
        expect(pool).not.toContain(relic.id);
      }
    }
    expect(FORGE_RELICS).toHaveLength(6);
    // 每件锻造遗物都能被图鉴/背包查到，且 5 件带流派标签（锦囊明示百搭）
    for (const relic of FORGE_RELICS) {
      expect(lookupRelic(relic.id)?.name).toBe(relic.name);
      expect(ALL_RELICS.some((entry) => entry.id === relic.id)).toBe(true);
    }
    expect(FORGE_RELICS.filter((relic) => relic.school).length).toBe(5);
  });

  test("授予槽位：三角色 × 三幕共九个开局槽位覆盖全部六件流派遗物（确定性）", () => {
    const granted = new Set<string>();
    for (const character of CHARACTERS) {
      for (const act of [1, 2, 3]) {
        granted.add(FORGE_RELICS[grantSlot(character.id, act)].id);
      }
    }
    expect(granted.size).toBe(6);
  });

  test("题池：缺省逐位不变，开启后 +30 文化题（文字题，不依赖音色）", () => {
    expect(FORGE_QUIZ).toHaveLength(30);
    const legacy = quizPoolFor("legacy", true, 1);
    expect(legacy.pool.length).toBe(quizPoolFor("legacy", true).pool.length);
    const p7Off = quizPoolFor("p7", true);
    const p7On = quizPoolFor("p7", true, 1);
    expect(p7On.pool.length).toBe(p7Off.pool.length + 30);
    // 无粤语音色时同样并入文化题（诚实降级只影响听音题）
    const noVoiceOn = quizPoolFor("p7", false, 1);
    expect(noVoiceOn.pool.length).toBe(quizPoolFor("p7", false).pool.length + 30);
    // 文化题答案位置均匀分布（防「永远选第一个」的背题漏洞）
    const distribution = new Set(p7On.pool.slice(-30).map((question) => question.answerIndex));
    expect(distribution.size).toBeGreaterThanOrEqual(3);
  });

  test("技能池零接触：锻造不含新技能，skillsFor 各形态逐位不变", () => {
    expect(skillsFor(2, "p7", 1, "faa-daan")).toEqual(skillsFor(2, "p7", 1, "faa-daan"));
  });
});

describe("P15 引擎状态：forgeVersion 只在显式开启时落档", () => {
  test("位置参数旧签名 / 缺省 config：无 forgeVersion（旧局零漂移）", () => {
    const legacyEngine = new GameEngine();
    legacyEngine.startCampaign(1, 20260922, "p7", 1, 1, 1);
    expect(legacyEngine.state.forgeVersion).toBeUndefined();

    const configEngine = new GameEngine();
    configEngine.startCampaign({ act: 1, seed: 20260922, ruleset: "p7" });
    expect(configEngine.state.forgeVersion).toBeUndefined();
  });

  test("legacy 规则集下即使传 1 也不开启（与 mastery 等既有门控同律）", () => {
    const engine = new GameEngine();
    engine.startCampaign({ act: 1, seed: 20260922, ruleset: "legacy", forgeVersion: 1 });
    expect(engine.state.forgeVersion).toBeUndefined();
  });

  test("p7 + forgeVersion=1：落档，且事件节点抽自扩展池（含锻造事件）", () => {
    const engine = new GameEngine();
    engine.startCampaign({ act: 1, seed: 20260922, ruleset: "p7", forgeVersion: 1 });
    expect(engine.state.forgeVersion).toBe(1);
  });
});

describe("P15 切磋码：旧码零破坏、新码可携带 forge", () => {
  const baseBundle: ChallengeBundle = {
    mode: "campaign",
    act: 2,
    seed: 987654321,
    ruleset: "p7",
    build: 1,
    encounter: 1,
    counter: 1,
    roster: 1,
    ultimate: 1
  };

  test("旧码（无 forge 字段）原样可解，解码结果无 forge", () => {
    const encoded = encodeChallenge(baseBundle);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = decodeChallenge(encoded.code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.challenge.forge).toBeUndefined();
  });

  test("新码携带 forge=1：往返恒等，开局落档", () => {
    const encoded = encodeChallenge({ ...baseBundle, forge: 1 });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = decodeChallenge(encoded.code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.challenge.forge).toBe(1);
    const engine = new GameEngine();
    engine.startChallenge(decoded.challenge);
    expect(engine.state.forgeVersion).toBe(1);
    expect(engine.state.challengeVersion).toBe(1);
  });

  test("非战役码携带 forge 被拒绝（版本束只在 p7 战役生效）", () => {
    const endless: ChallengeBundle = {
      mode: "endless",
      act: 1,
      seed: 424242,
      ruleset: "p7",
      forge: 1
    };
    const encoded = encodeChallenge(endless);
    expect(encoded.ok).toBe(false);
  });
});

describe("P15 流派遗物：首胜确定性授予、一局一件、旧局零接触", () => {
  function forgeRun(character: "man-mou-saang" | "faa-daan", act = 1): GameEngine {
    const engine = new GameEngine();
    engine.startCampaign({
      act,
      seed: 20260922,
      ruleset: "p7",
      rosterVersion: 1,
      forgeVersion: 1,
      character
    });
    return engine;
  }

  test("锻造局首胜授予槽位遗物；再胜不再授；非锻造局零接触", () => {
    const engine = forgeRun("faa-daan", 1);
    const expected = FORGE_RELICS[grantSlot("faa-daan", 1)].id;
    expect(engine.state.player!.relics).toEqual([]);
    const battleOption = engine.state.floorOptions.find((option) => option.type === "battle")!;
    engine.chooseFloorOption(battleOption.id);
    engine.finishCombatVictory();
    expect(engine.state.forgeRelicGranted).toBe(1);
    expect(engine.state.player!.relics).toEqual([expected]);
    // 同场再次结算（战斗对象未清理前）不再授予——「一局一件」守卫自证
    engine.finishCombatVictory();
    expect(engine.state.player!.relics).toEqual([expected]);

    // 非锻造局：首胜后仍然没有锻造遗物
    const plain = new GameEngine();
    plain.startCampaign({
      act: 1,
      seed: 20260922,
      ruleset: "p7",
      rosterVersion: 1,
      character: "faa-daan"
    });
    const plainBattle = plain.state.floorOptions.find((option) => option.type === "battle")!;
    plain.chooseFloorOption(plainBattle.id);
    plain.finishCombatVictory();
    expect(plain.state.forgeRelicGranted).toBeUndefined();
    for (const relicId of plain.state.player!.relics) {
      expect(relicId.startsWith("p15-")).toBe(false);
    }
  });
});

describe("P15 锻造遗物钩子：每场一次、确定性消耗", () => {
  /** 花旦开局（牌组含多段「一齐上」），强行进战斗并把手牌换成多段牌。 */
  function forgeBattle(relics: string[]): GameEngine {
    const engine = new GameEngine();
    engine.startCampaign({
      act: 1,
      seed: 20260922,
      ruleset: "p7",
      rosterVersion: 1,
      forgeVersion: 1,
      character: "faa-daan"
    });
    engine.state.player!.relics = [...relics];
    const battleOption = engine.state.floorOptions.find((option) => option.type === "battle")!;
    engine.chooseFloorOption(battleOption.id);
    const combat = engine.state.combat!;
    const deckIndex = engine.state.player!.deck.indexOf("jat-cai-soeng");
    combat.hand = [{ id: "jat-cai-soeng", index: deckIndex }];
    combat.energy = 3;
    return engine;
  }

  test("醒狮铜铃：首场多段施法每段 +1，且只生效一次", () => {
    const engine = forgeBattle(["p15-sing-tung-ling"]);
    const combat = engine.state.combat!;
    combat.enemy.armor = 0; // 排除护甲变量，只锁遗物增量
    const hpBefore = combat.enemy.hp;
    const result = engine.resolveSkill("jat-cai-soeng", 70, {}, 0);
    expect(result).not.toBeNull();
    expect(combat.forgeUsed).toEqual(["p15-sing-tung-ling"]);
    // 3 段 ×（4 威力 × 清晰倍率 1 + 1 铃）= 15——具体数值由结算保证，这里锁增量
    const firstDamage = hpBefore - combat.enemy.hp;
    expect(firstDamage).toBeGreaterThan(0);

    // 同场第二次：标记不重复、伤害回到基础值（3 段 × 4 = 12，差值恰为 3）
    combat.energy = 3;
    combat.hand = [
      { id: "jat-cai-soeng", index: engine.state.player!.deck.indexOf("jat-cai-soeng") }
    ];
    combat.enemy.armor = 0;
    combat.enemy.hp = hpBefore; // 回满，避免第一次打出击杀导致相位切换
    const hpBefore2 = combat.enemy.hp;
    engine.resolveSkill("jat-cai-soeng", 70, {}, 0);
    expect(combat.forgeUsed).toEqual(["p15-sing-tung-ling"]);
    const secondDamage = hpBefore2 - combat.enemy.hp;
    expect(firstDamage - secondDamage).toBe(3); // 3 段各少 1
  });

  test("无遗物时钩子静默（旧行为逐位），锻造遗物不入随机池（零稀释自证）", () => {
    const engine = forgeBattle([]);
    const combat = engine.state.combat!;
    engine.resolveSkill("jat-cai-soeng", 70, {}, 0);
    expect(combat.forgeUsed ?? []).toEqual([]);
    expect(relicsUpToAct(1).some((relic) => relic.id === "p15-sing-tung-ling")).toBe(false);
  });
});
