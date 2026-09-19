/**
 * P6-F1 FxDirector：演出导演——把 FxPlan 播放为 DOM 呈现（WAAPI + 池化浮字）。
 *
 * 职责边界（方案 §4）：
 * - 「该不该播」→ FxScheduler（去抖/优先级/预算，纯逻辑可测）；
 * - 「怎么播」→ 本层：hit-stop 时钟门（WAAPI playbackRate 0.05× 冻结→恢复）、
 *   闪光 0ms → 抖动 → 浮字 +40ms 的交错节奏、目标锚点解析。
 * - reduce-motion：抖动/闪光/hit-stop/压暗全部跳过，浮字降级为
 *   `.fx-calm`（仅透明度、零位移）——信息保留、动效归零（方案 §5-M2 降级策略）。
 */

import { spawnFloater } from "./floaters";
import { flashKeyframes, hurtFlashKeyframes, shakeKeyframes } from "./juice";
import type { FloaterSpec, FxPlan, FxTarget } from "./plans";
import { FxScheduler, HITSTOP_RATE } from "./scheduler";

export interface DirectorOptions {
  reducedMotion?: boolean;
  /** 可注入（测试/自定义预算用）；缺省自建 */
  scheduler?: FxScheduler;
}

const STAR_STAGGER_MS = 140;
/** hit-stop 结束后抖动动画的收尾保护时长 */
const SHAKE_TAIL_MS = 360;

export class FxDirector {
  private host: HTMLElement;
  private reducedMotion: boolean;
  private readonly scheduler: FxScheduler;

  constructor(host: HTMLElement, options: DirectorOptions = {}) {
    this.host = host;
    this.reducedMotion = options.reducedMotion ?? false;
    this.scheduler = options.scheduler ?? new FxScheduler();
  }

  /** ui.render 每帧重绘后根节点可能变化：由调用方同步。 */
  setHost(host: HTMLElement): void {
    this.host = host;
  }

  /** 设置页切换「减弱动效」即时生效。 */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** 播放一份演出计划（被调度器拒绝的计划静默丢弃）。 */
  play(plan: FxPlan): void {
    if (!this.scheduler.admit(plan)) return;

    const floaters = this.collectFloaters(plan);

    if (this.reducedMotion) {
      // 无障碍降级：只保留信息性浮字（calm：仅透明度）
      this.spawnFloaters(floaters);
      return;
    }

    // ① hit-stop 时钟门：本计划的抖动/闪光以 0.05× 起跑，窗口结束恢复 1×
    const anims: Animation[] = [];

    // ② 闪光先行（0ms）
    for (const flash of plan.flashes ?? []) {
      const el = this.resolveTarget(flash.target);
      if (!el) continue;
      const frames = flash.target === "player-row" ? hurtFlashKeyframes() : flashKeyframes();
      anims.push(el.animate(frames, { duration: flash.ms ?? 90, easing: "ease-out" }));
    }

    // ③ 分级抖动（与闪光几乎同拍，40/80ms 冻结由 playbackRate 呈现）
    for (const shake of plan.shakes ?? []) {
      const el = this.resolveTarget(shake.target);
      if (!el) continue;
      anims.push(
        el.animate(shakeKeyframes(shake.amp), { duration: shake.ms, easing: "ease-in-out" })
      );
    }

    if (plan.hitstopMs && anims.length > 0) {
      this.scheduler.enterHitstop(plan.hitstopMs);
      for (const anim of anims) anim.playbackRate = HITSTOP_RATE;
      window.setTimeout(() => {
        for (const anim of anims) {
          if (anim.playState !== "finished") anim.playbackRate = 1;
        }
      }, plan.hitstopMs);
      // 兜底：动画被降速后总时长拉长，超时收尾防悬挂
      const longestMs = Math.max(
        0,
        ...(plan.shakes ?? []).map((shake) => shake.ms),
        ...(plan.flashes ?? []).map((flash) => flash.ms ?? 90)
      );
      window.setTimeout(
        () => {
          for (const anim of anims) {
            if (anim.playState === "running") anim.finish();
          }
        },
        plan.hitstopMs + SHAKE_TAIL_MS + longestMs
      );
    }

    // ④ 败北压暗一拍（CSS 类，复用既有 .fx-defeat）
    if (plan.dim) {
      const el = this.host;
      el.classList.remove("fx-defeat");
      void el.offsetWidth; // 强制 reflow 以便重复触发
      el.classList.add("fx-defeat");
      window.setTimeout(() => el.classList.remove("fx-defeat"), 750);
    }

    // ⑤ 浮字收尾（+40ms 交错由 FloaterSpec.delayMs 携带）
    this.spawnFloaters(floaters);
  }

  /* ── 内部 ─────────────────────────────────────────────────────────── */

  /** 胜利/星辉字幕折算为浮字（保持 140ms 交错）。 */
  private collectFloaters(plan: FxPlan): FloaterSpec[] {
    const floaters: FloaterSpec[] = [...(plan.floaters ?? [])];
    if (plan.starMarks) {
      for (let i = 0; i < plan.starMarks.length; i += 1) {
        floaters.push({
          text: plan.starMarks[i],
          kind: "star",
          target: "screen",
          delayMs: i * STAR_STAGGER_MS
        });
      }
    }
    return floaters;
  }

  private spawnFloaters(floaters: FloaterSpec[]): void {
    for (const spec of floaters) {
      const fire = (): void => {
        if (!this.scheduler.registerFloater()) return; // 预算满：弃子保帅
        const hostEl = this.resolveTarget(spec.target) ?? this.host;
        spawnFloater(hostEl, spec.text, spec.kind, {
          crit: spec.crit,
          calm: this.reducedMotion,
          onRemove: () => this.scheduler.releaseFloater()
        });
      };
      if (spec.delayMs && spec.delayMs > 0) window.setTimeout(fire, spec.delayMs);
      else fire();
    }
  }

  /** 逻辑锚点 → DOM 元素（战斗外锚点缺失时回退根节点，星辉/宝藏仍可见）。 */
  private resolveTarget(target: FxTarget): HTMLElement | null {
    const root = this.host;
    switch (target) {
      case "enemy":
        return root.querySelector<HTMLElement>(".enemy-avatar");
      case "enemy-stage":
        return (
          root.querySelector<HTMLElement>(".enemy-stage") ??
          root.querySelector<HTMLElement>(".battle-screen")
        );
      case "player-row":
        return root.querySelector<HTMLElement>(".combatant-mini:not(.enemy)");
      case "player-status":
        return root.querySelector<HTMLElement>(".battle-status");
      case "screen":
        return root.querySelector<HTMLElement>(".battle-screen") ?? root;
      default:
        return root;
    }
  }
}
