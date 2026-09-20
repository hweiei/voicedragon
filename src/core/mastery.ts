/**
 * P13 语言力量化（核心层，纯规则）：把「练透了这句话」变成该句 +1/+2 威力。
 *
 * 三条纪律：
 * 1) **只读本地 SRS 聚合**（`store.syllables`，整数），无任何 IO 与随机；
 * 2) **低练度 = 零影响**：任一音节不达标即 0 加成，绝不外推、不四舍五入放宽；
 * 3) **数值必须过仿真带**：加成表 `MASTERY_BONUS_BY_TIER` 的每一个数字都要经 `sim:p13` 校准。
 */

import { type SrsStore, type TrackedTone, emptyToneMastery } from "./srs";
import { TONE_TEMPLATES } from "./tone";

/** 掌握判定阈值（音节均分）。 */
export const MASTERY_TIER1_SCORE = 80;
export const MASTERY_TIER1_ATTEMPTS = 2;
export const MASTERY_TIER2_SCORE = 92;
export const MASTERY_TIER2_ATTEMPTS = 3;
/** 单句加成上限（= tier 2）。 */
export const MASTERY_BONUS_CAP = 2;
/**
 * tier → **判定加成**（校准表；只允许整体下调，不允许逐句特判）。
 *
 * 三轮仿真校准（docs/P13-BALANCE-REPORT.md §校准）证伪了「直接加威力」的两个版本：
 * ① 无门槛 +2 威力 → 全掌握行 92–100%，越带；② 限正音 +1/+2 威力 → 花旦一幕仍 76.7%，越带。
 * 终案：加成只作用于**档位判定**（把 83/84 抬进正音、63/64 抬进清晰），不进裸分、不进彩。
 */
export const MASTERY_BONUS_BY_TIER: readonly number[] = [0, 1, 2];

/**
 * tier → **判定保底**（校准表；只允许整体下调，不允许逐句特判）。
 *
 * 四轮仿真校准（见 docs/P13-BALANCE-REPORT.md §校准）依次证伪了三种「加力量」写法：
 * ① 无门槛 +2 威力 → 全掌握行 92–100%；② 限正音 +1/+2 威力 → 花旦一幕 76.7%；
 * ③ 判定加成 +1/+2（跨 65 与 85 两个门槛）→ 花旦一幕 69.0%（其越带 100% 来自「正音」门槛）。
 * 定案：**判定保底**——练透的句子判定从 65（清晰）/ 80 起算，且保底值一律低于正音线 85。
 * 词林只保底「不打嗝」，不制造「正音」：正音必须当场唱准，与满堂彩「彩要真本事」同源。
 */
/**
 * 判定保底：掌握（任意 tier）→ 判定不低于「清晰」（65）。
 *
 * 四轮仿真校准把「力量化」压到了这一条线（见 docs/P13-BALANCE-REPORT.md §校准）：
 * ① 加威力越带；② 判定加成越带（越带 100% 来自「正音」门槛）；③ 高于 65 的保底在现行档位表
 * （未稳<40 / 入门<65 / 清晰<85 / 正音≥85）下**不改变档位**，只是装饰值，故不设。
 * 保底 65 < 正音线 85 —— 词林只保底「不打嗝」，不制造「正音」；正音必须当场唱准。
 */
export const MASTERY_FLOOR = 65;

/** 正音线：保底值必须严格低于它（单元测试守卫「词林不制造正音」）。 */
export const MASTERY_MASTER_THRESHOLD = 85;

export interface MasteryJudge {
  /** 供档位判定的分数（不进裸分、不进统计、不进彩）。 */
  judged: number;
  /** 实际抬升的点数（0 = 保底没起作用）。 */
  applied: number;
  /** 保底是否真的把档位救了回来（入门/未稳 → 清晰）；仅此情形给玩家提示。 */
  rescued: boolean;
}

/**
 * 判定保底落地：引擎与仿真共用同一处语义（纯函数，无随机、无 IO）。
 * `tierOf` 由调用方给出档位读数函数（引擎复用同一张档位表，避免两处阈值）。
 */
export function masteryJudgeScore(
  score: number,
  floor: number,
  tierKeyOf: (value: number) => string
): MasteryJudge {
  const judged = Math.max(score, Math.min(floor, MASTERY_MASTER_THRESHOLD - 1));
  return {
    judged,
    applied: judged - score,
    rescued: judged > score && tierKeyOf(judged) !== tierKeyOf(score)
  };
}

export interface MasteryGateState {
  masteryPowerVersion?: 1;
  ruleset?: "legacy" | "p7";
}

/** 力量化只在显式开启的 p7 新局生效；旧局/未开启零接触。 */
export function masteryEnabled(state: MasteryGateState | null | undefined): boolean {
  return state?.masteryPowerVersion === 1 && state.ruleset === "p7";
}

export interface SyllableMasteryView {
  index: number;
  attempts: number;
  average: number | null;
  best: number;
  tone: TrackedTone | null;
  toneName: string | null;
  reached: boolean;
}

export interface SkillMasteryView {
  skillId: string;
  syllables: SyllableMasteryView[];
  graded: number;
  total: number;
  tier: 0 | 1 | 2;
  /** 该句的判定保底（0 = 无保底；掌握即 65）。 */
  floor: number;
  /** 全部音节均分（缺数据的音节不参与），无数据为 null。 */
  average: number | null;
}

function statAverage(attempts: number, sumScore: number): number | null {
  if (!attempts) return null;
  return Math.round(sumScore / attempts);
}

/**
 * 逐音节掌握视图：用于卡面/词林展示与力量化判定（同一份数据，一处逻辑）。
 * `expectedTones` 给出该句每音节的期望调（来自粤拼），便于展示与「缺哪个音节」提示。
 */
export function skillMasteryView(
  store: SrsStore | null,
  skillId: string,
  expectedTones: readonly number[]
): SkillMasteryView {
  const total = Math.max(0, expectedTones.length);
  const list = store?.syllables?.[skillId] ?? [];
  const syllables: SyllableMasteryView[] = [];
  let allAvgSum = 0;
  let allAvgCount = 0;
  let tier1Eligible = total > 0;
  let tier2Eligible = total > 0;

  for (let index = 0; index < total; index += 1) {
    const stat = list[index];
    const attempts = stat?.attempts ?? 0;
    const average = stat ? statAverage(stat.attempts, stat.sumScore) : null;
    const tone = (
      expectedTones[index] >= 1 && expectedTones[index] <= 6 ? expectedTones[index] : null
    ) as TrackedTone | null;
    const reached = average != null && average >= MASTERY_TIER1_SCORE;
    if (average != null) {
      allAvgSum += average;
      allAvgCount += 1;
    }
    if (attempts < MASTERY_TIER1_ATTEMPTS || average == null || average < MASTERY_TIER1_SCORE) {
      tier1Eligible = false;
    }
    if (attempts < MASTERY_TIER2_ATTEMPTS || average == null || average < MASTERY_TIER2_SCORE) {
      tier2Eligible = false;
    }
    syllables.push({
      index,
      attempts,
      average,
      best: stat?.bestScore ?? 0,
      tone,
      toneName: tone ? TONE_TEMPLATES[tone].name : null,
      reached
    });
  }

  const tier: 0 | 1 | 2 = tier2Eligible ? 2 : tier1Eligible ? 1 : 0;
  return {
    skillId,
    syllables,
    graded: syllables.filter((entry) => entry.attempts > 0).length,
    total,
    tier,
    floor: tier >= 1 ? MASTERY_FLOOR : 0,
    average: allAvgCount ? Math.round(allAvgSum / allAvgCount) : null
  };
}

/**
 * 单句判定保底（0 / 65 / 80）：供引擎 provider 直接调用。
 * 引擎只把它当作「取档位用的分数下限」，绝不动伤害公式本身。
 */
export function masteryFloorFor(
  store: SrsStore | null,
  skillId: string,
  expectedTones: readonly number[]
): number {
  return skillMasteryView(store, skillId, expectedTones).floor;
}

/** 全库掌握度汇总（词林页签/称号用）：平均分按音节数加权。 */
export function masteryTierDistribution(
  store: SrsStore | null,
  skills: readonly { id: string; tones: readonly number[] }[]
): {
  tier0: number;
  tier1: number;
  tier2: number;
  gradedSyllables: number;
  totalSyllables: number;
} {
  let tier0 = 0;
  let tier1 = 0;
  let tier2 = 0;
  let gradedSyllables = 0;
  let totalSyllables = 0;
  for (const skill of skills) {
    const view = skillMasteryView(store, skill.id, skill.tones);
    if (view.tier === 2) tier2 += 1;
    else if (view.tier === 1) tier1 += 1;
    else tier0 += 1;
    gradedSyllables += view.graded;
    totalSyllables += view.total;
  }
  return { tier0, tier1, tier2, gradedSyllables, totalSyllables };
}

/**
 * 仿真专用：造一份「全部音节都练到指定水平」的合成档案（不写盘，仅内存）。
 * 只用于 sim:p13 把掌握度注入仿真档案——数值必须由真实纯函数判定，不抄近路。
 */
export function syntheticMasteryStore(
  skills: readonly { id: string; tones: readonly number[] }[],
  score: number,
  attempts: number
): SrsStore {
  const syllables: Record<
    string,
    { attempts: number; sumScore: number; bestScore: number; lastScore: number }[]
  > = {};
  for (const skill of skills) {
    syllables[skill.id] = skill.tones.map(() => ({
      attempts,
      sumScore: Math.round(score) * attempts,
      bestScore: Math.round(score),
      lastScore: Math.round(score)
    }));
  }
  return {
    entries: {},
    stats: {
      voiceAttempts: 0,
      sumWord: 0,
      toneCount: 0,
      sumTone: 0,
      sumConfidence: 0,
      skillsUsed: skills.map((skill) => skill.id),
      toneMastery: emptyToneMastery(),
      listeningAttempts: 0,
      listeningCorrect: 0
    },
    history: [],
    syllables
  };
}
