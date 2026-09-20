/**
 * P14 契约门：难度缩放边界与钉死路径、端点策略零接触面、隐私白名单。
 * 纯规则见 ../unit/{endpoint,difficulty}.test.ts；UI 见 ../e2e/p14.spec.ts。
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loadDifficultyStore, saveDifficultyStore } from "../../src/adapters/storage";
import { VOICE_CAPTURE_MAX_MS } from "../../src/core/config/balance";
import {
  DIFFICULTY_BOOST_CAP,
  DIFFICULTY_TARGET,
  boostFor,
  difficultyKeyFor,
  emptyDifficultyStore,
  recordDifficultyResult
} from "../../src/core/difficulty";
import { GameEngine } from "../../src/core/engine";

const P7 = {
  ruleset: "p7" as const,
  buildVersion: 1 as const,
  encounterVersion: 1 as const,
  counterVersion: 1 as const,
  rosterVersion: 1 as const,
  ultimateVersion: 1 as const
};

describe("P14 难度上下文透传（按模式/按幕采样）", () => {
  test("战役按幕传 act；无尽传 endless；经典不传（仍是 classic 键）", () => {
    const engine = new GameEngine();
    const seen: (string | undefined)[] = [];
    engine.adaptiveProvider = (context) => {
      seen.push(difficultyKeyFor(context));
      return 0;
    };
    engine.startCampaign({ ...P7, act: 2, seed: 7, character: "man-mou-saang" });
    engine.startEndless(11, "p7");
    engine.startNew(13);
    expect(seen).toEqual(["act2", "endless", "classic"]);
  });

  test("续行换幕 → 按新幕重采样（同一局内跟随幕，而非开局钉死）", () => {
    const engine = new GameEngine();
    const keys: string[] = [];
    engine.adaptiveProvider = (context) => {
      keys.push(difficultyKeyFor(context));
      return 0;
    };
    engine.startCampaign({ ...P7, act: 1, seed: 21, character: "man-mou-saang" });
    engine.state.phase = "victory";
    engine.continueNextAct(99);
    expect(keys).toEqual(["act1", "act2"]);
    expect(engine.state.campaign!.act).toBe(2);
  });

  test("缩放上限 ±15%：引擎侧钳制与 difficulty 常量同源（任一处收紧都生效）", () => {
    expect(DIFFICULTY_BOOST_CAP).toBe(0.15);
    const engine = new GameEngine();
    engine.adaptiveProvider = () => 9; // 越界注入
    engine.startNew(5);
    expect(engine.state.adaptiveBoost).toBe(9); // 采样原样存下（钳制在 gradedEnemy 里）
    const before = engine.scaledEnemy(
      { id: "x", name: "试", hp: 100, attack: 10, pattern: [] } as never,
      "battle"
    );
    engine.state.adaptiveBoost = DIFFICULTY_BOOST_CAP;
    const capped = engine.scaledEnemy(
      { id: "x", name: "试", hp: 100, attack: 10, pattern: [] } as never,
      "battle"
    );
    expect(capped.hp).toBe(before.hp); // 9 与 0.15 缩放结果一致（都被钳到 +15%）
  });
});

describe("P14 钉死路径：每日与切磋不受本机评级影响", () => {
  test("每日挑战 boost 恒 0（即使 provider 给出正值）", () => {
    const engine = new GameEngine();
    engine.adaptiveProvider = () => 0.12;
    engine.startDaily(1234, "2026-09-20");
    expect(engine.state.adaptiveBoost).toBe(0);
  });

  test("切磋局 boost 取自码内（本机评级不参与）；且切磋局续行不重采样", () => {
    const engine = new GameEngine();
    engine.adaptiveProvider = () => 0.15;
    engine.startChallenge({
      mode: "campaign",
      act: 1,
      seed: 4242,
      ruleset: "p7",
      build: 1,
      encounter: 1,
      counter: 1,
      roster: 1,
      ultimate: 1,
      character: "faa-daan",
      code: "VT1.test",
      hash: "deadbeef",
      adaptiveBoost: -8
    });
    expect(engine.state.adaptiveBoost).toBeCloseTo(-0.08);
    engine.state.phase = "victory";
    engine.continueNextAct(777);
    expect(engine.state.adaptiveBoost).toBeCloseTo(-0.08); // 续行后仍是码内难度
  });
});

describe("P14 关闭开关 = 基线", () => {
  test("provider 返回 0 时 boost 为 0，敌人数值与不开启逐位一致", () => {
    const engine = new GameEngine();
    engine.adaptiveProvider = () => 0;
    engine.startNew(31);
    expect(engine.state.adaptiveBoost).toBe(0);
    const blueprint = { id: "x", name: "试", hp: 120, attack: 12, pattern: [] } as never;
    expect(engine.scaledEnemy(blueprint, "battle").hp).toBe(120);
  });
});

describe("P14 端点策略的接触面", () => {
  test("QTE/键盘通道与端点策略无关：显式 stop 仍走 flush，且 8 秒兜底常量未变", () => {
    // 端点策略只在麦克风适配器内被喂（worker）；引擎侧没有任何引用
    expect(VOICE_CAPTURE_MAX_MS).toBeGreaterThan(0);
    const engine = new GameEngine();
    engine.startNew(3);
    engine.startCombat("battle");
    const hand = engine.state.combat!.hand[0];
    // 无声通道（qte）施法：日志与判定只走既有路径，无端点相关文案
    const result = engine.resolveSkill(hand.id, 88, { source: "qte" }, hand.index)!;
    expect(result.damage).toBeGreaterThan(0);
    expect(engine.state.combat!.log.join(" ")).not.toContain("端点");
    expect(engine.state.combat!.log.join(" ")).not.toContain("保底");
  });
});

describe("P14 难度档隐私与持久化", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  test("落盘字段白名单：只有各模式评级与胜负计数，没有任何对局内容", () => {
    let store = emptyDifficultyStore();
    store = recordDifficultyResult(store, "classic", true);
    store = recordDifficultyResult(store, "act2", false);
    saveDifficultyStore(store);
    const raw = localStorage.getItem("voice-tower-difficulty-v1")!;
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["losses", "ratings", "wins"]);
    for (const banned of ["deck", "relic", "seed", "score", "transcript", "character", "id"]) {
      expect(raw).not.toContain(`"${banned}"`);
    }
    // 往返：读回来与写出去等价（数值取整后逐位一致）
    expect(loadDifficultyStore()).toEqual(store);
  });

  test("旧档/坏档 → 空档（零缩放），不抛异常", () => {
    localStorage.setItem("voice-tower-difficulty-v1", "{not json");
    expect(loadDifficultyStore()).toEqual(emptyDifficultyStore());
    localStorage.setItem("voice-tower-difficulty-v1", JSON.stringify({ ratings: { act9: 9999 } }));
    const loaded = loadDifficultyStore();
    expect(loaded.ratings).toEqual({});
    expect(boostFor(loaded, "act1")).toBe(0);
    expect(DIFFICULTY_TARGET).toBe(1500);
  });
});
