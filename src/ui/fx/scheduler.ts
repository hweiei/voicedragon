/**
 * P6-F1 演出调度器：去抖 / 优先级 / 浮字并发预算 / hit-stop 时钟门——纯逻辑层。
 *
 * 设计（方案 §4/§5-M1）：调度决策与 DOM 播放分离——
 * 本文件零 DOM、时钟可注入，`tests/unit/fx-scheduler.test.ts` 全量锁定；
 * director.ts 只负责"怎么播"，不判断"该不该播"。
 */

export interface SchedulerOptions {
  /** 同 id 计划的去抖窗口（默认 60ms：防连点积压） */
  dedupeMs?: number;
  /** 同屏浮字上限（默认 6：大数挤小数，防叠字糊屏） */
  maxFloaters?: number;
  /** 可注入时钟（测试用；默认 performance/Date 混合兜底） */
  now?: () => number;
}

const DEFAULT_DEDUPE_MS = 60;
const DEFAULT_MAX_FLOATERS = 6;

/** hit-stop 期间的演出时钟倍率：0.05× ≈ 视觉冻结（WAAPI playbackRate 实现） */
export const HITSTOP_RATE = 0.05;

export class FxScheduler {
  private readonly dedupeMs: number;
  private readonly maxFloaters: number;
  private readonly now: () => number;
  private lastPlayedAt = new Map<string, number>();
  private activeFloaters = 0;
  private hitstopUntil = Number.NEGATIVE_INFINITY;

  constructor(options: SchedulerOptions = {}) {
    this.dedupeMs = options.dedupeMs ?? DEFAULT_DEDUPE_MS;
    this.maxFloaters = options.maxFloaters ?? DEFAULT_MAX_FLOATERS;
    this.now = options.now ?? (() => performance.now());
  }

  /**
   * 准入判定：
   * - priority 2（胜负）永不去抖——关键演出不可丢弃；
   * - 其余计划同 id 在去抖窗口内直接丢弃（返回 false）。
   */
  admit(plan: { id: string; priority: number }): boolean {
    const t = this.now();
    if (plan.priority < 2) {
      const last = this.lastPlayedAt.get(plan.id);
      if (last !== undefined && t - last < this.dedupeMs) return false;
    }
    this.lastPlayedAt.set(plan.id, t);
    return true;
  }

  /** 浮字预算：超额返回 false（调用方放弃该浮字），成功则计数 +1。 */
  registerFloater(): boolean {
    if (this.activeFloaters >= this.maxFloaters) return false;
    this.activeFloaters += 1;
    return true;
  }

  /** 浮字退场时归还名额（永不降到 0 以下）。 */
  releaseFloater(): void {
    this.activeFloaters = Math.max(0, this.activeFloaters - 1);
  }

  /** 进入 hit-stop：窗口内 playbackRate 降至 HITSTOP_RATE（真实时间计窗）。 */
  enterHitstop(ms: number): void {
    if (ms > 0) this.hitstopUntil = this.now() + ms;
  }

  inHitstop(): boolean {
    return this.now() < this.hitstopUntil;
  }

  /** 当前演出时钟倍率：新建动画直接取用。 */
  get playbackRate(): number {
    return this.inHitstop() ? HITSTOP_RATE : 1;
  }
}
