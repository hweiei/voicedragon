/**
 * P13 听辨题库（纯函数层）：策展词表自证、派生题唯一答案、池确定性、会话统计。
 * 题池与音色门控见 ../contract/p13-wordbook.test.ts；UI 流程见 ../e2e/p13.spec.ts。
 */

import { describe, expect, test } from "vitest";
import { ALL_SKILLS } from "../../src/core/content";
import {
  MINIMAL_PAIRS,
  applyListeningResult,
  emptyListeningSession,
  judgeListening,
  listeningPoolFor,
  listeningQuestionFromPhrase,
  listeningSessionSummary,
  phraseQuestions,
  skillOfQuestion
} from "../../src/core/listening";
import { parseJyutpingTones } from "../../src/core/tone";

/** 只比较音节的「声母韵母」部分（用于断言干扰项只差一个声调）。 */
function toneStripped(jyutping: string): string {
  return jyutping
    .split(/\s+/)
    .map((syllable) => syllable.replace(/[1-6]$/, ""))
    .join(" ");
}

describe("P13 策展最小对立对", () => {
  test("每组至少两个可考读音，读音互不重复，提示都有实义", () => {
    expect(MINIMAL_PAIRS.length).toBeGreaterThanOrEqual(6);
    for (const pair of MINIMAL_PAIRS) {
      const distinct = [...new Set(pair.words.map((word) => word.jyutping))];
      expect(distinct.length).toBeGreaterThanOrEqual(2);
      for (const word of pair.words) {
        expect(word.word.length).toBeGreaterThan(0);
        expect(word.hint.length).toBeGreaterThan(0);
        expect(parseJyutpingTones(word.jyutping).length).toBe(
          1 + (word.jyutping.includes(" ") ? 1 : 0)
        );
      }
    }
  });

  test("同音别名不算答题选项：每对生成的题都有唯一正确项", () => {
    const pool = listeningPoolFor([], 24);
    const pairs = pool.filter((question) => question.kind === "pair");
    expect(pairs.length).toBeGreaterThan(0);
    for (const question of pairs) {
      const corrects = question.options.filter((option) => option.correct);
      expect(corrects).toHaveLength(1);
      expect(question.answerIndex).toBe(question.options.indexOf(corrects[0]));
      expect(new Set(question.options.map((option) => option.jyutping)).size).toBe(
        question.options.length
      );
      expect(judgeListening(question, question.answerIndex)).toBe(true);
      for (let index = 0; index < question.options.length; index += 1) {
        if (index !== question.answerIndex) expect(judgeListening(question, index)).toBe(false);
      }
    }
  });
});

describe("P13 短语派生题", () => {
  test("整句听辨：选项音节数与答案一致，且每题只差一个声调", () => {
    const questions = phraseQuestions();
    expect(questions.length).toBe(ALL_SKILLS.length);
    for (const question of questions) {
      expect(question.kind).toBe("phrase");
      expect(question.skillId).toBeTruthy();
      expect(question.options).toHaveLength(4);
      const answer = question.options[question.answerIndex];
      expect(answer.correct).toBe(true);
      const skill = skillOfQuestion(question);
      expect(skill?.phrase).toBe(question.audio);
      const answerSyllables = answer.jyutping.split(/\s+/);
      for (const option of question.options) {
        expect(option.jyutping.split(/\s+/)).toHaveLength(answerSyllables.length);
      }
      for (const option of question.options) {
        if (option.correct) continue;
        // 声韵框架完全相同 → 差异只可能来自声调
        expect(toneStripped(option.jyutping)).toBe(toneStripped(answer.jyutping));
        const differing = option.jyutping
          .split(/\s+/)
          .filter((syllable, index) => syllable !== answerSyllables[index]);
        expect(differing).toHaveLength(1);
      }
    }
  });

  test("同句同题：位置由稳定散列决定，答案不会永远是第一项", () => {
    const first = listeningQuestionFromPhrase(ALL_SKILLS[0]);
    const again = listeningQuestionFromPhrase(ALL_SKILLS[0]);
    expect(again).toEqual(first);
    const positions = new Set(phraseQuestions().map((question) => question.answerIndex));
    expect(positions.size).toBeGreaterThan(1);
  });

  test("无法派生（音节不足）时返回 null，不硬造题", () => {
    expect(
      listeningQuestionFromPhrase({
        id: "x",
        name: "x",
        phrase: "x",
        jyutping: "",
        lesson: "",
        cost: 1,
        power: 1,
        type: "attack"
      } as never)
    ).toBeNull();
  });
});

describe("P13 题池与会话", () => {
  test("池确定性：同输入同输出，且已收录的句子优先", () => {
    const seen = [ALL_SKILLS[ALL_SKILLS.length - 1].id];
    const pool = listeningPoolFor(seen, 24);
    expect(listeningPoolFor(seen, 24)).toEqual(pool);
    expect(pool[0].skillId).toBe(seen[0]);
    expect(pool.every((question) => question.options.length >= 2)).toBe(true);
  });

  test("会话统计：答对计数、错题回链去重、摘要如实（不夸大）", () => {
    const session = emptyListeningSession();
    const [first, second] = phraseQuestions();
    applyListeningResult(session, first, false);
    applyListeningResult(session, first, false);
    applyListeningResult(session, second, true);
    expect(session.attempts).toBe(3);
    expect(session.correct).toBe(1);
    expect(session.missedSkillIds).toEqual([first.skillId]);
    expect(listeningSessionSummary(session)).toBe("本轮听辨 1/3（33%） · 1 句已进错词本");
    expect(listeningSessionSummary(emptyListeningSession())).toBe("本轮还没作答");
  });
});
