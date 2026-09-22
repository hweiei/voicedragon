/**
 * P17 词海内容契约（docs/P17-LEXICON-PLAN.md §3）：
 * 1. 全库 269 技能；P17 每句粤拼逐字可解析（音节数=字数）、无空文案；id 全局唯一；
 * 2. 池门控：lexiconVersion 缺省 = 既有池逐位不变（零漂移）；开启 = 每幕累计并入；
 * 3. 题池合并：+80 文字题（不依赖 TTS），四种版本组合的池大小精确锁定；
 * 4. 切磋码版本束：lexicon 字段（l）往返恒等；旧码无字段 = 旧池局。
 */

import { describe, expect, test } from "vitest";
import { decodeChallenge, encodeChallenge } from "../../src/core/challenge";
import { ALL_SKILLS, lookupSkill, skillsFor } from "../../src/core/content";
import { quizPoolFor } from "../../src/core/content/listening";
import { P17_QUIZ, P17_SKILLS, freshLexiconSkills } from "../../src/core/content/p17";
import { GameEngine } from "../../src/core/engine";
import { parseJyutpingTones } from "../../src/core/tone";

describe("P17 词海内容契约", () => {
  test("全库 269 技能；P17 220 句粤拼音节数=字数、无空文案；id 全局唯一", () => {
    expect(ALL_SKILLS).toHaveLength(269);
    const ids = ALL_SKILLS.map((skill) => skill.id);
    expect(new Set(ids).size).toBe(ids.length);
    let count = 0;
    for (const act of [1, 2, 3] as const) {
      for (const skill of P17_SKILLS[act]) {
        expect(parseJyutpingTones(skill.jyutping)).toHaveLength([...skill.phrase].length);
        expect(skill.lesson.length).toBeGreaterThan(0);
        expect(skill.alternatives.length).toBeGreaterThan(0);
        expect(skill.description).toContain("{power}");
        count += 1;
      }
    }
    expect(count).toBe(220);
  });

  test("池门控：lexicon 缺省 = 旧池逐位不变；开启 = 每幕累计并入（220 句）", () => {
    // 旧池（P16 末快照）：counter 0/1、签名技路径的规模全部不变
    expect([1, 2, 3].map((act) => skillsFor(act, "p7").length)).toEqual([18, 30, 42]);
    expect([1, 2, 3].map((act) => skillsFor(act, "p7", 1).length)).toEqual([19, 31, 43]);
    expect([1, 2, 3].map((act) => skillsFor(act, "p7", 1, "faa-daan").length)).toEqual([
      20, 32, 44
    ]);
    // 词海局（counter + 签名 + lexicon）：act1 = 18+73+1+1 = 93（累计制）
    expect([1, 2, 3].map((act) => skillsFor(act, "p7", 1, "faa-daan", 1).length)).toEqual([
      93, 179, 264
    ]);
    // P17 内容只在显式开启时可获取
    expect(skillsFor(3, "p7", 1, "faa-daan").some((skill) => skill.id.startsWith("p17-"))).toBe(
      false
    );
    expect(skillsFor(1, "p7", 1, undefined, 1).some((skill) => skill.id.startsWith("p17-"))).toBe(
      true
    );
    // 图鉴/练习场视图收录（ALL_SKILLS 聚合）
    expect(lookupSkill("p17-nei5-hou2")?.phrase).toBe("你好");
  });

  test("题池：lexicon 缺省 76 不变；开启 +80 文字题（不依赖 TTS）", () => {
    expect(quizPoolFor("p7", true, 1).pool.length).toBe(76);
    expect(quizPoolFor("p7", true, 1, 1).pool.length).toBe(156);
    expect(quizPoolFor("p7", false, 1, 1).pool.length).toBe(126);
    expect(quizPoolFor("p7", true).pool.length).toBe(46);
    expect(quizPoolFor("legacy", true, 1, 1).pool.length).toBe(16);
    for (const question of P17_QUIZ) {
      expect(question.requiresAudio).toBeUndefined();
      expect(question.audio).toBeUndefined();
      expect(question.options.length).toBe(4);
      expect(question.explain.length).toBeGreaterThan(4);
    }
  });

  test("切磋码版本束：lexicon（字段 l）往返恒等；旧码无字段 = 旧池局", () => {
    const encoded = encodeChallenge({
      mode: "campaign",
      act: 2,
      seed: 424242,
      ruleset: "p7",
      build: 1,
      lexicon: 1
    });
    expect(encoded.ok).toBe(true);
    if (encoded.ok) {
      const decoded = decodeChallenge(encoded.code);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(decoded.challenge.lexicon).toBe(1);
    }
    const old = encodeChallenge({ mode: "campaign", act: 1, seed: 7, ruleset: "p7" });
    expect(old.ok).toBe(true);
    if (old.ok) {
      const decoded = decodeChallenge(old.code);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(decoded.challenge.lexicon).toBeUndefined();
    }
  });

  test("旧规则局零接触：legacy/无版本调用不接触 P17 内容", () => {
    expect(skillsFor(1, "legacy", 1, "faa-daan", 1).some((s) => s.id.startsWith("p17-"))).toBe(
      false
    );
    expect(skillsFor(3).some((s) => s.id.startsWith("p17-"))).toBe(false);
  });

  /** 词海局速胜到奖励屏（同种子可重放） */
  function lexiconBattle(seed: number): GameEngine {
    const engine = new GameEngine();
    engine.startCampaign({ act: 1, seed, ruleset: "p7", lexiconVersion: 1 });
    engine.chooseFloorOption(engine.state.floorOptions[0].id);
    engine.state.combat!.enemy.hp = 1;
    engine.resolveSkill("ding-ngang-soeng", 100);
    return engine;
  }

  test("奖励三选一保底 1 张本局未学过的词海句（学习密度；同种子同奖励）", () => {
    const engine = lexiconBattle(20260923);
    const deck = engine.state.player!.deck;
    const choices = engine.state.reward!.choices;
    expect(choices).toHaveLength(3);
    expect(choices.some((id) => id.startsWith("p17-") && !deck.includes(id))).toBe(true);
    // 确定性契约：同种子重放，奖励逐位一致
    expect(lexiconBattle(20260923).state.reward!.choices).toEqual(choices);
    // 学掉保底句后，下一场仍保底（fresh 随牌组收缩）
    engine.chooseReward();
    const second = new GameEngine();
    second.startCampaign({ act: 1, seed: 77, ruleset: "p7", lexiconVersion: 1 });
    second.chooseFloorOption(second.state.floorOptions[0].id);
    second.state.combat!.enemy.hp = 1;
    second.resolveSkill("ding-ngang-soeng", 100);
    const deck2 = second.state.player!.deck;
    expect(
      second.state.reward!.choices.some((id) => id.startsWith("p17-") && !deck2.includes(id))
    ).toBe(true);
  });

  test("freshLexiconSkills 纯规则：只筛词海句、排除已入牌组", () => {
    const pool = skillsFor(1, "p7", 1, undefined, 1);
    const fresh = freshLexiconSkills(pool, []);
    expect(fresh).toHaveLength(73); // 幕1 词海句全量
    expect(fresh.every((skill) => skill.id.startsWith("p17-"))).toBe(true);
    const one = fresh[0].id;
    expect(freshLexiconSkills(pool, [one]).some((skill) => skill.id === one)).toBe(false);
    expect(freshLexiconSkills(pool, [one]).length).toBe(72);
  });
});
