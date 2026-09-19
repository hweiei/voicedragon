/**
 * P5 战斗演出：浮字（伤害/护甲/治疗）、受击抖动、结算闪光。
 * 纯 DOM + CSS keyframes（方案 §4.4：CSS 覆盖 80% 常规动效）；
 * body.reduce-motion 时全部跳过（无障碍承诺）。
 */

import type { GameState } from "../core/engine";

const FLOATER_MS = 900;

export interface FxOptions {
  effect?: string;
  reducedMotion: boolean;
}

/** 在容器内生成一枚上浮渐隐的数字/符号。 */
function floater(host: HTMLElement, text: string, kind: string): void {
  const el = document.createElement("span");
  el.className = `fx-floater fx-${kind}`;
  el.textContent = text;
  // 宿主内随机水平偏移，避免连击时叠字
  el.style.left = `${18 + Math.random() * 56}%`;
  host.appendChild(el);
  window.setTimeout(() => el.remove(), FLOATER_MS);
}

function shake(el: HTMLElement | null, cls: string, ms: number): void {
  if (!el) return;
  el.classList.remove(cls);
  // 强制 reflow 以便重复触发
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

/**
 * 按 emit effect 播放对应演出（在 ui.render 重绘后调用）。
 * 数据取自 combat.lastResult（resolveSkill 刚写入），不重复计算。
 */
export function playBattleFx(root: HTMLElement, state: GameState, options: FxOptions): void {
  const effect = options.effect;
  if (!effect || options.reducedMotion) return;
  const battle = root.querySelector<HTMLElement>(".battle-screen");

  if (effect === "hit" || effect === "skill") {
    const result = state.combat?.lastResult;
    if (battle && result) {
      const enemyStage = battle.querySelector<HTMLElement>(".enemy-stage");
      const playerRow = battle.querySelector<HTMLElement>(".battle-status");
      if (result.damage > 0 && enemyStage) {
        floater(enemyStage, `-${result.damage}`, "damage");
        shake(battle.querySelector<HTMLElement>(".enemy-avatar"), "fx-shake", 320);
      }
      if (result.armor > 0 && playerRow) floater(playerRow, `+${result.armor}`, "armor");
      if (result.healing > 0 && playerRow) floater(playerRow, `+${result.healing}`, "heal");
    }
    return;
  }

  if (effect === "enemy" && battle) {
    shake(battle, "fx-jolt", 280);
    const playerRow = battle.querySelector<HTMLElement>(".combatant-mini:not(.enemy)");
    shake(playerRow, "fx-hurt", 340);
    return;
  }

  if (effect === "victory" || effect === "star") {
    const host = battle ?? root;
    const marks = effect === "victory" ? ["★", "声", "震"] : ["★"];
    for (let i = 0; i < marks.length; i += 1) {
      window.setTimeout(() => floater(host, marks[i], "star"), i * 140);
    }
    return;
  }

  if (effect === "treasure") {
    floater(root, "✦", "star");
    return;
  }

  if (effect === "defeat") {
    shake(root, "fx-defeat", 700);
  }
}
