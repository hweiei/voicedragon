/**
 * P17 词海 · 扩容内容聚合（docs/P17-LEXICON-PLAN.md）。
 * 版本门控 lexiconVersion=1；三幕短句累计入池（同 EXPANSION_SKILLS 惯例），
 * 题池合并见 quizPoolFor。基础表与既有 EXPANSION 只读。
 */
import type { QuizQuestion, Skill } from "../../data";
import { P17_SKILLS_ACT1 } from "./act1";
import { P17_SKILLS_ACT2 } from "./act2";
import { P17_SKILLS_ACT3 } from "./act3";
import { P17_QUIZ } from "./quiz";

export const P17_SKILLS: Record<number, Skill[]> = {
  1: P17_SKILLS_ACT1,
  2: P17_SKILLS_ACT2,
  3: P17_SKILLS_ACT3
};

export { P17_QUIZ };
