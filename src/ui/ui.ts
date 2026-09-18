/**
 * 渲染层：DOM 直渲适配器（原版 js/ui.js 的 TypeScript 化迁移，行为等价）。
 * 后续 P4 将各屏拆为独立组件文件并接入 Motion 动效时间轴；
 * 但布局/CSS 类名与 data-action 契约保持不变，E2E 选择器稳定。
 */

import { getPlatformLabel, vibrate } from "../adapters/platform";
import { clearSave, hasSave, loadGame } from "../adapters/storage";
import type { VoiceAdapter, VoiceAdapterState, VoiceScoreResult } from "../adapters/voice";
import { ITEMS, RELICS, getSkill } from "../core/data";
import type { Skill } from "../core/data";
import type { EmitOptions, GameEngine, GameState } from "../core/engine";
import { scoreLabel, scorePronunciation } from "../core/scoring";

function escapeHtml(value = ""): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function percent(value: number, max: number): number {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function skillDescription(skill: Skill): string {
  return skill.description.replaceAll("{power}", String(skill.power));
}

function skillTypeMark(skill: Skill): string {
  const marks: Record<string, string> = {
    attack: "攻",
    multi: "连",
    guard: "守",
    hybrid: "变",
    cleanse: "净",
    strength: "势",
    tempo: "疾",
    heal: "养",
    weaken: "扰"
  };
  return marks[skill.type] || "技";
}

function skillCard(skill: Skill, options: { action?: string; disabled?: boolean } = {}): string {
  const action = options.action || "cast-skill";
  const disabled = Boolean(options.disabled);
  const extraClass = disabled ? " locked" : "";
  return `
    <button class="skill-card${extraClass}" type="button" data-action="${action}" data-skill-id="${escapeHtml(skill.id)}" data-type-mark="${skillTypeMark(skill)}" ${disabled ? "disabled" : ""}>
      <span class="skill-cost">${skill.cost}</span>
      <strong>${escapeHtml(skill.name)}</strong>
      <span class="jyutping">${escapeHtml(skill.jyutping)}</span>
      <span class="meaning">${escapeHtml(skill.lesson)}</span>
      <span class="effect">${escapeHtml(skillDescription(skill))}</span>
    </button>`;
}

function hud(state: GameState): string {
  const player = state.player!;
  return `
    <div class="hud-grid">
      <div class="hud-card">
        <small>生命</small>
        <strong>${player.hp} / ${player.maxHp}</strong>
        <div class="hp-meter"><span style="width:${percent(player.hp, player.maxHp)}%"></span></div>
      </div>
      <div class="hud-card"><small>楼层</small><strong>${state.floor} / ${state.maxFloor}</strong></div>
      <div class="hud-card"><small>银两</small><strong>${player.gold} 两</strong></div>
      <div class="hud-card"><small>声韵</small><strong>+${player.voiceMastery}</strong></div>
    </div>`;
}

function titleTemplate(): string {
  const resume = hasSave();
  return `
    <section class="title-screen">
      <div class="title-mast">
        <div class="title-kicker">粤语声攻 · 十层试炼</div>
        <h1 class="title-name"><span>声震</span>龙楼</h1>
        <p class="title-tagline">讲得准，打得狠；一路开声，一路登楼</p>
      </div>

      <div class="tower-illustration" aria-hidden="true">
        <div class="tower-halo"></div>
        <div class="sound-rings"><span></span><span></span><span></span></div>
        <div class="tower-stack">
          <div class="tower-floor"></div>
          <div class="tower-floor"></div>
          <div class="tower-floor"></div>
          <div class="tower-floor"></div>
          <div class="tower-floor"></div>
        </div>
      </div>

      <div class="title-actions">
        ${resume ? `<button class="primary-button full-button" type="button" data-action="continue-run">继续登楼</button>` : ""}
        <button class="${resume ? "secondary-button" : "primary-button"} full-button" type="button" data-action="new-run">${resume ? "重新开局" : "开始登楼"}</button>
        <button class="ghost-button full-button" type="button" data-action="show-help">玩法与语音说明</button>
        <p class="title-note">网页试玩会在本机自动存档。P1 起可在设置中下载端侧粤语识别（完全离线）。</p>
      </div>
    </section>`;
}

function towerTemplate(state: GameState, engine: GameEngine): string {
  const nextFloor = state.floor + 1;
  const player = state.player!;
  const lessonId = player.deck[(state.floor + 1) % player.deck.length];
  const lesson = getSkill(lessonId)!;
  const dots = Array.from({ length: state.maxFloor }, (_, index) => {
    const floor = index + 1;
    const status = floor <= state.floor ? "done" : floor === nextFloor ? "active" : "";
    return `<div class="floor-dot ${status}"><i></i><small>${floor}</small></div>`;
  }).join("");
  const gates = state.floorOptions
    .map(
      (option) => `
    <button class="gate-card tone-${option.tone}" type="button" data-action="choose-floor" data-option-id="${escapeHtml(option.id)}">
      <span class="gate-mark">${escapeHtml(option.mark)}</span>
      <span class="gate-copy">
        <strong>${escapeHtml(option.label)}</strong>
        <small>${escapeHtml(option.hint)}</small>
      </span>
      <span class="gate-arrow">›</span>
    </button>`
    )
    .join("");

  return `
    <section class="screen tower-screen">
      ${hud(state)}
      <div class="floor-progress">${dots}</div>
      <div class="floor-heading">
        <div>
          <p class="eyebrow">选择下一道门</p>
          <h1 class="screen-title">${escapeHtml(engine.getFloorName(nextFloor))}</h1>
          <p class="screen-subtitle">门后内容已由本局种子生成，读档不会改变。</p>
        </div>
        <div class="floor-number">${String(nextFloor).padStart(2, "0")}</div>
      </div>
      ${state.notice ? `<div class="notice-strip">${escapeHtml(state.notice)}</div>` : ""}
      <div class="gate-list">${gates}</div>
      <div class="panel lesson-card">
        <div class="lesson-stamp">粤</div>
        <div>
          <strong>上楼前温习：${escapeHtml(lesson.phrase)}</strong>
          <small>${escapeHtml(lesson.jyutping)} · ${escapeHtml(lesson.lesson)}</small>
        </div>
      </div>
    </section>`;
}

function statusChips(state: GameState): string {
  const combat = state.combat!;
  const player = state.player!;
  const chips: string[] = [];
  if (player.armor) chips.push(`护甲 ${player.armor}`);
  if (player.strength) chips.push(`声势 +${player.strength}`);
  for (const buff of player.buffs) chips.push(`${buff.name} -${buff.value}`);
  if (combat.enemy.armor) chips.push(`敌甲 ${combat.enemy.armor}`);
  if (combat.enemy.weakness) chips.push(`敌虚弱 ${combat.enemy.weakness}`);
  if (combat.voiceBoost) chips.push(`下次声韵 +${combat.voiceBoost}`);
  return chips.map((chip) => `<span class="status-chip">${escapeHtml(chip)}</span>`).join("");
}

function battleTemplate(state: GameState, engine: GameEngine): string {
  const combat = state.combat!;
  const enemy = combat.enemy;
  const intent = engine.getIntentPreview()!;
  const player = state.player!;
  const energy = Array.from(
    { length: 3 },
    (_, index) =>
      `<span class="energy-orb ${index >= combat.energy ? "spent" : ""}">${index < combat.energy ? "声" : "·"}</span>`
  ).join("");
  const hand = combat.hand
    .map((card) => {
      const skill = getSkill(card.id)!;
      return skillCard(skill, { disabled: combat.energy < skill.cost || combat.locked });
    })
    .join("");
  const log = combat.log[0] || "轮到你开声。";

  return `
    <section class="battle-screen">
      <div class="battle-status">
        <div class="combatant-mini">
          <div class="label-line"><strong>你</strong><small>${player.hp}/${player.maxHp}</small></div>
          <div class="hp-meter"><span style="width:${percent(player.hp, player.maxHp)}%"></span></div>
        </div>
        <div class="turn-badge">第<br />${combat.turn} 回</div>
        <div class="combatant-mini enemy">
          <div class="label-line"><strong>${escapeHtml(enemy.name)}</strong><small>${enemy.hp}/${enemy.maxHp}</small></div>
          <div class="enemy-hp-meter"><span style="width:${percent(enemy.hp, enemy.maxHp)}%"></span></div>
        </div>
      </div>

      <div class="enemy-stage">
        <div class="stage-lines"></div>
        <div class="intent-card">
          <small>敌方意图</small>
          <strong>${escapeHtml(intent.label)} · ${escapeHtml(intent.detail)}</strong>
        </div>
        <div class="enemy-avatar hue-${escapeHtml(enemy.hue)}">${escapeHtml(enemy.glyph)}</div>
        <div class="enemy-name">
          <strong>${escapeHtml(enemy.name)}</strong>
          <small>${escapeHtml(enemy.epithet)}</small>
        </div>
        <div class="status-chips">${statusChips(state)}</div>
      </div>

      <p class="battle-log-line">${escapeHtml(log)}</p>
      <div class="hand-header">
        <div class="energy-orbs" aria-label="本回合声气">${energy}</div>
        <button class="end-turn-button" type="button" data-action="end-turn" ${combat.locked ? "disabled" : ""}>结束回合</button>
      </div>
      <div class="skill-hand">${hand}</div>
    </section>`;
}

function eventTemplate(state: GameState): string {
  const event = state.event!;
  const choices = event.choices
    .map(
      (choice) => `
    <button class="choice-button" type="button" data-action="event-choice" data-choice-id="${escapeHtml(choice.id)}">
      <span><strong>${escapeHtml(choice.label)}</strong><small>${escapeHtml(choice.hint)}</small></span><span>›</span>
    </button>`
    )
    .join("");
  return `
    <section class="screen story-screen">
      ${hud(state)}
      <p class="eyebrow">${escapeHtml(event.kicker)} · 第 ${state.floor} 层</p>
      <h1 class="screen-title">${escapeHtml(event.title)}</h1>
      <div class="story-art"><span class="story-glyph">遇</span></div>
      <div class="panel story-copy">
        <p>${escapeHtml(event.text)}</p>
        <div class="phrase-ribbon">
          <strong>${escapeHtml(event.lesson.phrase)}</strong>
          <span>${escapeHtml(event.lesson.jyutping)}</span>
          <small>${escapeHtml(event.lesson.meaning)}</small>
        </div>
      </div>
      ${
        event.resolved
          ? `<div class="panel outcome-card">${escapeHtml(event.outcome)}</div><button class="primary-button full-button" type="button" data-action="leave-event">继续登楼</button>`
          : `<div class="choice-list">${choices}</div>`
      }
    </section>`;
}

function restTemplate(state: GameState): string {
  return `
    <section class="screen story-screen">
      ${hud(state)}
      <p class="eyebrow">歇脚处 · 第 ${state.floor} 层</p>
      <h1 class="screen-title">调息练声</h1>
      <p class="screen-subtitle">烛火很稳。你只能选择一种休整方式。</p>
      <div class="story-art"><span class="story-glyph">息</span></div>
      <div class="rest-options">
        <div class="rest-card"><h3>饮茶歇息</h3><p>回复最大生命的 30%，适合伤势较重时。</p><button class="primary-button full-button" type="button" data-action="rest" data-rest-action="heal">回复生命</button></div>
        <div class="rest-card"><h3>对墙练声</h3><p>永久声韵 +3，使之后每次语音判定更稳定。</p><button class="secondary-button full-button" type="button" data-action="rest" data-rest-action="practice">提升声韵</button></div>
        <div class="rest-card"><h3>调匀气息</h3><p>最大生命 +5，并同步回复 5 点生命。</p><button class="ghost-button full-button" type="button" data-action="rest" data-rest-action="fortify">强健体魄</button></div>
      </div>
    </section>`;
}

function offerDetails(offer: { type: string; id: string }): {
  mark: string;
  name: string;
  description: string;
} {
  if (offer.type === "skill") {
    const item = getSkill(offer.id)!;
    return { mark: "技", name: item.name, description: `${item.jyutping} · ${item.lesson}` };
  }
  if (offer.type === "item") {
    const item = ITEMS.find((entry) => entry.id === offer.id)!;
    return { mark: item.short, name: item.name, description: item.description };
  }
  const item = RELICS.find((entry) => entry.id === offer.id)!;
  return { mark: item.short, name: item.name, description: item.description };
}

function shopTemplate(state: GameState): string {
  const offers = state
    .shop!.offers.map((offer) => {
      const detail = offerDetails(offer);
      return `
      <div class="shop-offer">
        <span class="offer-seal">${escapeHtml(detail.mark)}</span>
        <div><h3>${escapeHtml(detail.name)}</h3><p>${escapeHtml(detail.description)}</p></div>
        <button class="price-button" type="button" data-action="buy-offer" data-offer-key="${escapeHtml(offer.key)}" ${offer.sold ? "disabled" : ""}>${offer.sold ? "已售" : `${offer.price} 两`}</button>
      </div>`;
    })
    .join("");
  return `
    <section class="screen story-screen">
      ${hud(state)}
      <p class="eyebrow">夜市 · 第 ${state.floor} 层</p>
      <h1 class="screen-title">榕树头声货摊</h1>
      <p class="screen-subtitle">货物每局不同，卖出后概不退换。</p>
      ${state.notice ? `<div class="notice-strip">${escapeHtml(state.notice)}</div>` : ""}
      <div class="shop-grid">${offers}</div>
      <button class="ghost-button full-button" type="button" data-action="leave-shop" style="margin-top:14px">离开夜市</button>
    </section>`;
}

function rewardBonus(reward: { bonus: { type: string; id: string } | null }): string {
  if (!reward.bonus) return "";
  const source = reward.bonus.type === "relic" ? RELICS : ITEMS;
  const item = source.find((entry) => entry.id === reward.bonus!.id)!;
  return `
    <div class="panel reward-banner">
      <span class="reward-seal">${escapeHtml(item.short)}</span>
      <div><strong>额外获得：${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></div>
    </div>`;
}

function rewardTemplate(state: GameState): string {
  const reward = state.reward!;
  const cards = reward.choices
    .map((id) => skillCard(getSkill(id)!, { action: "reward-skill" }))
    .join("");
  return `
    <section class="screen">
      ${hud(state)}
      <p class="eyebrow">战斗胜利 · 获得 ${reward.gold} 两</p>
      <h1 class="screen-title">听声学招</h1>
      <p class="screen-subtitle">选择一个粤语短语加入本局技能组，或保留现有构筑。</p>
      ${rewardBonus(reward)}
      <div class="reward-skills">${cards}</div>
      <button class="ghost-button full-button" type="button" data-action="reward-skip">跳过本次学习</button>
    </section>`;
}

function endTemplate(state: GameState, engine: GameEngine, victory: boolean): string {
  const summary = engine.getRunSummary();
  return `
    <section class="screen end-screen ${victory ? "victory" : "defeat"}">
      <div class="end-seal">${victory ? "胜" : "落"}</div>
      <p class="eyebrow">${victory ? "十层尽破" : `止步第 ${summary.floor} 层`}</p>
      <h1 class="screen-title">${victory ? "你的声音响彻龙楼" : "声气未绝，下次再来"}</h1>
      <p class="screen-subtitle">${victory ? "九龙声煞已散。你带着一路学会的粤语短句走下天台。" : "本局路线与收获会被结算，重新开局将生成新的楼层。"}</p>
      <div class="summary-grid">
        <div class="summary-card"><strong>${summary.enemies}</strong><small>击败敌人</small></div>
        <div class="summary-card"><strong>${summary.averageScore}</strong><small>平均声韵</small></div>
        <div class="summary-card"><strong>${summary.bestScore}</strong><small>最高声韵</small></div>
        <div class="summary-card"><strong>${summary.skills}</strong><small>技能总数</small></div>
      </div>
      <div class="button-row">
        <button class="ghost-button" type="button" data-action="back-title">返回标题</button>
        <button class="primary-button" type="button" data-action="restart-run">再闯一局</button>
      </div>
    </section>`;
}

interface PendingVoice {
  skill: Skill;
  result: VoiceScoreResult | null;
}

export class GameUI {
  private engine: GameEngine;
  private voiceAdapter: VoiceAdapter;
  private root: HTMLElement;
  private topbar: HTMLElement;
  private modalRoot: HTMLElement;
  private toastNode: HTMLElement;
  private inventoryButton: HTMLElement;
  private lastNotice: string | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingVoice: PendingVoice | null = null;

  constructor({ engine, voiceAdapter }: { engine: GameEngine; voiceAdapter: VoiceAdapter }) {
    this.engine = engine;
    this.voiceAdapter = voiceAdapter;
    this.root = document.querySelector<HTMLElement>("#app")!;
    this.topbar = document.querySelector<HTMLElement>("#topbar")!;
    this.modalRoot = document.querySelector<HTMLElement>("#modal-root")!;
    this.toastNode = document.querySelector<HTMLElement>("#toast")!;
    this.inventoryButton = document.querySelector<HTMLElement>("#inventory-button")!;
    this.bindEvents();
    const platformLabel = document.querySelector<HTMLElement>("#platform-label");
    if (platformLabel) platformLabel.textContent = getPlatformLabel();
  }

  private bindEvents(): void {
    this.root.addEventListener("click", (event) => this.handleAction(event));
    this.modalRoot.addEventListener("click", (event) => this.handleModalAction(event));
    this.inventoryButton.addEventListener("click", () => this.openInventory());
    document.querySelector("#help-button")?.addEventListener("click", () => this.openHelp());
  }

  private handleAction(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!button || (button as HTMLButtonElement).disabled) return;
    const action = button.dataset.action!;
    if (action === "new-run") this.confirmNewRun();
    if (action === "continue-run") {
      const payload = loadGame();
      if (payload) this.engine.load(payload.state);
      else this.engine.startNew();
    }
    if (action === "show-help") this.openHelp();
    if (action === "choose-floor") this.engine.chooseFloorOption(button.dataset.optionId!);
    if (action === "cast-skill") this.openVoice(getSkill(button.dataset.skillId!));
    if (action === "end-turn") this.engine.endTurn();
    if (action === "event-choice") this.engine.resolveEvent(button.dataset.choiceId!);
    if (action === "leave-event") this.engine.leaveEvent();
    if (action === "rest") this.engine.rest(button.dataset.restAction!);
    if (action === "buy-offer") this.engine.buyOffer(button.dataset.offerKey!);
    if (action === "leave-shop") this.engine.leaveShop();
    if (action === "reward-skill") this.engine.chooseReward(button.dataset.skillId!);
    if (action === "reward-skip") this.engine.chooseReward();
    if (action === "restart-run") {
      clearSave();
      this.engine.startNew();
    }
    if (action === "back-title") {
      clearSave();
      this.engine.showTitle();
    }
  }

  private handleModalAction(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!button || (button as HTMLButtonElement).disabled) return;
    const action = button.dataset.action!;
    if (action === "close-modal") this.closeModal();
    if (action === "start-listening") this.startListening();
    if (action === "stop-listening") this.voiceAdapter.stop();
    if (action === "toggle-fallback") this.toggleFallback();
    if (action === "submit-fallback") this.submitFallback();
    if (action === "apply-voice") this.applyVoiceResult();
    if (action === "use-item") {
      this.engine.useItem(Number(button.dataset.itemIndex));
      this.openInventory();
    }
    if (action === "confirm-abandon") {
      clearSave();
      this.closeModal();
      this.engine.startNew();
    }
  }

  render(state: GameState, options: EmitOptions = {}): void {
    const isTitle = state.phase === "title";
    this.topbar.hidden = isTitle;
    if (!isTitle) {
      const count = state.player ? state.player.items.length + state.player.relics.length : 0;
      const badge = this.inventoryButton.querySelector("b");
      if (badge) badge.textContent = String(count);
    }

    if (state.phase === "title") this.root.innerHTML = titleTemplate();
    else if (state.phase === "tower") this.root.innerHTML = towerTemplate(state, this.engine);
    else if (state.phase === "battle") this.root.innerHTML = battleTemplate(state, this.engine);
    else if (state.phase === "event") this.root.innerHTML = eventTemplate(state);
    else if (state.phase === "rest") this.root.innerHTML = restTemplate(state);
    else if (state.phase === "shop") this.root.innerHTML = shopTemplate(state);
    else if (state.phase === "reward") this.root.innerHTML = rewardTemplate(state);
    else if (state.phase === "victory") this.root.innerHTML = endTemplate(state, this.engine, true);
    else if (state.phase === "defeat") this.root.innerHTML = endTemplate(state, this.engine, false);

    if (state.notice && state.notice !== this.lastNotice) {
      this.lastNotice = state.notice;
      this.showToast(state.notice);
    }
    if (options.effect === "hit") {
      const target = this.root.querySelector(".enemy-avatar");
      target?.classList.add("hit-shake");
      vibrate("light");
    }
    if (options.effect === "enemy" || options.effect === "defeat") vibrate("heavy");
  }

  private confirmNewRun(): void {
    if (!hasSave()) {
      this.engine.startNew();
      return;
    }
    this.modalRoot.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-head"><div><h2>重新开局？</h2><p>现有爬塔存档会被覆盖。</p></div><button class="close-button" data-action="close-modal">×</button></div>
        <div class="notice-strip">新路线会重新生成，当前技能、遗物和层数不会保留。</div>
        <button class="danger-button full-button" type="button" data-action="confirm-abandon">放弃当前进度</button>
      </div>`;
  }

  private openVoice(skill: Skill | undefined): void {
    if (!skill || !this.engine.canUseSkill(skill.id)) return;
    this.pendingVoice = { skill, result: null };
    const supported = this.voiceAdapter.supported;
    this.modalRoot.innerHTML = `
      <div class="modal-sheet voice-sheet">
        <div class="modal-head">
          <div><h2>开声发动技能</h2><p>照着粤拼说出短句，识别越准确，技能威力越高。</p></div>
          <button class="close-button" type="button" data-action="close-modal">×</button>
        </div>
        <div class="voice-phrase">
          <strong>${escapeHtml(skill.phrase)}</strong>
          <span>${escapeHtml(skill.jyutping)}</span>
          <small>${escapeHtml(skill.lesson)}</small>
        </div>
        <div class="voice-orb-wrap">
          <div class="voice-orb" id="voice-orb">待开声</div>
        </div>
        <p class="voice-live-text" id="voice-live-text">${supported ? "点击按钮后，请清晰说出上方短句" : "当前环境没有语音识别，可用键盘测试判定"}</p>
        <div class="voice-actions">
          <button class="primary-button full-button" type="button" data-action="start-listening" ${supported ? "" : "disabled"}>开始收音</button>
          <button class="ghost-button full-button" type="button" data-action="toggle-fallback">${supported ? "使用键盘测试" : "打开键盘测试"}</button>
        </div>
        <div class="fallback-panel" id="fallback-panel" ${supported ? "hidden" : ""}>
          <label for="fallback-transcript">模拟识别到的文字</label>
          <input id="fallback-transcript" type="text" value="${escapeHtml(skill.phrase)}" autocomplete="off" />
          <div class="range-line"><label for="fallback-confidence">模拟识别置信度</label><strong id="confidence-value">82%</strong></div>
          <input id="fallback-confidence" type="range" min="30" max="100" value="82" />
          <button class="secondary-button full-button" type="button" data-action="submit-fallback" style="margin-top:10px">计算并发动</button>
        </div>
        <p class="voice-disclaimer">当前分数由识别文本相似度与 ASR 置信度合成，只用于游戏反馈，不等同于专业声学发音测评。</p>
      </div>`;
    const slider = this.modalRoot.querySelector<HTMLInputElement>("#fallback-confidence");
    const sliderValue = this.modalRoot.querySelector<HTMLElement>("#confidence-value");
    slider?.addEventListener("input", () => {
      if (sliderValue) sliderValue.textContent = `${slider.value}%`;
    });
  }

  private startListening(): void {
    if (!this.pendingVoice) return;
    const { skill } = this.pendingVoice;
    const orb = this.modalRoot.querySelector<HTMLElement>("#voice-orb");
    const text = this.modalRoot.querySelector<HTMLElement>("#voice-live-text");
    const startButton = this.modalRoot.querySelector<HTMLButtonElement>(
      '[data-action="start-listening"]'
    );
    if (startButton) startButton.disabled = true;
    this.voiceAdapter.start({
      targets: skill.alternatives || [skill.phrase],
      jyutping: skill.jyutping,
      onState: (state: VoiceAdapterState) => {
        if (!orb) return;
        if (state === "listening") {
          orb.classList.add("listening");
          orb.textContent = "收音中";
        } else if (state === "processing") {
          orb.classList.remove("listening");
          orb.textContent = "判定中";
        }
      },
      onInterim: (transcript: string) => {
        if (text) text.textContent = `听到：${transcript}`;
      },
      onResult: (result) => this.showVoiceResult(result),
      onError: (error: Error) => {
        if (orb) {
          orb.classList.remove("listening");
          orb.textContent = "未识别";
        }
        if (text) text.textContent = `${error.message}，请改用键盘测试。`;
        this.showFallback();
        if (startButton) startButton.disabled = false;
      }
    });
  }

  private toggleFallback(): void {
    const panel = this.modalRoot.querySelector<HTMLElement>("#fallback-panel");
    if (!panel) return;
    panel.hidden = !panel.hidden;
  }

  private showFallback(): void {
    const panel = this.modalRoot.querySelector<HTMLElement>("#fallback-panel");
    if (panel) panel.hidden = false;
  }

  private submitFallback(): void {
    if (!this.pendingVoice) return;
    const transcript =
      this.modalRoot.querySelector<HTMLInputElement>("#fallback-transcript")?.value || "";
    const confidence =
      Number(this.modalRoot.querySelector<HTMLInputElement>("#fallback-confidence")?.value || 72) /
      100;
    const skill = this.pendingVoice.skill;
    const result = scorePronunciation(skill.alternatives || [skill.phrase], transcript, confidence);
    this.showVoiceResult({ ...result, source: "manual-test" });
  }

  private showVoiceResult(result: VoiceScoreResult): void {
    if (!this.pendingVoice) return;
    this.pendingVoice.result = result;
    const { skill } = this.pendingVoice;
    const confidence = result.confidence ?? Math.round((result.rawConfidence || 0.72) * 100);
    this.modalRoot.innerHTML = `
      <div class="modal-sheet score-result">
        <div class="modal-head">
          <div><h2>${escapeHtml(scoreLabel(result.score))}</h2><p>「${escapeHtml(skill.phrase)}」本次声韵判定</p></div>
          <button class="close-button" type="button" data-action="close-modal">×</button>
        </div>
        <div class="score-ring" style="--score:${result.score}"><div><strong>${result.score}</strong><small>声韵分</small></div></div>
        <p class="screen-subtitle">识别到：${escapeHtml(result.transcript || "未返回文字")}</p>
        <div class="score-breakdown">
          <div><strong>${result.similarity ?? 0}%</strong><small>短句相似度</small></div>
          <div><strong>${confidence}%</strong><small>识别置信度</small></div>
        </div>
        <button class="primary-button full-button" type="button" data-action="apply-voice">发动「${escapeHtml(skill.name)}」</button>
        <p class="voice-disclaimer">遗物、喉糖、永久声韵与敌方干扰会在发动时计入最终战斗分数。</p>
      </div>`;
  }

  private applyVoiceResult(): void {
    if (!this.pendingVoice?.result) return;
    const { skill, result } = this.pendingVoice;
    this.pendingVoice = null;
    this.closeModal(false);
    this.engine.resolveSkill(skill.id, result.score, result);
  }

  private openInventory(): void {
    const player = this.engine.state.player;
    if (!player) return;
    const relics = player.relics.length
      ? player.relics
          .map((id) => {
            const relic = RELICS.find((entry) => entry.id === id)!;
            return `<div class="inventory-item"><span class="item-mark">${escapeHtml(relic.short)}</span><div><strong>${escapeHtml(relic.name)}</strong><small>${escapeHtml(relic.description)}</small></div><span></span></div>`;
          })
          .join("")
      : `<div class="notice-strip">尚未获得遗物。击败第五层强敌可获得一件。</div>`;
    const items = player.items.length
      ? player.items
          .map((id, index) => {
            const item = ITEMS.find((entry) => entry.id === id)!;
            return `<div class="inventory-item"><span class="item-mark">${escapeHtml(item.short)}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></div><button class="mini-button" type="button" data-action="use-item" data-item-index="${index}">使用</button></div>`;
          })
          .join("")
      : `<div class="notice-strip">行囊里没有消耗品。</div>`;
    this.modalRoot.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-head"><div><h2>随身行囊</h2><p>${player.deck.length} 张技能 · ${player.gold} 两 · 永久声韵 +${player.voiceMastery}</p></div><button class="close-button" data-action="close-modal">×</button></div>
        <div class="section-label"><h2>遗物</h2><p>${player.relics.length} 件</p></div>
        <div class="inventory-list">${relics}</div>
        <div class="section-label"><h2>消耗品</h2><p>${player.items.length} 件</p></div>
        <div class="inventory-list">${items}</div>
      </div>`;
  }

  private openHelp(): void {
    const adapterLabel = this.voiceAdapter.supported
      ? "当前环境可直接收音"
      : "当前环境使用键盘测试回退";
    this.modalRoot.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-head"><div><h2>如何登楼</h2><p>${escapeHtml(adapterLabel)}</p></div><button class="close-button" data-action="close-modal">×</button></div>
        <div class="help-steps">
          <div class="help-step"><b>1</b><div><strong>逐层择路</strong><small>普通楼层随机出现战斗、事件、歇脚处与夜市；第五层为强敌，第十层为最终首领。</small></div></div>
          <div class="help-step"><b>2</b><div><strong>开声出招</strong><small>选择技能后说出卡牌上的粤语短句。每回合有 3 点声气，技能会消耗 1 至 2 点。</small></div></div>
          <div class="help-step"><b>3</b><div><strong>发音影响威力</strong><small>未稳 0.52 倍、入门 0.78 倍、清晰 1 倍、正音 1.32 倍。分数由文本相似度与识别置信度合成。</small></div></div>
          <div class="help-step"><b>4</b><div><strong>构筑与存档</strong><small>战后从三张技能中选一张，收集遗物和道具。每次行动都会自动保存到当前设备。</small></div></div>
        </div>
        <div class="notice-strip">从 P1 起可在设置页下载端侧粤语识别模型：语音不出设备、完全离线可玩（见 docs/REDESIGN-PLAN.md）。</div>
      </div>`;
  }

  private closeModal(cancelVoice = true): void {
    if (cancelVoice) this.voiceAdapter.cancel();
    this.pendingVoice = cancelVoice ? null : this.pendingVoice;
    this.modalRoot.innerHTML = "";
  }

  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastNode.textContent = message;
    this.toastNode.hidden = false;
    this.toastTimer = setTimeout(() => {
      this.toastNode.hidden = true;
    }, 2400);
  }
}

export { escapeHtml, skillCard };
