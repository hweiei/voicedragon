/**
 * P13 辨音小考（核心层，纯函数）：感知通道的题库与出题规则。
 *
 * 两类题，全部可溯源、不编造语言事实：
 * - pair：策展最小对立对（声母/韵母/声调对立）——选项都是**真实存在的粤语词**；
 * - phrase：游戏短语派生——题干是玩家见过的短句，选项是「正确粤拼 + 只改一个音节调号的变体」，
 *   考的是**调感**，答案唯一，干扰项与原句恰好差一个调。
 *
 * 出题不消耗引擎 RNG：选句与改调位置由 id/散列的确定性规则决定（同输入必同题）。
 */

import { ALL_SKILLS, lookupSkill } from "./content";
import type { Skill } from "./data";
import { parseJyutpingTones } from "./tone";

export type ListeningContrast = "tone" | "initial" | "final";

export interface ListeningOption {
  /** 选项文本（汉字 + 粤拼；短语派生题只有粤拼，避免剧透答案的调号） */
  label: string;
  jyutping: string;
  correct: boolean;
}

export interface ListeningQuestion {
  id: string;
  kind: "pair" | "phrase";
  contrast: ListeningContrast;
  /** TTS 要念的汉字（题面） */
  audio: string;
  /** 题目提示（不含答案信息） */
  prompt: string;
  /** 答对后的解释 */
  explain: string;
  options: ListeningOption[];
  answerIndex: number;
  /** 可回链到错词本产出队列的技能 id；策展对话题没有则为 undefined */
  skillId?: string;
}

// ─── 策展最小对立对（语言事实核对过的真实词） ────────────────────────────────

export interface MinimalPair {
  id: string;
  contrast: ListeningContrast;
  /** 四个一起考的候选词（同一音节框架的不同声调/声母/韵母） */
  words: { word: string; jyutping: string; hint: string }[];
}

export const MINIMAL_PAIRS: readonly MinimalPair[] = [
  {
    id: "mp-si-tones",
    contrast: "tone",
    words: [
      { word: "诗", jyutping: "si1", hint: "第一声，高平" },
      { word: "史", jyutping: "si2", hint: "第二声，高升" },
      { word: "试", jyutping: "si3", hint: "第三声，中平" },
      { word: "时", jyutping: "si4", hint: "第四声，低降" }
    ]
  },
  {
    id: "mp-si-lower",
    contrast: "tone",
    words: [
      { word: "时", jyutping: "si4", hint: "第四声，低降" },
      { word: "市", jyutping: "si5", hint: "第五声，低升" },
      { word: "事", jyutping: "si6", hint: "第六声，低平" },
      { word: "诗", jyutping: "si1", hint: "第一声，高平" }
    ]
  },
  {
    id: "mp-saam-sam",
    contrast: "final",
    words: [
      { word: "三", jyutping: "saam1", hint: "长 aa" },
      { word: "心", jyutping: "sam1", hint: "短 a" },
      { word: "衫", jyutping: "saam1", hint: "与「三」同音" },
      { word: "深", jyutping: "sam1", hint: "与「心」同音" }
    ]
  },
  {
    id: "mp-san-sang",
    contrast: "final",
    words: [
      { word: "新", jyutping: "san1", hint: "前鼻音 -n" },
      { word: "生", jyutping: "sang1", hint: "后鼻音 -ng" },
      { word: "身", jyutping: "san1", hint: "与「新」同音" },
      { word: "甥", jyutping: "sang1", hint: "与「生」同音" }
    ]
  },
  {
    id: "mp-nei-lei",
    contrast: "initial",
    words: [
      { word: "你", jyutping: "nei5", hint: "n- 声母" },
      { word: "李", jyutping: "lei5", hint: "l- 声母" },
      { word: "泥", jyutping: "nai4", hint: "n- + 不同韵腹" },
      { word: "犁", jyutping: "lai4", hint: "l- + 不同韵腹" }
    ]
  },
  {
    id: "mp-jat-jat",
    contrast: "tone",
    words: [
      { word: "一", jyutping: "jat1", hint: "第一声，入声短促" },
      { word: "日", jyutping: "jat6", hint: "第六声，入声低沉" },
      { word: "逸", jyutping: "jat6", hint: "与「日」同音" },
      { word: "壹", jyutping: "jat1", hint: "与「一」同音" }
    ]
  }
];

/** 每一对里可考的「正确朗读」候选：words[0] / words[2] 为两个不同读音。 */
function pairReadingChoices(pair: MinimalPair): { word: string; jyutping: string; hint: string }[] {
  const distinct: { word: string; jyutping: string; hint: string }[] = [];
  for (const entry of pair.words) {
    if (!distinct.some((seen) => seen.jyutping === entry.jyutping)) distinct.push(entry);
  }
  return distinct;
}

/** 策展对话题：每对生成「念 A 选 A」的题（题面只给汉字，选项给汉字+粤拼）。 */
function pairQuestions(): ListeningQuestion[] {
  const questions: ListeningQuestion[] = [];
  for (const pair of MINIMAL_PAIRS) {
    const choices = pairReadingChoices(pair);
    if (choices.length < 2) continue;
    for (const target of choices) {
      // 同音的其它字作为「正确项的别名」不参与；干扰项 = 该对里其它读音
      const distractors = choices.filter((entry) => entry.jyutping !== target.jyutping);
      const built: ListeningOption[] = [
        { label: `${target.word} · ${target.jyutping}`, jyutping: target.jyutping, correct: true },
        ...distractors.map((entry) => ({
          label: `${entry.word} · ${entry.jyutping}`,
          jyutping: entry.jyutping,
          correct: false
        }))
      ];
      // 位置由稳定散列决定：正确答案不会永远落在第一项
      const rotation = stableHash(`${pair.id}:${target.jyutping}`) % built.length;
      const options = [...built.slice(rotation), ...built.slice(0, rotation)];
      questions.push({
        id: `${pair.id}-${target.jyutping}`,
        kind: "pair",
        contrast: pair.contrast,
        audio: target.word,
        prompt: `听音辨字：刚才念的是哪一个？（${pair.contrast === "tone" ? "声调对立" : pair.contrast === "initial" ? "声母对立" : "韵母对立"}）`,
        explain: `「${target.word}」读 ${target.jyutping}（${target.hint}）。同组其它读音：${distractors
          .map((entry) => `${entry.word} ${entry.jyutping}`)
          .join("、")}。`,
        options,
        answerIndex: options.findIndex((option) => option.correct)
      });
    }
  }
  return questions;
}

// ─── 游戏短语派生题（声调对立） ──────────────────────────────────────────────

/** 用 id 派生的稳定整数（FNV-1a），不消耗引擎 RNG。 */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 缺省干扰调：给定期望调挑一个「最容易混」的替代调（先低平后高平）。 */
const CONFUSABLE_TONES: Record<number, number> = {
  1: 3,
  2: 5,
  3: 1,
  4: 6,
  5: 2,
  6: 4
};

function replaceTone(jyutping: string, syllableIndex: number, tone: number): string | null {
  const syllables = [...jyutping.matchAll(/[a-z]{1,10}?[1-6](?![0-9])/g)];
  if (syllableIndex < 0 || syllableIndex >= syllables.length) return null;
  const match = syllables[syllableIndex];
  const replaced = `${match[0].slice(0, -1)}${tone}`;
  const start = match.index ?? 0;
  return `${jyutping.slice(0, start)}${replaced}${jyutping.slice(start + match[0].length)}`;
}

/**
 * 由一条短语派生一道声调题：题面念整句，选项是 4 条粤拼（正确 + 3 个改调变体）。
 * 改调的候选按稳定散列挑选，确保同一句每次生成同一题。
 */
export function listeningQuestionFromPhrase(
  skill: Skill,
  variantSeed = 0
): ListeningQuestion | null {
  const tones = parseJyutpingTones(skill.jyutping);
  if (tones.length < 1) return null;
  const hash = (stableHash(skill.id) + variantSeed) >>> 0;
  const syllableIndex = hash % tones.length;
  const baseTone = tones[syllableIndex];
  const used = new Set<number>([baseTone]);
  const variants: string[] = [];
  const candidates = [CONFUSABLE_TONES[baseTone], 6, 5, 4, 3, 2, 1].filter(
    (tone) => tone >= 1 && tone <= 6
  );
  for (const tone of candidates) {
    if (variants.length >= 3) break;
    if (used.has(tone)) continue;
    const variant = replaceTone(skill.jyutping, syllableIndex, tone);
    if (!variant || variant === skill.jyutping) continue;
    used.add(tone);
    variants.push(variant);
  }
  if (variants.length < 3) return null;
  const options: ListeningOption[] = [
    { label: skill.jyutping, jyutping: skill.jyutping, correct: true },
    ...variants.map((variant) => ({ label: variant, jyutping: variant, correct: false }))
    // 位置由散列决定，避免「答案永远第一项」
  ];
  const rotation = hash % options.length;
  const rotated = [...options.slice(rotation), ...options.slice(0, rotation)];
  return {
    id: `lp-${skill.id}-${syllableIndex}`,
    kind: "phrase",
    contrast: "tone",
    audio: skill.phrase,
    prompt: `听音辨调：「${skill.phrase}」的第 ${syllableIndex + 1} 个音节是哪一声？`,
    explain: `「${skill.phrase}」读 ${skill.jyutping}，其中第 ${syllableIndex + 1} 个音节为第 ${baseTone} 声。这句的意思是「${skill.lesson}」。`,
    options: rotated,
    answerIndex: rotated.findIndex((option) => option.correct),
    skillId: skill.id
  };
}

/** 全部短语派生题（一首句一题，确定性顺序）。 */
export function phraseQuestions(): ListeningQuestion[] {
  const questions: ListeningQuestion[] = [];
  for (const skill of ALL_SKILLS) {
    const question = listeningQuestionFromPhrase(skill);
    if (question) questions.push(question);
  }
  return questions;
}

/**
 * 建池：**优先玩家已收录/练过的短语**（学以致用），其后补齐其余短语题与策展对话题。
 * 同一输入必得同一池（纯函数，无随机）。
 */
export function listeningPoolFor(seenIds: readonly string[] = [], limit = 24): ListeningQuestion[] {
  const seen = new Set(seenIds);
  const phrase = phraseQuestions();
  const preferred = phrase.filter((question) => question.skillId && seen.has(question.skillId));
  const rest = phrase.filter((question) => !question.skillId || !seen.has(question.skillId));
  const pairs = pairQuestions();
  return [...preferred, ...pairs, ...rest].slice(0, Math.max(1, limit));
}

/** 单题判定：返回是否答对与正确项下标。 */
export function judgeListening(question: ListeningQuestion, optionIndex: number): boolean {
  return optionIndex === question.answerIndex;
}

export interface ListeningSession {
  attempts: number;
  correct: number;
  /** 错题回链的技能 id（去重，供错词本入队） */
  missedSkillIds: string[];
}

export function emptyListeningSession(): ListeningSession {
  return { attempts: 0, correct: 0, missedSkillIds: [] };
}

export function applyListeningResult(
  session: ListeningSession,
  question: ListeningQuestion,
  correct: boolean
): ListeningSession {
  session.attempts += 1;
  if (correct) session.correct += 1;
  else if (question.skillId && !session.missedSkillIds.includes(question.skillId)) {
    session.missedSkillIds.push(question.skillId);
  }
  return session;
}

/** 供 UI 展示的一句话摘要（不夸大：只是本次会话的计数）。 */
export function listeningSessionSummary(session: ListeningSession): string {
  if (!session.attempts) return "本轮还没作答";
  const rate = Math.round((session.correct / session.attempts) * 100);
  return `本轮听辨 ${session.correct}/${session.attempts}（${rate}%）${session.missedSkillIds.length ? ` · ${session.missedSkillIds.length} 句已进错词本` : ""}`;
}

/** 短语题回链：给 UI 用的技能查找（找不到返回 null，不抛异常）。 */
export function skillOfQuestion(question: ListeningQuestion): Skill | null {
  return question.skillId ? (lookupSkill(question.skillId) ?? null) : null;
}
