/**
 * P8-C 语音教练（纯函数）：把音节级调准元数据翻译为保守、可执行的下一步建议。
 * 不改变评分，只解释已有结果；无 F0 或数组不完整时明确回退字准反馈。
 */

import { TONE_TEMPLATES } from "./tone";
import type { ToneScoreDetail } from "./tone";

export type ToneCoachLevel = "steady" | "close" | "focus";

export interface JyutpingSyllable {
  text: string;
  tone: number;
}

export interface SyllableCoach extends JyutpingSyllable {
  index: number;
  score: number;
  detectedTone: number;
  level: ToneCoachLevel;
  levelLabel: "稳" | "将稳" | "重点练";
  isFocus: boolean;
}

export interface VoiceCoach {
  hasToneData: boolean;
  syllables: SyllableCoach[];
  focus: SyllableCoach | null;
  headline: string;
  advice: string;
}

/** 只接收带 1–6 调号的粤拼 token，顺序与调型评分一致。 */
export function parseJyutpingSyllables(jyutping = ""): JyutpingSyllable[] {
  return jyutping
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((text) => ({ text, match: text.match(/([1-6])(?!\d)/) }))
    .filter((part): part is { text: string; match: RegExpMatchArray } => Boolean(part.match))
    .map(({ text, match }) => ({ text, tone: Number(match[1]) }));
}

function levelFor(score: number): Pick<SyllableCoach, "level" | "levelLabel"> {
  if (score >= 85) return { level: "steady", levelLabel: "稳" };
  if (score >= 65) return { level: "close", levelLabel: "将稳" };
  return { level: "focus", levelLabel: "重点练" };
}

function noToneCoach(wordScore: number): VoiceCoach {
  const weakWord = wordScore < 65;
  return {
    hasToneData: false,
    syllables: [],
    focus: null,
    headline: weakWord ? "先把每个字说清" : "本次只有字准数据",
    advice: weakWord
      ? `字准 ${Math.round(wordScore)} 分：放慢一点，逐字读完整，再连成短句。`
      : "当前引擎没有基频通道，不能可靠判断声调；可启用端侧模型后再做六调校准。"
  };
}

/**
 * 生成一次短句反馈。最低分音节为唯一焦点；同分按句中顺序，输出完全确定。
 */
export function buildVoiceCoach(
  jyutping: string,
  detail: ToneScoreDetail | null | undefined,
  wordScore: number
): VoiceCoach {
  const parsed = parseJyutpingSyllables(jyutping);
  if (
    !detail ||
    !parsed.length ||
    detail.perSyllable.length !== parsed.length ||
    detail.expectedTones.length !== parsed.length
  ) {
    return noToneCoach(wordScore);
  }

  let focusIndex = 0;
  for (let index = 1; index < detail.perSyllable.length; index += 1) {
    if (detail.perSyllable[index] < detail.perSyllable[focusIndex]) focusIndex = index;
  }

  const syllables: SyllableCoach[] = parsed.map((part, index) => {
    const expectedTone = detail.expectedTones[index] ?? part.tone;
    const score = Math.max(0, Math.min(100, Math.round(detail.perSyllable[index])));
    const detected = detail.detectedTones?.[index];
    return {
      text: part.text,
      tone: expectedTone,
      index,
      score,
      detectedTone:
        detected && detected >= 1 && detected <= 6 ? Math.round(detected) : expectedTone,
      ...levelFor(score),
      isFocus: index === focusIndex
    };
  });
  const focus = syllables[focusIndex];
  const target = TONE_TEMPLATES[focus.tone] ?? TONE_TEMPLATES[3];
  const weakWord = wordScore < 65;
  const confused = focus.detectedTone !== focus.tone;

  if (weakWord) {
    return {
      hasToneData: true,
      syllables,
      focus,
      headline: `先说清第 ${focus.index + 1} 音节「${focus.text}」`,
      advice: `字准 ${Math.round(wordScore)} 分：先慢读完整；再按 ${focus.tone} 调「${target.name}」练——${target.hint}。`
    };
  }

  if (focus.score < 85) {
    const confusion = confused
      ? `本次轮廓更接近 ${focus.detectedTone} 调「${TONE_TEMPLATES[focus.detectedTone].name}」；`
      : "";
    return {
      hasToneData: true,
      syllables,
      focus,
      headline: `下一遍盯住第 ${focus.index + 1} 音节「${focus.text}」`,
      advice: `${confusion}目标是 ${focus.tone} 调「${target.name}」：${target.hint}。`
    };
  }

  return {
    hasToneData: true,
    syllables,
    focus,
    headline: "这一句六调都已稳定",
    advice: `最低音节也有 ${focus.score} 分；保持现在的音域和节奏，再完整读一遍巩固。`
  };
}
