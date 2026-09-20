/**
 * P13 听音辨字题库（内容层）：问答节点的「听音」题型。
 *
 * 30 题 = 18 道策展最小对立对 + 12 道游戏短语声调题，全部由 core/listening 的纯函数生成，
 * 保证与练习场同源（同一份词表、同一套判定），且选项唯一答案。
 *
 * 只进 **p7 新局** 的问答池，且要求本机有粤语音色（见 quizPoolFor）：
 * 没有音色时跳过听音题，而不是用普通话音色冒充。
 */

import { QUIZ_QUESTIONS, type QuizQuestion } from "../data";
import { MINIMAL_PAIRS, listeningQuestionFromPhrase } from "../listening";
import type { ContentRuleset } from "./index";
import { ALL_SKILLS } from "./index";

/** 短语声调题的取句（固定顺序，保证题池稳定可复现）。 */
const LISTENING_PHRASE_IDS = [
  "ding-ngang-soeng",
  "m-sai-geng",
  "hou-sai-lei",
  "jat-cai-soeng",
  "zap-saang-laa",
  "gaa-jau",
  "faai-di-zau",
  "dim-gwo-luk-ze",
  "dak-haan-jam-caa",
  "jau-mou-gaau-co",
  "p10-jat-fu-dong-gwaan",
  "p10-gu-paan-saang-fai"
] as const;

function pairQuizQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const pair of MINIMAL_PAIRS) {
    const distinct: { word: string; jyutping: string; hint: string }[] = [];
    for (const entry of pair.words) {
      if (!distinct.some((seen) => seen.jyutping === entry.jyutping)) distinct.push(entry);
    }
    for (const target of distinct) {
      const distractors = distinct.filter((entry) => entry.jyutping !== target.jyutping);
      const options = [
        `${target.word} · ${target.jyutping}`,
        ...distractors.map((entry) => `${entry.word} · ${entry.jyutping}`)
      ];
      // 稳定轮转：答案不总是第一项（与练习场同一散列思路，纯函数）
      const rotation = target.jyutping.length % options.length;
      const rotated = [...options.slice(rotation), ...options.slice(0, rotation)];
      questions.push({
        id: `lq-${pair.id}-${target.jyutping}`,
        question: `听音辨字：刚才念的是哪一个？（${pair.contrast === "tone" ? "声调对立" : pair.contrast === "initial" ? "声母对立" : "韵母对立"}）`,
        options: rotated,
        answerIndex: rotated.indexOf(`${target.word} · ${target.jyutping}`),
        explain: `「${target.word}」读 ${target.jyutping}（${target.hint}）。同组还有：${distractors
          .map((entry) => `${entry.word} ${entry.jyutping}`)
          .join("、")}。`,
        audio: target.word,
        requiresAudio: true
      });
    }
  }
  return questions;
}

function phraseQuizQuestions(): QuizQuestion[] {
  const byId = new Map(ALL_SKILLS.map((skill) => [skill.id, skill]));
  const questions: QuizQuestion[] = [];
  for (const id of LISTENING_PHRASE_IDS) {
    const skill = byId.get(id);
    if (!skill) continue;
    const question = listeningQuestionFromPhrase(skill);
    if (!question) continue;
    questions.push({
      id: `lq-${question.id}`,
      question: `${question.prompt}（整句再念一次，选出正确的粤拼）`,
      options: question.options.map((option) => option.label),
      answerIndex: question.answerIndex,
      explain: question.explain,
      audio: skill.phrase,
      requiresAudio: true
    });
  }
  return questions;
}

/** 30 道听音题（18 对话题 + 12 短语题）；顺序稳定。 */
export const LISTENING_QUIZ: QuizQuestion[] = [...pairQuizQuestions(), ...phraseQuizQuestions()];

/**
 * 问答节点题池（纯函数）：
 * - legacy：基础 18 题，逐位不变；
 * - p7 + 有粤语音色：基础 + 30 听音题；
 * - p7 + 无粤语音色：基础池（听音题被跳过——诚实降级，绝不用错误音色冒充）。
 */
export function quizPoolFor(
  ruleset: ContentRuleset | undefined,
  voiceAvailable: boolean
): { pool: QuizQuestion[]; listeningTotal: number } {
  if (ruleset !== "p7") return { pool: QUIZ_QUESTIONS, listeningTotal: 0 };
  if (!voiceAvailable) return { pool: QUIZ_QUESTIONS, listeningTotal: LISTENING_QUIZ.length };
  return { pool: [...QUIZ_QUESTIONS, ...LISTENING_QUIZ], listeningTotal: LISTENING_QUIZ.length };
}
