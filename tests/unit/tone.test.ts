/**
 * P3 声调引擎单测：粤拼解析、合成轮廓评分、鲁棒回退、合成权重。
 * 合成轮廓构造：按目标调型曲线生成“理想中的说话人 F0”（基频 = 150Hz × 2^(半音/12)），
 * 验证完美发挥高分、错调显著降分、噪声/无声返回 null。
 */

import { describe, expect, test } from "vitest";
import { SCORING_WEIGHTS } from "../../src/core/config/balance";
import { composeFinalScore, scorePronunciation } from "../../src/core/scoring";
import {
  type PitchFrame,
  dtwDistance,
  expectedToneGuides,
  parseJyutpingTones,
  previewTemplateCurve,
  scoreToneContour,
  templateCurve
} from "../../src/core/tone";

/** 由调型序列合成 F0 帧流（频率取模板半音 + 常量说话人偏移）。 */
function synthFrames(
  tones: number[],
  opts: { baseHz?: number; syllableMs?: number; clarity?: number } = {}
): PitchFrame[] {
  const baseHz = opts.baseHz ?? 160;
  const syllableMs = opts.syllableMs ?? 260;
  const clarity = opts.clarity ?? 0.95;
  const perSyllable = 26; // 10ms 步进
  const curve = templateCurve(tones, perSyllable);
  const frames: PitchFrame[] = [];
  curve.forEach((semitone, index) => {
    frames.push({
      t: (index * (syllableMs / perSyllable)) / 1000,
      freq: baseHz * 2 ** (semitone / 12),
      clarity,
      rms: 0.2
    });
  });
  return frames;
}

describe("jyutping tone parsing", () => {
  test("extracts tone numbers per syllable", () => {
    expect(parseJyutpingTones("ding2 ngaang6 soeng6")).toEqual([2, 6, 6]);
    expect(parseJyutpingTones("m4 sai2 geng1")).toEqual([4, 2, 1]);
    expect(parseJyutpingTones("gaa1 jau4")).toEqual([1, 4]);
    expect(parseJyutpingTones("jat1 cai4 soeng6")).toEqual([1, 4, 6]);
    expect(parseJyutpingTones("mou5 man6 tai4")).toEqual([5, 6, 4]);
  });

  test("non-jyutping strings yield no tones", () => {
    expect(parseJyutpingTones("")).toEqual([]);
    expect(parseJyutpingTones("hello world")).toEqual([]);
    expect(parseJyutpingTones("顶硬上")).toEqual([]);
  });
});

describe("tone scoring on synthetic contours", () => {
  test("perfect tone production scores high, deterministically", () => {
    const jyutping = "ding2 ngaang6 soeng6";
    const frames = synthFrames([2, 6, 6]);
    const first = scoreToneContour(frames, jyutping)!;
    const second = scoreToneContour(frames, jyutping)!;
    expect(first.score).toBeGreaterThanOrEqual(85);
    expect(first).toEqual(second); // 双通道评分回放一致
    expect(first.expectedTones).toEqual([2, 6, 6]);
    expect(first.perSyllable).toHaveLength(3);
    expect(first.userCurve).toHaveLength(first.template.length);
  });

  test("mixed six-tone utterance also scores high (median alignment works)", () => {
    const frames = synthFrames([1, 2, 3, 4, 5, 6]);
    const result = scoreToneContour(frames, "a1 a2 a3 a4 a5 a6")!;
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  test("wrong tones lose points in proportion to severity", () => {
    const jyutping = "ding2 ngaang6 soeng6";
    const perfect = scoreToneContour(synthFrames([2, 6, 6]), jyutping)!.score;
    // 全程高平调（1 1 1）对期望 (2 6 6)——错一个音节族
    const flat = scoreToneContour(synthFrames([1, 1, 1]), jyutping)!.score;
    expect(flat).toBeLessThan(perfect - 20);
    // 升降完全颠倒 (4 1 2)——应重罚
    const inverted = scoreToneContour(synthFrames([4, 1, 2]), jyutping)!.score;
    expect(inverted).toBeLessThanOrEqual(flat);
    expect(inverted).toBeLessThan(70);
  });

  test("same tones in a different voice pitch still score high (speaker independence)", () => {
    const jyutping = "gaa1 jau4";
    const bass = scoreToneContour(synthFrames([1, 4], { baseHz: 90 }), jyutping)!.score;
    const soprano = scoreToneContour(synthFrames([1, 4], { baseHz: 260 }), jyutping)!.score;
    expect(bass).toBeGreaterThanOrEqual(85);
    expect(soprano).toBeGreaterThanOrEqual(85);
  });

  test("noise / silence / missing jyutping fall back to null", () => {
    expect(scoreToneContour([], "ding2 ngaang6 soeng6")).toBeNull();
    expect(scoreToneContour(synthFrames([2, 6, 6]), "")).toBeNull();
    const noisy = synthFrames([2, 6, 6], { clarity: 0.1 });
    expect(scoreToneContour(noisy, "ding2 ngaang6 soeng6")).toBeNull();
    const tooShort = synthFrames([2, 6, 6], { syllableMs: 50 });
    expect(scoreToneContour(tooShort, "ding2 ngaang6 soeng6")).toBeNull();
  });

  test("dtwDistance is zero for identical curves", () => {
    expect(dtwDistance([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(dtwDistance([0, 0, 5], [0, 5, 5])).toBeLessThan(2);
  });
});

describe("practice-mode helpers", () => {
  test("previewTemplateCurve is median-aligned and syllable-proportional", () => {
    const curve = previewTemplateCurve("ding2 ngaang6 soeng6")!;
    expect(curve).not.toBeNull();
    expect(curve.length).toBeGreaterThanOrEqual(60);
    const sorted = [...curve].sort((a, b) => a - b);
    expect(Math.abs(sorted[Math.floor(sorted.length / 2)])).toBeLessThan(0.8);
    expect(previewTemplateCurve("顶硬上")).toBeNull();
  });

  test("expectedToneGuides annotates every syllable", () => {
    const guides = expectedToneGuides("m4 sai2 geng1");
    expect(guides).toHaveLength(3);
    expect(guides[0].tone).toBe(4);
    expect(guides[0].name).toBe("低降");
    expect(guides.every((guide) => guide.hint.length > 3)).toBe(true);
  });
});

describe("score composition (P3 双通道)", () => {
  test("null tone score keeps V1 behaviour exactly", () => {
    const v1 = scorePronunciation(["顶硬上"], "頂硬上！", 0.9).score;
    expect(composeFinalScore(v1, null, 0.4)).toBe(v1);
    expect(composeFinalScore(v1, undefined, 0.4)).toBe(v1);
  });

  test("tone-weighted blend follows 60/40 default", () => {
    // 字准 90、调准 60、权重 0.4 → 90*0.6 + 60*0.4 = 78
    expect(composeFinalScore(90, 60, 0.4)).toBe(78);
    // 权重 0（设置页可调）→ 纯字准
    expect(composeFinalScore(90, 60, 0)).toBe(90);
    // 权重上限保护（≤0.8）
    expect(composeFinalScore(90, 0, 1)).toBe(Math.round(90 * 0.2));
  });

  test("SCORING_WEIGHTS (V1) untouched by P3", () => {
    expect(SCORING_WEIGHTS.text).toBe(0.76);
    expect(SCORING_WEIGHTS.confidence).toBe(0.24);
    expect(SCORING_WEIGHTS.tone).toBe(0);
  });
});
