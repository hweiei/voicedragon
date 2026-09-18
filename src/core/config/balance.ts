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
