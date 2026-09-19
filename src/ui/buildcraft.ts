/** P8-A 静态构筑模板；按钮提交具体槽位，展示不修改领域状态。 */
import {
  BUILD_FLOWS,
  type BuildDeck,
  CAPABILITY_LABELS,
  buildEnabled,
  buildOverview,
  capabilities,
  deckSkill,
  removalPrice,
  removalReason,
  synergyHints,
  upgradeReason,
  upgradedSkill
} from "../core/buildcraft";
import type { Skill } from "../core/data";
import type { GameState } from "../core/engine";

export type BuildOperation = "remove" | "upgrade";
export type BuildView = "view" | BuildOperation;
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!
  );
const effect = (skill: Skill) => esc(skill.description.replaceAll("{power}", String(skill.power)));
export function skillTags(skill: Skill): string {
  return `<span class="skill-tags">${capabilities(skill)
    .map((tag) => `<span class="skill-tag">${CAPABILITY_LABELS[tag]}</span>`)
    .join("")}</span>`;
}
export function buildViewTemplate(state: GameState, mode: BuildView): string {
  const player = state.player!;
  const enabled = buildEnabled(state);
  const overview = buildOverview(player);
  const title =
    mode === "remove" ? "夜市 · 精简牌组" : mode === "upgrade" ? "歇脚 · 磨练一招" : "我的构筑";
  const intro =
    mode === "remove"
      ? `本次 ${removalPrice(player)} 两（服务不打折），本店限一次，至少保留 5 张及一张输出牌。`
      : mode === "upgrade"
        ? "选择一张已开放的技能升一级，代替本次回血或练声。费用不变，同名牌分别强化。"
        : "流派是搭配方向，不是职业限制。编号对应牌组位置，同名牌也是独立的卡。";
  const cards = player.deck
    .map((id, index) => {
      const skill = deckSkill(player, index, enabled);
      if (!skill) return "";
      let reason: string | null = null;
      if (mode !== "view") {
        reason = !enabled
          ? "本局未开启构筑操作"
          : mode === "upgrade"
            ? upgradeReason(player, index)
            : removalReason(player, index);
        if (mode === "upgrade" && state.phase !== "rest") reason = "只能在歇脚处升级";
        if (mode === "remove" && (state.phase !== "shop" || state.shop?.removalUsed))
          reason = "本店删牌服务不可用";
        if (mode === "remove" && player.gold < removalPrice(player)) reason = "银两不足";
      }
      return `<article class="build-card" data-slot="${index}">
      <div class="build-card-head"><strong><small>#${index + 1}</small> ${esc(skill.name)}</strong><span>${skill.cost} 气</span></div>
      ${skillTags(skill)}<p>${effect(skill)}</p>
      ${mode === "view" ? `<small>${enabled && player.upgradedSlots?.includes(index) ? "已升级" : upgradeReason(player, index) === null && enabled ? "可在歇脚处升级" : "未升级"}</small>` : `<button type="button" class="secondary-button full-button" data-action="build-select" data-operation="${mode}" data-slot="${index}" data-skill-id="${esc(id)}" ${reason ? "disabled" : ""}>${reason ? esc(reason) : mode === "remove" ? "选择删除" : "查看升级预览"}</button>`}
    </article>`;
    })
    .join("");
  return `<div class="modal-sheet build-sheet" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="modal-head"><div><h2>${title}</h2><p>${player.deck.length} 张牌 · ${player.gold} 两 · 已删 ${player.removedCards ?? 0} 张</p></div><button type="button" class="close-button" data-action="close-modal" aria-label="关闭构筑">×</button></div>
    <p class="build-intro">${intro}</p>
    ${!enabled ? '<p class="notice-strip">本局保留旧规则，仅可查看；新开战役可删牌与升级。</p>' : ""}
    <div class="cost-summary" aria-label="声气费用分布">${overview.costs.map((count, cost) => `<span>${cost === 3 ? "3+" : cost} 气 <b>${count}</b> 张</span>`).join("")}</div>
    <div class="build-flows">${BUILD_FLOWS.map((flow, index) => `<div><strong>${flow.name}</strong><p>${overview.flowStatus[index]}</p><small>${flow.description}</small></div>`).join("")}</div>
    <div class="build-card-list">${cards}</div>
    <button class="ghost-button full-button" type="button" data-action="close-modal">${mode === "view" ? "返回游戏" : "取消，不做改动"}</button>
  </div>`;
}
export function buildConfirmTemplate(
  state: GameState,
  operation: BuildOperation,
  index: number
): string {
  const player = state.player!;
  const current = deckSkill(player, index, buildEnabled(state))!;
  const next = upgradedSkill(current);
  return `<div class="modal-sheet build-confirm" role="dialog" aria-modal="true" aria-label="确认构筑操作">
    <div class="modal-head"><h2>${operation === "remove" ? "确认删除这张牌？" : "确认磨练这张牌？"}</h2><button class="close-button" type="button" data-action="close-modal" aria-label="取消">×</button></div>
    <h3>#${index + 1} ${esc(current.name)}</h3>
    ${operation === "upgrade" && next ? `<div class="upgrade-preview"><div><small>当前 · ${current.cost} 气 / 基础威力 ${current.power}</small><p>${effect(current)}</p></div><div><small>升级后 · ${next.cost} 气 / 基础威力 ${next.power}</small><p>${effect(next)}</p></div></div><p>只升级编号 #${index + 1} 这一张；同名牌不受影响。完成后结束本次歇脚，不能同时回血。</p>` : `<p>花费 <b>${removalPrice(player)} 两</b>，牌组 ${player.deck.length} → ${player.deck.length - 1} 张。${player.upgradedSlots?.includes(index) ? "这张牌的升级成果也将失去。" : ""}删牌不可撤销。</p>`}
    <button class="${operation === "remove" ? "danger-button" : "primary-button"} full-button" type="button" data-action="confirm-build">${operation === "remove" ? `确认支付 ${removalPrice(player)} 两并删除` : "确认升级并结束歇脚"}</button>
    <button class="ghost-button full-button" type="button" data-action="open-build" data-build-mode="${operation}">返回选牌，不做改动</button>
  </div>`;
}

export function synergyMarkup(skill: Skill, player: BuildDeck): string {
  const hints = synergyHints(skill, player);
  return hints.length
    ? `<ul class="synergy-hints" aria-label="构筑提示">${hints.map((hint) => `<li data-kind="${hint.kind}">${hint.kind === "caution" ? "留意" : hint.kind === "gap" ? "补位" : "联动"} · ${esc(hint.text)}</li>`).join("")}</ul>`
    : "";
}
