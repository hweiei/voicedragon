/**
 * 平衡与调参中枢：所有可调权重/阈值集中在此，便于灰度与自动化调参（P5）。
 */

/** 发音评分合成权重（P1：无调速，声调层权重为 0；P3 接入声调后迁移到 SCORING_WEIGHTS_V2）。 */
export const SCORING_WEIGHTS = {
  /** 文本相似度（ASR 字准）权重 */
  text: 0.76,
  /** 识别引擎置信度权重 */
  confidence: 0.24,
  /** 声调轮廓权重（P3 启用） */
  tone: 0
} as const;

/**
 * P3 声调权重（REDESIGN-PLAN §4.2：默认 字 60% / 调 40%，可在设置调整）。
 * 合成规则（composeFinalScore）：有调准分时 final = 字准综合·(1-toneWeight) + 调准·toneWeight；
 * 无调准分（WebSpeech / 无声 / 能量不足）恒回退 V1 权重，行为与 P0 黄金契约一致。
 */
export const SCORING_WEIGHTS_V2 = {
  text: 0.6,
  tone: 0.4,
  confidence: 0
} as const;

/** 声调引擎调参（核心层纯函数引用）。 */
export const TONE_TUNING = {
  /** 有效浊音帧占比下限，不足则判“无声/噪声”返回 null */
  minVoicedRatio: 0.32,
  /** 有效发声最短时长（毫秒） */
  minVoicedMs: 260,
  /** pitchy 清晰度门限（0~1，低于视为噪音帧） */
  clarityGate: 0.72,
  /** 每音节重采样点数（DTW 对齐粒度） */
  resamplePoints: 14,
  /** DTW 平均路径距离（半音）：≤此值满分 */
  distFullScore: 1.1,
  /** DTW 平均路径距离（半音）：≥此值零分 */
  distZero: 4.6,
  /** 期望调型并非所有调型中最优时的惩罚系数 */
  mismatchPenalty: 0.62,
  /** F0 合法区间（Hz），过滤倍频/半频异常帧 */
  minHz: 70,
  maxHz: 600,
  /** 调型“升降/水平”判别的最小半音斜率差：模板间差异须明显才可惩罚错调 */
  slopeSeparation: 0.8
} as const;

/** 六调调型模板数值（核心层 tone.ts 引用）。 */
export const TONE_SHAPES = {
  1: { offset: 3.2, slope: -0.6 },
  2: { offset: 1.2, slope: 5.0 },
  3: { offset: 0.2, slope: 0 },
  4: { offset: -3.2, slope: -2.4 },
  5: { offset: -1.7, slope: 3.4 },
  6: { offset: -0.9, slope: 0 }
} as const;

/** 语音模型分片下载参数：每片 8 MiB。 */
export const MODEL_PART_SIZE = 8 * 1024 * 1024;

/** 施法收音硬上限（毫秒），超时自动判定。 */
export const VOICE_CAPTURE_MAX_MS = 8000;

/** 战斗声气上限（引擎约定，UI 同步展示用）。 */
export const MAX_ENERGY = 3;

/** P2 战役地图形状约束：LevelMapGenerator 生成参数（STS 式 7×15 不规则网格）。 */
export const ACT_MAP = {
  /** 纵向层数（含起点行与 Boss 顶点行） */
  rows: 15,
  /** 横向列数 */
  cols: 7,
  /** 首行起点数范围 */
  minStarts: 2,
  maxStarts: 3,
  /** 中间行节点数范围 */
  minRowNodes: 2,
  maxRowNodes: 4,
  /** 强敌禁出的前序行数（前 4 行无精英） */
  noEliteRows: 4,
  /** 收尾不设纯收益节点（宝箱/问答）的行数 */
  prizeFreeRows: 3
} as const;

/** 节点★评价阈值（政府评分制）：通关基础上，无伤 / 平均声韵≥85 / 限时各一★。 */
export const STAR_THRESHOLDS = {
  /** 平均声韵★门槛 */
  voiceAvg: 85,
  /** 限时★回合上限（按战斗类型） */
  turnLimits: { battle: 8, elite: 10, boss: 12 }
} as const;

/** 难度曲线系数（引擎 scaledEnemy 引用；数值与原硬编码常量逐位一致，行为不变）。 */
export const DIFFICULTY_CURVE = {
  enemyHpPerFloor: 0.075,
  bossHpPerFloor: 0.035,
  attackPerFloor: 0.055
} as const;

/** 宝箱节点产出调参。 */
export const TREASURE = {
  goldMin: 18,
  goldMax: 30,
  itemChance: 0.5,
  relicChance: 0.25
} as const;

/** 问答节点题量。 */
export const QUIZ_PER_NODE = 3;
