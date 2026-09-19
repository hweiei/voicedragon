/** 新对手的静态规则面板，不新增动画；阶段说明与预测对减弱动效同样可读。 */
import { BOSS_EVOLUTIONS } from "../core/content/encounters";
import { evolutionEnabled } from "../core/encounters";
import type { GameState, IntentPreview } from "../core/engine";
const esc = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!
  );

export function encounterPanel(state: GameState, intent: IntentPreview): string {
  if (!evolutionEnabled(state) || !state.combat) return "";
  const combat = state.combat;
  const phase = combat.bossPhase;
  const definition = BOSS_EVOLUTIONS[combat.enemy.id];
  const statuses = [
    combat.enemy.armor > 0 ? `护甲 ${combat.enemy.armor}` : "",
    combat.enemy.weakness > 0 ? `虚弱 ${combat.enemy.weakness} 轮（伤害 -35%）` : "",
    combat.enemy.vulnerable > 0 ? `露隙 ${combat.enemy.vulnerable} 轮（受伤 +25%）` : ""
  ].filter(Boolean);
  const boss =
    phase && definition
      ? `<div class="boss-phase-info" data-phase="${phase.pending ? "pending" : phase.phase}" aria-label="首领阶段">
    <strong>${phase.pending ? "变招准备 · 本回合意图不变" : phase.phase === 2 ? `第二阶段 · ${esc(definition.phaseName)}` : "第一阶段 · 半血变招"}</strong>
    <p>${phase.pending ? `先结算「${esc(intent.label)}」，存活则进入「${esc(definition.phaseName)}」，以无伤害蓄势开场。` : phase.phase === 1 ? `生命 ≤${definition.threshold * 100}% 时准备变招。${esc(definition.description)}致死攻击直接获胜，不锁血。` : esc(definition.counterplay)}</p>
  </div>`
      : "";
  return `<aside class="encounter-brief" aria-label="敌方行动预告">
    ${boss}
    ${statuses.length ? `<p class="enemy-state-line" aria-label="敌方当前状态">敌方状态 · ${esc(statuses.join(" / "))}</p>` : ""}
    <div class="intent-heading"><span>当前意图</span><strong>${esc(intent.label)}</strong></div>
    <p class="intent-details">${esc(intent.detail)}</p>
    <p class="intent-forecast" data-hp-loss="${intent.hpLoss ?? 0}">${esc(intent.forecast ?? "")}${(intent.hpLoss ?? 0) >= state.player!.hp ? " ⚠ 当前预计致命" : ""}</p>
    ${intent.counter !== undefined ? `<p class="intent-counter" aria-label="反击预测">反击姿态待发：此招被护甲挡下时，预计还击 ${intent.counter} 点。</p>` : ""}
    <small>${esc(intent.hint ?? "")}</small>
    ${intent.nextLabel ? `<p class="next-intent">下一招（按当前计划）：${esc(intent.nextLabel)}</p>` : ""}
  </aside>`;
}
