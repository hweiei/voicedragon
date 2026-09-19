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
import { type FxContext, planFor } from "./fx/plans";

export interface FxOptions {
  effect?: string;
  reducedMotion: boolean;
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
}
