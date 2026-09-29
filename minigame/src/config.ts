/**
 * 广告位 ID：开通流量主后在「微信公众平台 → 流量主 → 广告管理」创建，再填到这里。
 * 为空时对应按钮不显示（正式包绝不出现假广告）。
 * 开通条件（以官方文档为准）：累计独立访客 ≥ 500、无严重违规。
 */
export const AD_UNITS = {
  /** 激励视频：战后多一张备选卡 */
  extraCard: "",
  /** 激励视频：耐心耗尽后复活一次 */
  revive: "",
  /** 插屏：一局结束回主页时，按频控偶尔展示 */
  interstitial: ""
};

/** 插屏频控：同一次启动内至少间隔 3 分钟，且前 2 局不出 */
export const INTERSTITIAL_MIN_GAP_MS = 180_000;
export const INTERSTITIAL_AFTER_RUNS = 2;
