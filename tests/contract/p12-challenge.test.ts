/**
 * P12 切磋码契约：同码同局（可执行证明）、不静默降级、零副作用、旧局零漂移。
 * 纯函数边界见 ../unit/challenge.test.ts；UI 入口见 ../e2e/p12.spec.ts。
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loadChallengeRecords, saveChallengeRecord } from "../../src/adapters/storage";
import {
  CHALLENGE_RECORD_LIMIT,
  type ChallengeBundle,
  type ChallengeRun,
  challengeFromRun,
  challengeRecordFor,
  decodeChallenge,
  encodeChallenge
} from "../../src/core/challenge";
import { dailySeedForKey } from "../../src/core/daily";
import { GameEngine } from "../../src/core/engine";
import { selectMutators } from "../../src/core/mutators";

const DAILY_KEY = "2026-09-20";
const DAILY_SEED = dailySeedForKey(DAILY_KEY);

function codeFor(bundle: ChallengeBundle): ChallengeRun {
  const encoded = encodeChallenge(bundle);
  if (!encoded.ok) throw new Error(`测试码构造失败：${encoded.detail}`);
  const decoded = decodeChallenge(encoded.code);
  if (!decoded.ok) throw new Error(`测试码自解码失败：${decoded.detail}`);
  return decoded.challenge;
}

const CAMPAIGN_BUNDLE: ChallengeBundle = {
  mode: "campaign",
  act: 1,
  seed: 20260920,
  ruleset: "p7",
  build: 1,
  encounter: 1,
  counter: 1,
  roster: 1,
  ultimate: 1,
  character: "faa-daan"
};

/** 固定命令序列：开战 → 施法 → 结束回合 → 择路（相位允许时）。 */
function play(e: GameEngine): string {
  e.startCombat("battle");
  const hand = e.state.combat!.hand[0];
  e.resolveSkill(hand.id, 88, { source: "qte" }, hand.index);
  e.endTurn();
  if (e.state.phase === "tower") e.chooseFloorOption(e.state.floorOptions[0].id);
  e.state.stats!.startedAt = "fixed";
  return JSON.stringify(e.state);
}

describe("P12 切磋码契约", () => {
  test("同码同局：两个引擎跑同一序列逐位一致（含地图/敌人/手牌/词缀）", () => {
    const run = codeFor(CAMPAIGN_BUNDLE);
    const first = new GameEngine();
    const second = new GameEngine();
    first.startChallenge(run);
    second.startChallenge(run);
    // 开局身份：幕、种子、角色、版本束、牌组
    expect(first.state.campaign!.act).toBe(1);
    expect(first.state.campaign!.map.seed).toBe(CAMPAIGN_BUNDLE.seed);
    expect(first.state.characterId).toBe("faa-daan");
    expect(first.state.ruleset).toBe("p7");
    expect(first.state.player!.deck).toEqual(second.state.player!.deck);
    expect(JSON.stringify(first.state.campaign!.map)).toBe(
      JSON.stringify(second.state.campaign!.map)
    );
    // 逐位一致：状态哈希（含后续战斗）必须相同
    expect(play(first)).toBe(play(second));
  });

  test("码 → 局 → 码 往返等价：四种模式都能从局内反推出同一码", () => {
    const bundles: ChallengeBundle[] = [
      CAMPAIGN_BUNDLE,
      { mode: "campaign", act: 3, seed: 77, ruleset: "legacy" },
      {
        mode: "endless",
        act: 1,
        seed: 4242,
        ruleset: "p7",
        mutators: selectMutators(4242, 0),
        adaptiveBoost: 5
      },
      {
        mode: "daily",
        act: 1,
        seed: DAILY_SEED,
        ruleset: "p7",
        dateKey: DAILY_KEY,
        mutators: selectMutators(DAILY_SEED, 0)
      },
      { mode: "classic", act: 1, seed: 31415, ruleset: "legacy" }
    ];
    for (const bundle of bundles) {
      const run = codeFor(bundle);
      const engine = new GameEngine();
      engine.startChallenge(run);
      const rebuilt = challengeFromRun(engine.state);
      expect(rebuilt, bundle.mode).toEqual(bundle);
      const reencoded = encodeChallenge(rebuilt!);
      expect(reencoded.ok, bundle.mode).toBe(true);
      if (reencoded.ok) {
        expect(reencoded.code).toBe(run.code);
        expect(reencoded.hash).toBe(run.hash);
      }
      // 切磋身份落地：码与哈希可被结算屏/战绩簿直接读取
      expect(engine.state.duel).toEqual({
        code: run.code,
        hash: run.hash,
        mode: bundle.mode,
        act: bundle.act,
        seed: bundle.seed,
        dateKey: bundle.dateKey,
        character: bundle.character
      });
      expect(engine.state.challengeVersion).toBe(1);
    }
  });

  test("不静默降级：拒绝路径不触碰引擎状态，也不产出可开局的对象", () => {
    const engine = new GameEngine();
    engine.startCampaign({ act: 1, seed: 5, ruleset: "p7", buildVersion: 1 });
    const before = JSON.stringify(engine.state);
    const rejections = [
      "VT1.###.###",
      "not-a-code",
      "VT2.AAAA.BBBB",
      `${codeFor(CAMPAIGN_BUNDLE).code.slice(0, -1)}X`
    ];
    for (const input of rejections) {
      const result = decodeChallenge(input);
      expect(result.ok, input).toBe(false);
      if (!result.ok) expect(["malformed", "unsupported", "mismatch"]).toContain(result.reason);
    }
    // 畸形/跨版本输入既没有可用的 challenge 对象，也没有改动任何状态
    expect(JSON.stringify(engine.state)).toBe(before);
    expect(engine.state.duel).toBeUndefined();
  });

  test("版本束逐位透传：码里开哪几期就只开哪几期（缺省保留旧行为）", () => {
    const full = new GameEngine();
    full.startChallenge(codeFor(CAMPAIGN_BUNDLE));
    expect(full.state.buildVersion).toBe(1);
    expect(full.state.encounterVersion).toBe(1);
    expect(full.state.counterVersion).toBe(1);
    expect(full.state.rosterVersion).toBe(1);
    expect(full.state.ultimateVersion).toBe(1);

    const minimal = new GameEngine();
    minimal.startChallenge(codeFor({ mode: "campaign", act: 1, seed: 8, ruleset: "p7", build: 1 }));
    expect(minimal.state.buildVersion).toBe(1);
    expect(minimal.state.encounterVersion).toBeUndefined();
    expect(minimal.state.rosterVersion).toBeUndefined();
    expect(minimal.state.ultimateVersion).toBeUndefined();
    expect(minimal.state.characterId).toBeUndefined();

    const legacy = new GameEngine();
    legacy.startChallenge(codeFor({ mode: "campaign", act: 1, seed: 8, ruleset: "legacy" }));
    expect(legacy.state.ruleset).toBeUndefined();
    expect(legacy.state.buildVersion).toBeUndefined();
  });

  test("同码同难：切磋局不读本机自适应节律，难度只跟码走", () => {
    const plain = codeFor({ mode: "campaign", act: 1, seed: 11, ruleset: "p7", build: 1 });
    const carried = codeFor({
      mode: "campaign",
      act: 1,
      seed: 11,
      ruleset: "p7",
      build: 1,
      adaptiveBoost: -8
    });
    const winner = new GameEngine();
    winner.adaptiveProvider = () => 0.05; // 本机正在连胜
    const loser = new GameEngine();
    loser.adaptiveProvider = () => -0.08; // 本机正在连败
    winner.startChallenge(plain);
    loser.startChallenge(plain);
    expect(winner.state.adaptiveBoost).toBe(0);
    expect(loser.state.adaptiveBoost).toBe(0);
    // 码自带难度时按码执行：两端拿到同一难度（+5% 的码在两端都是 +5%）
    const a = new GameEngine();
    a.adaptiveProvider = () => -0.08;
    const b = new GameEngine();
    b.adaptiveProvider = () => 0.05;
    const boosted = codeFor({
      mode: "campaign",
      act: 1,
      seed: 11,
      ruleset: "p7",
      build: 1,
      adaptiveBoost: 5
    });
    a.startChallenge(boosted);
    b.startChallenge(boosted);
    expect(a.state.adaptiveBoost).toBe(0.05);
    expect(b.state.adaptiveBoost).toBe(0.05);
    expect(carried.hash).not.toBe(plain.hash);
  });

  test("旧局零漂移：不带码的开局不产生切磋字段，同配置逐位一致", () => {
    const start = () => {
      const engine = new GameEngine();
      engine.startCampaign({
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
      engine.startCombat("battle");
      engine.state.stats!.startedAt = "fixed";
      return engine;
    };
    const first = start();
    const second = start();
    expect(JSON.stringify(first.state)).toBe(JSON.stringify(second.state));
    expect(first.state.duel).toBeUndefined();
    expect(first.state.challengeVersion).toBeUndefined();
    // 经典/无尽/每日的旧入口同样不挂身份
    const endless = new GameEngine();
    endless.startEndless(123, "p7");
    expect(endless.state.duel).toBeUndefined();
    const daily = new GameEngine();
    daily.startDaily(DAILY_SEED, DAILY_KEY);
    expect(daily.state.duel).toBeUndefined();
  });

  test("存档往返保留切磋身份；读档后与直开重跑同一序列逐位一致", () => {
    const run = codeFor(CAMPAIGN_BUNDLE);
    const engine = new GameEngine();
    engine.startChallenge(run);
    const resumed = new GameEngine();
    resumed.load(JSON.parse(JSON.stringify(engine.state)));
    expect(resumed.state.duel).toEqual(engine.state.duel);
    expect(resumed.state.challengeVersion).toBe(1);
    expect(resumed.state.adaptiveBoost).toBe(0);
    // 归一化只针对必然不同的两处：读档提示文案与开局时间戳
    for (const target of [engine, resumed]) {
      target.state.notice = null;
      target.state.stats!.startedAt = "fixed";
    }
    expect(JSON.stringify(resumed.state)).toBe(JSON.stringify(engine.state));
    expect(play(resumed)).toBe(play(engine));
    expect(engine.state.duel!.code).toBe(run.code);
  });

  test("幕间续行摘掉码身份：码只约定它写明的那一幕", () => {
    const engine = new GameEngine();
    engine.startChallenge(codeFor(CAMPAIGN_BUNDLE));
    expect(engine.state.duel).toBeDefined();
    engine.state.phase = "victory"; // continueNextAct 的前置相位
    engine.continueNextAct();
    expect(engine.state.campaign!.act).toBe(2);
    expect(engine.state.duel).toBeUndefined();
  });

  test("战绩簿：同码只留更优者，超上限淘汰最旧", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key)
    });
    const run = codeFor(CAMPAIGN_BUNDLE);
    const record = (floor: number, victory: boolean, finishedAt: string) =>
      challengeRecordFor(run, { floor, victory, averageScore: 80 }, finishedAt);
    expect(saveChallengeRecord(record(5, false, "2026-09-20T00:00:01Z"))).toBe(true);
    expect(saveChallengeRecord(record(3, false, "2026-09-20T00:00:02Z"))).toBe(false); // 更差
    expect(saveChallengeRecord(record(9, false, "2026-09-20T00:00:03Z"))).toBe(true); // 楼层更高
    expect(loadChallengeRecords()).toHaveLength(1);
    expect(loadChallengeRecords()[0].floor).toBe(9);
    expect(saveChallengeRecord(record(2, true, "2026-09-20T00:00:04Z"))).toBe(true); // 通关最优
    expect(loadChallengeRecords()[0].victory).toBe(true);

    for (let index = 0; index < CHALLENGE_RECORD_LIMIT + 3; index += 1) {
      const other = codeFor({
        mode: "campaign",
        act: 1,
        seed: 1000 + index,
        ruleset: "legacy"
      });
      saveChallengeRecord(
        challengeRecordFor(
          other,
          { floor: 1, victory: false, averageScore: 60 },
          `2026-09-21T00:00:${String(index).padStart(2, "0")}Z`
        )
      );
    }
    const records = loadChallengeRecords();
    expect(records).toHaveLength(CHALLENGE_RECORD_LIMIT);
    expect(records[0].finishedAt).toBe(`2026-09-21T00:00:${CHALLENGE_RECORD_LIMIT + 2}Z`);
    vi.unstubAllGlobals();
  });
});

// 战绩簿测试用到 localStorage 桩：失败时也要还原，避免污染其它用例
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.restoreAllMocks());
