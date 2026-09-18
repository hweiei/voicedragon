/**
 * P4 成就系统（核心层，纯函数）：定义 + 判定 + 积分。
 * 判定输入 AchievementContext 由组合根从各存档聚合（profile / 战役元 / SRS / 每日战绩），
 * 同输入必同输出；新达成集合 = check 通过且不在已解锁列表中。
 */

export interface AchievementContext {
  /** 真实语音尝试次数（不含 QTE/键盘判定） */
  voiceAttempts: number;
  bestVoice: number;
  /** 连续 ≥85 分历史最高 */
  maxCombo85: number;
  runs: number;
  victories: number;
  classicVictories: number;
  kills: number;
  elites: number;
  endlessBest: number;
  campaignStarsTotal: number;
  campaignBossKills: number;
  quizPerfects: number;
  dailyWins: number;
  /** 错词本中间隔 ≥10 天的“驯服”句数 */
  srsGraduated: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** 展示印记（单字/emoji） */
  seal: string;
  points: number;
  secret?: boolean;
  check(ctx: AchievementContext): boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first-voice",
    name: "初啼",
    desc: "第一次真声施法（破阵拍不算）",
    seal: "声",
    points: 10,
    check: (ctx) => ctx.voiceAttempts >= 1
  },
  {
    id: "first-victory",
    name: "开声见胜",
    desc: "赢下任意一局登楼",
    seal: "胜",
    points: 20,
    check: (ctx) => ctx.victories >= 1
  },
  {
    id: "clear-85",
    name: "正音初成",
    desc: "单次声韵判定达到 85 分（正音）",
    seal: "正",
    points: 15,
    check: (ctx) => ctx.bestVoice >= 85
  },
  {
    id: "combo-85",
    name: "连珠正音",
    desc: "连续 5 次判定 ≥85 分",
    seal: "珠",
    points: 25,
    check: (ctx) => ctx.maxCombo85 >= 5
  },
  {
    id: "voice-100",
    name: "百炼声线",
    desc: "累计真声施法 100 次",
    seal: "炼",
    points: 30,
    check: (ctx) => ctx.voiceAttempts >= 100
  },
  {
    id: "tower-clear",
    name: "十层尽破",
    desc: "通关经典十层塔一次",
    seal: "十",
    points: 20,
    check: (ctx) => ctx.classicVictories >= 1
  },
  {
    id: "elite-hunter",
    name: "精英猎手",
    desc: "累计击败强敌 10 次",
    seal: "猎",
    points: 30,
    check: (ctx) => ctx.elites >= 10
  },
  {
    id: "star-scout",
    name: "星探",
    desc: "战役星辉累计达到 20 颗",
    seal: "星",
    points: 30,
    check: (ctx) => ctx.campaignStarsTotal >= 20
  },
  {
    id: "dragon-bane",
    name: "声煞克星",
    desc: "在战役中击败九龙声煞",
    seal: "龙",
    points: 40,
    secret: true,
    check: (ctx) => ctx.campaignBossKills >= 1
  },
  {
    id: "endless-walker",
    name: "无尽行者",
    desc: "无尽塔到达第 15 层",
    seal: "∞",
    points: 40,
    check: (ctx) => ctx.endlessBest >= 15
  },
  {
    id: "daily-devotee",
    name: "每日精进",
    desc: "每日挑战累计通关 3 天",
    seal: "日",
    points: 20,
    check: (ctx) => ctx.dailyWins >= 3
  },
  {
    id: "quiz-scholar",
    name: "问答状元",
    desc: "3 个问答节点拿到满星",
    seal: "状",
    points: 15,
    check: (ctx) => ctx.quizPerfects >= 3
  },
  {
    id: "mistake-tamer",
    name: "知错能改",
    desc: "错词本里 3 句修成（复习间隔 ≥10 天）",
    seal: "改",
    points: 15,
    check: (ctx) => ctx.srsGraduated >= 3
  }
];

export function checkAchievements(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((def) => def.check(ctx)).map((def) => def.id);
}

/** 新达成：本次通过但尚未在 unlocked 里的成就（保持定义顺序）。 */
export function newlyUnlocked(
  ctx: AchievementContext,
  unlocked: Iterable<string>
): AchievementDef[] {
  const owned = unlocked instanceof Set ? unlocked : new Set(unlocked);
  return ACHIEVEMENTS.filter((def) => !owned.has(def.id) && def.check(ctx));
}

export function achievementPoints(unlockedIds: Iterable<string>): number {
  const owned = unlockedIds instanceof Set ? unlockedIds : new Set(unlockedIds);
  return ACHIEVEMENTS.reduce((sum, def) => sum + (owned.has(def.id) ? def.points : 0), 0);
}

export const ACHIEVEMENT_POINTS_TOTAL = ACHIEVEMENTS.reduce((sum, def) => sum + def.points, 0);
