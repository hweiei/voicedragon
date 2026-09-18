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
