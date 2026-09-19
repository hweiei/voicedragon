/**
 * 战斗演出兼容层（P5 签名 → P6 FxDirector）。
 *
 * ui.ts 调用点不变：`playBattleFx(root, state, { effect, reducedMotion })`。
 * 内部升级为编排链路（方案 §4）：
 *   engine effect + combat.lastResult → FxContext → planFor()（纯函数）
 *   → FxDirector.play()（调度去抖 / hit-stop / WAAPI / 池化浮字）。
 */

import type { GameState } from "../core/engine";
import { FxDirector } from "./fx/director";
import type { BurstKind } from "./fx/particles/emitter";
import { type FxContext, planFor } from "./fx/plans";

export interface FxOptions {
  effect?: string;
  reducedMotion: boolean;
}

/**
 * P6-F2 粒子爆发出口：组合根（main.ts）注册 ParticleField 的发射入口，
 * 计划播放后按语义点火；reduce-motion 时不点火。
 */
export type BurstSink = (kind: BurstKind) => void;

let burstSink: BurstSink | null = null;

export function registerBurstSink(sink: BurstSink | null): void {
  burstSink = sink;
}

let director: FxDirector | null = null;

/**
 * 按 emit effect 播放对应演出（在 ui.render 重绘后调用）。
 * 数据取自 combat.lastResult（resolveSkill 刚写入），不重复计算。
 */
export function playBattleFx(root: HTMLElement, state: GameState, options: FxOptions): void {
  const effect = options.effect;
  if (!effect) return;

  const last = state.combat?.lastResult ?? null;
  const ctx: FxContext = {
    damage: last?.damage,
    armor: last?.armor,
    healing: last?.healing,
    score: last?.rawScore,
    enemyMaxHp: state.combat?.enemy.maxHp
  };
  const plan = planFor(effect, ctx);
  if (!plan) return;

  director ??= new FxDirector(root);
  director.setHost(root);
  director.setReducedMotion(options.reducedMotion);
  director.play(plan);

  // P6-F2：计划播放成功后按语义点燃粒子爆发
  if (!burstSink || options.reducedMotion) return;
  if (plan.id === "hit.crit") burstSink("crit");
  else if (plan.id === "hit") burstSink("spark");
  else if (effect === "victory") burstSink("firework");
  else if (effect === "defeat") burstSink("ash");
}
