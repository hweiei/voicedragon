/**
 * P3 声调引擎（核心层，纯函数）：粤语六调轮廓评分。
 *
 * 原理（REDESIGN-PLAN §4.2）：
 * - 技能卡自带粤拼声调数字（如 ding2 ngaang6 soeng6 → 2/6/6），映射为相对基频
 *   调型模板（高平/高升/中平/低降/低升/低平：相对中位数的半音偏移 + 斜率）；
 * - 录音得到的 F0 帧 → 过滤噪音 → 转相对半音 → 按音节数等距分段重采样；
 * - 每个音节与期望调型曲线做 DTW（动态时间规整）求距离，映射为 0–100 调准分；
 *   若期望调型不是六种调型中最接近的，追加错调惩罚；
 * - 鲁棒：浊音帧不足 / 发声过短 / 缺粤拼时返回 null，调用方回退纯字准。
 *
 * 全部确定性：同输入必同输出（双通道评分回放一致的契约基础）。
 */

import { TONE_SHAPES, TONE_TUNING } from "./config/balance";

export interface PitchFrame {
  /** 秒（相对录音起点） */
  t: number;
  /** 基频 Hz */
  freq: number;
  /** pitchy 清晰度 0–1 */
  clarity: number;
  /** 该帧能量 RMS（预留，能量门限扩展位） */
  rms: number;
}

export interface ContourPoint {
  t: number;
  /** 相对整段发声中位数的半音偏移 */
  semitone: number;
}

export interface ToneTemplate {
  name: string;
  hint: string;
  /** 相对中位数的半音中心偏移 */
  offset: number;
  /** 音节内的半音变化量（首→尾） */
  slope: number;
}

/** 粤语六调调型模板（相对轮廓；绝对音高因人而异，故以中位数归一；数值入 balance.ts）。 */
export const TONE_TEMPLATES: Record<number, ToneTemplate> = {
  1: { name: "高平", hint: "全程保持最高、平稳", ...TONE_SHAPES[1] },
  2: { name: "高升", hint: "从中位快速扬上去", ...TONE_SHAPES[2] },
  3: { name: "中平", hint: "中高、平稳不飘", ...TONE_SHAPES[3] },
  4: { name: "低降", hint: "低沉、再往下压", ...TONE_SHAPES[4] },
  5: { name: "低升", hint: "低起来慢慢扬", ...TONE_SHAPES[5] },
  6: { name: "低平", hint: "低位、平稳放松", ...TONE_SHAPES[6] }
};

/** 从粤拼串中提取声调序列：ding2 ngaang6 soeng6 → [2, 6, 6]。 */
export function parseJyutpingTones(jyutping = ""): number[] {
  const tones: number[] = [];
  for (const match of jyutping.toLowerCase().matchAll(/[a-z]{1,10}?([1-6])(?![0-9])/g)) {
    tones.push(Number(match[1]));
  }
  return tones;
}

/** 期望调型全句曲线（UI 叠图与 DTW 共用）：每音节 K 点，offset+slope 分段拼接。 */
export function templateCurve(tones: number[], pointsPerSyllable: number): number[] {
  const k = Math.max(2, pointsPerSyllable);
  const curve: number[] = [];
  for (const tone of tones) {
    const tpl = TONE_TEMPLATES[tone] ?? TONE_TEMPLATES[3];
    for (let i = 0; i < k; i += 1) {
      curve.push(tpl.offset + tpl.slope * (i / (k - 1) - 0.5));
    }
  }
  return curve;
}

/** F0 帧 → 浊音过滤 → 半音（参考 A2=110Hz）→ 中位数归一。 */
export function normalizeContour(frames: PitchFrame[]): ContourPoint[] {
  const voiced = frames.filter(
    (frame) =>
      frame.freq >= TONE_TUNING.minHz &&
      frame.freq <= TONE_TUNING.maxHz &&
      frame.clarity >= TONE_TUNING.clarityGate
  );
  if (!voiced.length) return [];
  const semitones = voiced.map((frame) => 12 * Math.log2(frame.freq / 110));
  const sorted = [...semitones].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return voiced.map((frame, index) => ({ t: frame.t, semitone: semitones[index] - median }));
}

/** 按音节数等距分段（按帧索引；等时长假设在短句上足够稳）。 */
export function splitSyllables(points: ContourPoint[], count: number): ContourPoint[][] {
  const segments: ContourPoint[][] = [];
  const n = points.length;
  for (let i = 0; i < count; i += 1) {
    const from = Math.floor((i * n) / count);
    const to = Math.floor(((i + 1) * n) / count);
    segments.push(points.slice(from, Math.max(from + 1, to)));
  }
  return segments;
}

/** 按时间轴线性插值重采样为 n 点。 */
export function resamplePoints(points: ContourPoint[], n: number): number[] {
  if (!points.length) return Array.from({ length: n }, () => 0);
  if (n <= 1) return [points[0].semitone];
  const start = points[0].t;
  const end = points[points.length - 1].t;
  const span = Math.max(1e-6, end - start);
  const out: number[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i += 1) {
    const target = start + (span * i) / (n - 1);
    while (cursor + 1 < points.length - 1 && points[cursor + 1].t < target) cursor += 1;
    const a = points[cursor];
    const b = points[Math.min(cursor + 1, points.length - 1)];
    const ratio = b.t > a.t ? (target - a.t) / (b.t - a.t) : 0;
    out.push(a.semitone + (b.semitone - a.semitone) * Math.max(0, Math.min(1, ratio)));
  }
  return out;
}

/** 经典 DTW：返回按路径长度归一的平均路径代价（单位≈半音），越小越像。 */
export function dtwDistance(a: number[], b: number[]): number {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return Number.POSITIVE_INFINITY;
  const prev = new Array<number>(m + 1).fill(Number.POSITIVE_INFINITY);
  const curr = new Array<number>(m + 1).fill(Number.POSITIVE_INFINITY);
  prev[0] = 0;
  for (let i = 1; i <= n; i += 1) {
    curr[0] = Number.POSITIVE_INFINITY;
    for (let j = 1; j <= m; j += 1) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      curr[j] = cost + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= m; j += 1) prev[j] = curr[j];
  }
  return prev[m] / Math.max(n, m);
}

export interface ToneScoreDetail {
  /** 整句调准分 0–100 */
  score: number;
  /** 每个音节各自的调准分（与 expectedTones 对齐） */
  perSyllable: number[];
  expectedTones: number[];
  /**
   * 保守的最接近调型：只有另一调型斜率显著不同且明显更接近时才与目标调不同；
   * 水平调族/相近升调不武断报错，供学习反馈而非重新计分。
   */
  detectedTones: number[];
  /** 用户实际轮廓（相对半音，重采样长曲线，供练习场绘图） */
  userCurve: number[];
  /** 期望调型曲线（与 userCurve 同长） */
  template: number[];
}

const DISPLAY_POINTS = 72;

/** 练习场预显示用：仅由粤拼生成中位数对齐的期望调型曲线（无用户轮廓时）。 */
export function previewTemplateCurve(jyutping: string, points = DISPLAY_POINTS): number[] | null {
  const tones = parseJyutpingTones(jyutping);
  if (!tones.length) return null;
  const perSyllable = Math.max(2, Math.floor(points / tones.length));
  const curve = templateCurve(tones, perSyllable).slice(0, points);
  const sorted = [...curve].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return curve.map((value) => value - median);
}

/** 练习场讲解用：每音节的声调编号 + 调型名 + 口诀。 */
export function expectedToneGuides(
  jyutping: string
): { tone: number; name: string; hint: string }[] {
  return parseJyutpingTones(jyutping).map((tone) => ({
    tone,
    name: TONE_TEMPLATES[tone].name,
    hint: TONE_TEMPLATES[tone].hint
  }));
}

/** 单音节评分：与期望调型 DTW → 距离映射分数；显著更优的其它调型存在时才罚错调。
 *  模板与用户轮廓各自以“整句中位数”对齐（说话人音域无关）。 */
function scoreSegment(
  segment: ContourPoint[],
  expectedTone: number,
  templateMedian: number
): { score: number; detectedTone: number } {
  const user = resamplePoints(segment, TONE_TUNING.resamplePoints);
  let expectedDist = Number.POSITIVE_INFINITY;
  let bestDist = Number.POSITIVE_INFINITY;
  let bestTone = expectedTone;
  for (const tone of [1, 2, 3, 4, 5, 6]) {
    const curve = templateCurve([tone], TONE_TUNING.resamplePoints).map(
      (value) => value - templateMedian
    );
    const dist = dtwDistance(user, curve);
    if (tone === expectedTone) expectedDist = dist;
    if (dist < bestDist) {
      bestDist = dist;
      bestTone = tone;
    }
  }
  const span = Math.max(1e-6, TONE_TUNING.distZero - TONE_TUNING.distFullScore);
  let score = 100 * (1 - (expectedDist - TONE_TUNING.distFullScore) / span);
  score = Math.max(0, Math.min(100, score));
  // 只有“赢面差距明显”（另一调型斜率不同且距离显著更小）才判错调；
  // 水平调族（1/3/6）与升降调族（2/5）形态相近时不互相惩罚。
  const tonesDiffer =
    Math.abs(TONE_TEMPLATES[expectedTone].slope - TONE_TEMPLATES[bestTone].slope) >=
    TONE_TUNING.slopeSeparation;
  const confidentMismatch =
    bestTone !== expectedTone && tonesDiffer && expectedDist - bestDist > 0.55;
  if (confidentMismatch) score *= TONE_TUNING.mismatchPenalty;
  return { score, detectedTone: confidentMismatch ? bestTone : expectedTone };
}

/**
 * 整句调准评分。鲁棒回退：粤拼无调母 / 浊音不足 / 发声过短 → null（调用方仅按字准计）。
 */
export function scoreToneContour(frames: PitchFrame[], jyutping: string): ToneScoreDetail | null {
  const tones = parseJyutpingTones(jyutping);
  if (!tones.length || !frames.length) return null;

  const durationMs = (frames[frames.length - 1].t - frames[0].t) * 1000;
  const points = normalizeContour(frames);
  if (!points.length || durationMs < TONE_TUNING.minVoicedMs) return null;

  const voicedRatio = points.length / frames.length;
  if (voicedRatio < TONE_TUNING.minVoicedRatio) return null;

  // 全句模板的“中位数对齐”语义与用户轮廓一致（median 对 median 比较）
  const perSyllablePoints = Math.max(2, Math.floor(DISPLAY_POINTS / tones.length));
  const fullTemplate = templateCurve(tones, perSyllablePoints);
  const sortedTemplate = [...fullTemplate].sort((a, b) => a - b);
  const templateMedian = sortedTemplate[Math.floor(sortedTemplate.length / 2)];
  const template = fullTemplate.map((value) => value - templateMedian).slice(0, DISPLAY_POINTS);

  const segments = splitSyllables(points, tones.length);
  const segmentScores = segments.map((segment, index) =>
    scoreSegment(segment, tones[index], templateMedian)
  );
  // 几何平均（下限 0.5 防塌零）：单个错调音节会被显著放大，整句评价更接近人耳听感
  const geometric = Math.exp(
    segmentScores.reduce((sum, value) => sum + Math.log(Math.max(0.5, value.score)), 0) /
      segmentScores.length
  );
  const score = Math.round(geometric);

  return {
    score,
    perSyllable: segmentScores.map((value) => Math.round(value.score)),
    expectedTones: tones,
    detectedTones: segmentScores.map((value) => value.detectedTone),
    userCurve: resamplePoints(points, template.length),
    template
  };
}
