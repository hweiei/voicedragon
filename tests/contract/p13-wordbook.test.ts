/**
 * P13 词林拾遗契约：门控（旧局零漂移）、保底只动档位不动裸分与统计、
 * 题池按音色诚实降级、词林数据「不出售强度」字段白名单。UI 流程见 ../e2e/p13.spec.ts。
 */

import { describe, expect, test } from "vitest";
import { ALL_SKILLS } from "../../src/core/content";
import { LISTENING_QUIZ, quizPoolFor } from "../../src/core/content/listening";
import { QUIZ_QUESTIONS } from "../../src/core/data";
import { GameEngine } from "../../src/core/engine";
import { MASTERY_FLOOR, MASTERY_MASTER_THRESHOLD } from "../../src/core/mastery";
import { wordbookEntries, wordbookProgress } from "../../src/core/wordbook";

function engineFor(options: {
  ruleset: "p7" | "legacy";
  mastery?: { version?: 1; floor: number };
}): GameEngine {
  const engine = new GameEngine();
  engine.startCampaign({
    act: 1,
    seed: 991,
    ruleset: options.ruleset,
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: options.ruleset === "p7" ? 1 : undefined,
    ultimateVersion: options.ruleset === "p7" ? 1 : undefined,
    character: "faa-daan",
    masteryPowerVersion: options.mastery?.version
  });
  engine.startCombat("battle");
  // 用一张确定的攻击牌，保证 damage 可评估
  const attack = ALL_SKILLS.find((skill) => skill.type === "attack")!;
  const index = engine.state.combat!.hand[0].index;
  engine.state.player!.deck[index] = attack.id;
  engine.state.combat!.hand = [{ id: attack.id, index }];
  engine.state.combat!.energy = 3;
  if (options.mastery) {
    const floor = options.mastery.floor;
    engine.masteryProvider = () => floor;
  }
  return engine;
}

describe("P13 力量化门控", () => {
  test("保底只抬档位：裸分、统计、伤害公式本体都不变", () => {
    const floored = engineFor({ ruleset: "p7", mastery: { version: 1, floor: MASTERY_FLOOR } });
    const plain = engineFor({ ruleset: "p7" });
    const flooredHand = floored.state.combat!.hand[0];
    const plainHand = plain.state.combat!.hand[0];

    const boosted = floored.resolveSkill(flooredHand.id, 64, { source: "qte" }, flooredHand.index)!;
    const plainResult = plain.resolveSkill(plainHand.id, 64, { source: "qte" }, plainHand.index)!;
    expect(boosted.tier.label).toBe("清晰"); // 64 → 保底 65
    expect(plainResult.tier.label).toBe("入门");
    expect(boosted.rawScore).toBe(64);
    expect(boosted.score).toBe(64); // 裸分不抬
    expect(floored.state.stats!.voiceScoreTotal).toBe(64); // 统计不抬
    expect(boosted.damage).toBeGreaterThan(plainResult.damage); // 力量只经档位倍率落地
  });

  test("保底不制造正音：84 分仍是清晰（正音必须当场唱准）", () => {
    expect(MASTERY_FLOOR).toBeLessThan(MASTERY_MASTER_THRESHOLD);
    const engine = engineFor({ ruleset: "p7", mastery: { version: 1, floor: MASTERY_FLOOR } });
    const card = engine.state.combat!.hand[0];
    const near = engine.resolveSkill(
      card.id,
      MASTERY_MASTER_THRESHOLD - 1,
      { source: "qte" },
      card.index
    )!;
    expect(near.tier.label).toBe("清晰");
  });

  test("门控：旧局与未开启的局一律零接触（连 provider 都不查）", () => {
    for (const ruleset of ["legacy", "p7"] as const) {
      const engine = engineFor({
        ruleset,
        mastery: ruleset === "p7" ? undefined : { version: 1, floor: MASTERY_FLOOR }
      });
      const card = engine.state.combat!.hand[0];
      const result = engine.resolveSkill(card.id, 64, { source: "qte" }, card.index)!;
      expect(result.tier.label).toBe("入门");
      expect(engine.masterySaves).toBe(0);
    }
    // 旧局存档里没有 P13 字段
    const legacy = engineFor({ ruleset: "legacy" });
    expect(legacy.state.masteryPowerVersion).toBeUndefined();
  });
});

describe("P13 题池按音色诚实降级", () => {
  test("legacy 池逐位不变；p7 无音色仍是基础池并如实报告跳过数", () => {
    const legacy = quizPoolFor("legacy", true);
    expect(legacy.pool).toEqual(QUIZ_QUESTIONS);
    expect(legacy.listeningTotal).toBe(0);
    expect(quizPoolFor(undefined, true).pool).toEqual(QUIZ_QUESTIONS);

    const deaf = quizPoolFor("p7", false);
    expect(deaf.pool).toEqual(QUIZ_QUESTIONS);
    expect(deaf.listeningTotal).toBe(LISTENING_QUIZ.length);
    expect(deaf.pool.some((question) => question.requiresAudio)).toBe(false);

    const full = quizPoolFor("p7", true);
    expect(full.pool).toHaveLength(QUIZ_QUESTIONS.length + LISTENING_QUIZ.length);
    expect(full.listeningTotal).toBe(LISTENING_QUIZ.length);
    for (const question of LISTENING_QUIZ) {
      expect(question.requiresAudio).toBe(true);
      expect(question.audio?.length).toBeGreaterThan(0);
      // 选项唯一、答案存在（听音题不许出现「两个都对」）
      expect(new Set(question.options).size).toBe(question.options.length);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(question.options.length);
    }
  });

  test("引擎抽题：有音色才可能出听音题；无音色时如实计入 listeningSkipped", () => {
    const withVoice = engineFor({ ruleset: "p7" });
    withVoice.quizVoiceAvailable = () => true;
    withVoice.startQuiz("quiz-1");
    expect(withVoice.state.quiz!.listeningSkipped).toBe(0);

    const noVoice = engineFor({ ruleset: "p7" });
    noVoice.quizVoiceAvailable = () => false;
    noVoice.startQuiz("quiz-1");
    expect(noVoice.state.quiz!.listeningCount).toBe(0);
    expect(noVoice.state.quiz!.listeningSkipped).toBe(LISTENING_QUIZ.length);
    expect(noVoice.state.quiz!.questions.every((question) => !question.requiresAudio)).toBe(true);

    // 同种子同能力 = 同题（设备能力差异只影响池，不影响确定性）
    const repeat = engineFor({ ruleset: "p7" });
    repeat.quizVoiceAvailable = () => true;
    repeat.startQuiz("quiz-1");
    expect(repeat.state.quiz!.questions.map((question) => question.id)).toEqual(
      withVoice.state.quiz!.questions.map((question) => question.id)
    );
  });
});

describe("P13 奖励不出售强度", () => {
  test("词林数据里没有任何战斗字段（白名单锁定）", () => {
    const entries = wordbookEntries(null, { skills: ALL_SKILLS.map((s) => s.id), events: [] });
    const payload = JSON.stringify({ entries, progress: wordbookProgress(entries) });
    for (const banned of [
      "power",
      "damage",
      "hp",
      "maxHp",
      "energy",
      "cost",
      "multiplier",
      "effect",
      "relic",
      "deck"
    ]) {
      expect(payload).not.toContain(`"${banned}"`);
    }
  });
});
