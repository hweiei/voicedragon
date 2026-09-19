/**
 * P6-F3 帧率治理 FpsGovernor（方案 §5-M9）：帧耗时 EMA → 三档自动降载。
 *
 * 纯状态机（时钟可注入，单测锁定）：
 * - 流畅（tier 0）→ 吃力（tier 1）→ 告警（tier 2），逐档升降；
 * - 升档需 EMA 连续超阈值 3s（迟滞防抖），降档同理；
 * - 前 90 帧预热不决策（页面加载抖动不算数）；
 * - 手动「特效强度」优先于自动：full→0 / balanced→1 / eco→2，auto 才走自动。
 */

export type FxIntensitySetting = "auto" | "full" | "balanced" | "eco";
export type PerfTier = 0 | 1 | 2;

export interface FxBudget {
  /** 爆发粒子数量倍率 */
  burstRatio: number;
  /** 氛围微尘数量倍率 */
  moteRatio: number;
  /** 是否允许汉字粒子大演出 */
  kanjiEnabled: boolean;
}

export const TIER_BUDGETS: readonly [FxBudget, FxBudget, FxBudget] = [
  { burstRatio: 1, moteRatio: 1, kanjiEnabled: true },
  { burstRatio: 0.5, moteRatio: 0.6, kanjiEnabled: true },
  { burstRatio: 0.25, moteRatio: 0.3, kanjiEnabled: false }
];

export interface GovernorOptions {
  /** 帧耗 EMA 高于此值考虑降档（默认 24ms ≈ <42fps） */
  slowMs?: number;
  /** 帧耗 EMA 低于此值考虑升档（默认 18ms ≈ >55fps） */
  fastMs?: number;
  /** 迟滞：条件需持续的毫秒数（默认 3000） */
  sustainMs?: number;
  /** 预热帧数：此前不决策（默认 90） */
  warmupFrames?: number;
  now?: () => number;
}

const MANUAL_TIER: Record<Exclude<FxIntensitySetting, "auto">, PerfTier> = {
  full: 0,
  balanced: 1,
  eco: 2
};

export class FpsGovernor {
  private readonly slowMs: number;
  private readonly fastMs: number;
  private readonly sustainMs: number;
  private readonly warmupFrames: number;
  private readonly now: () => number;

  private ema = 16.7;
  private autoTier: PerfTier = 0;
  private candidate: PerfTier | null = null;
  private candidateSince = 0;
  private frames = 0;
  private lastSample = -1;
  private manual: Exclude<FxIntensitySetting, "auto"> | null = null;
  /** tier 变化回调（粒子场用来重撒微尘） */
  onTierChange: ((tier: PerfTier) => void) | null = null;

  constructor(options: GovernorOptions = {}) {
    this.slowMs = options.slowMs ?? 24;
    this.fastMs = options.fastMs ?? 18;
    this.sustainMs = options.sustainMs ?? 3000;
    this.warmupFrames = options.warmupFrames ?? 90;
    this.now = options.now ?? (() => performance.now());
  }

  /** 手动特效强度：null/auto = 帧率自治，其余档位固定覆盖。 */
  setManualIntensity(setting: FxIntensitySetting): void {
    this.manual = setting === "auto" ? null : setting;
    this.emitIfChanged();
  }

  /** 每帧采样（rAF 驱动）：更新 EMA，满足迟滞则迁移自动档。 */
  sample(): void {
    const t = this.now();
    if (this.lastSample >= 0) {
      // 极端间隔（后台切回）夹取，避免单帧污染 EMA
      const dt = Math.min(100, Math.max(0, t - this.lastSample));
      this.ema = this.ema * 0.9 + dt * 0.1;
    }
    this.lastSample = t;
    this.frames += 1;
    if (this.frames < this.warmupFrames) return;

    let next: PerfTier | null = null;
    if (this.ema > this.slowMs && this.autoTier < 2) next = (this.autoTier + 1) as PerfTier;
    else if (this.ema < this.fastMs && this.autoTier > 0) next = (this.autoTier - 1) as PerfTier;

    if (next === null) {
      this.candidate = null;
      return;
    }
    if (next !== this.candidate) {
      this.candidate = next;
      this.candidateSince = t;
      return;
    }
    if (t - this.candidateSince >= this.sustainMs) {
      this.autoTier = next;
      this.candidate = null;
      this.emitIfChanged();
    }
  }

  /** 当前生效档位（手动覆盖优先）。 */
  get tier(): PerfTier {
    return this.manual !== null ? MANUAL_TIER[this.manual] : this.autoTier;
  }

  get budget(): FxBudget {
    return TIER_BUDGETS[this.tier];
  }

  /** 自动档观测值（手动覆盖时与 tier 可能不同，测试/调试用）。 */
  get observedAutoTier(): PerfTier {
    return this.autoTier;
  }

  private emitIfChanged(): void {
    this.onTierChange?.(this.tier);
  }
}
