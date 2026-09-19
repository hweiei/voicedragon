import { buildEnabled, removalPrice, removalReason, upgradeReason } from "../core/buildcraft";
import {
  type BuildOperation,
  type BuildView,
  buildConfirmTemplate,
  buildViewTemplate,
  skillTags,
  synergyMarkup
} from "./buildcraft";
/**
 * 渲染层：DOM 直渲适配器（P1 版）。
 * P1 新增：QTE 无声施法「破阵拍」、TTS 示范发音（听一听）、设置页
 * （语音引擎切换/模型下载管理/声音与动效开关/隐私说明）、适配器热切换。
 * 选择器/CSS 类名契约与 P0 保持一致。
 */

import { getPlatformLabel, vibrate } from "../adapters/platform";
import {
  clearSave,
  hasSave,
  loadCampaignMeta,
  loadDailyRecords,
  loadGame,
  loadProfile,
  loadSrsStore,
  saveDailyRecord,
  saveProfile,
  saveSrsStore
} from "../adapters/storage";
import type { GameSettings } from "../adapters/storage";
import type {
  VoiceAdapter,
  VoiceAdapterState,
  VoiceMode,
  VoiceScoreResult
} from "../adapters/voice";
import type { ModelStatus } from "../adapters/voice/sensevoice/model-store";
import type { DownloadProgress } from "../adapters/voice/sensevoice/model-store";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_POINTS_TOTAL,
  achievementPoints,
  newlyUnlocked
} from "../core/achievements";
import type { AchievementContext } from "../core/achievements";
import {
  ACT_COUNT,
  ACT_NUMERALS,
  ALL_EVENTS,
  ALL_RELICS,
  ALL_SKILLS,
  ALL_ITEMS as ITEMS,
  actContent,
  codexEnemyList,
  lookupRelic,
  lookupSkill
} from "../core/content";
import { dailySeedForKey, dateKeyFor } from "../core/daily";
import type { Skill } from "../core/data";
import { NODE_META } from "../core/engine";
import type { EmitOptions, GameEngine, GameState, RunSummary } from "../core/engine";
import { generateActMap } from "../core/levelgen";
import type { ActNode } from "../core/levelgen";
import { mutationList } from "../core/mutators";
import { countSrsGraduated, markCodexSeen, recordRunEnd, recordVoiceCast } from "../core/profile";
import type { ProfileStore } from "../core/profile";
import { scoreLabel, scorePronunciation } from "../core/scoring";
import { buildLearningReport, dailyPicks, recordAttempt } from "../core/srs";
import {
  type PitchFrame,
  TONE_TEMPLATES,
  expectedToneGuides,
  normalizeContour,
  parseJyutpingTones,
  previewTemplateCurve,
  resamplePoints
} from "../core/tone";
import { playBattleFx } from "./fx";
import { VoiceAura } from "./fx/voice-aura";
import { drawRunPoster, sharePoster } from "./poster";
import { VocalQte } from "./qte";

/** 标题屏战役幕按钮：act 2/3 需上一幕 Boss 已通关（元存档 bossCleared 只升不降）。 */
function titleCampaignActButtons(): string {
  const meta = loadCampaignMeta();
  const buttons: string[] = [];
  for (let act = 2; act <= ACT_COUNT; act += 1) {
    const unlocked = Boolean(meta?.acts[String(act - 1)]?.bossCleared);
    if (!unlocked) continue;
    const pack = actContent(act);
    buttons.push(
      `<button class="ghost-button full-button" type="button" data-action="new-campaign" data-act="${act}">战役 · 第${ACT_NUMERALS[act - 1]}幕 · ${escapeHtml(pack.theme)}</button>`
    );
  }
  return buttons.join("");
}

// ─── P4 玩家档案缓存（读档/语音/结算时持久化） ───────────────────────────────

const profileCache: ProfileStore = loadProfile();

function persistProfile(mutate: (profile: ProfileStore) => void): void {
  mutate(profileCache);
  saveProfile(profileCache);
}

/** 由战役种子确定性重算问答节点 id 集（用于成就「问答状元」计数）。 */
function mapQuizNodeIds(mapSeed: number): string[] {
  return generateActMap(mapSeed)
    .nodes.filter((node) => node.type === "quiz")
    .map((node) => node.id);
}

/** P4 主题档：extended 主题需成就点解锁 */
const THEME_DEFS = [
  { id: "ink", name: "墨色", requirement: 0, desc: "默认 · 水墨金印" },
  { id: "neon", name: "霓虹", requirement: 60, desc: "成就点 60 解锁 · 赛博纸醉" },
  { id: "paper", name: "宣纸", requirement: 120, desc: "成就点 120 解锁 · 米白粉彩" }
] as const;

type ThemeId = (typeof THEME_DEFS)[number]["id"];

// ─── 注入服务（组合根提供） ───────────────────────────────────────────────────

export interface VoiceServices {
  tts: {
    speak(text: string): void;
    stop(): void;
  };
  settings: {
    get(): GameSettings;
    save(partial: Partial<GameSettings>): void;
  };
  model: {
    getStatus(): Promise<ModelStatus>;
    download(): Promise<void>;
    clear(): Promise<void>;
    onProgress(listener: (progress: DownloadProgress | null) => void): () => void;
  };
  setVoiceMode(mode: VoiceMode): Promise<string>;
}

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

/** P6-F2：血条 scaleX 比例（合成器-only 排空，替代 width 触发 layout）。 */
function ratio(value: number, max: number): string {
  if (!max) return "0";
  return Math.max(0, Math.min(1, value / max)).toFixed(4);
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

/** P3 练习场：期望调型（金）与用户基频轮廓（青）双曲线绘制。 */
function drawPitchCurves(
  canvas: HTMLCanvasElement,
  template: number[] | null,
  user: number[] | null,
  perSyllable: number[] | null,
  syllableCount: number
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
  const height = canvas.clientHeight || 150;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const extent = 6; // 纵轴 ±6 半音
  const yOf = (value: number) => height / 2 - (value / extent) * (height / 2 - 10);

  // 网格：中线 + ±3/±6 半音线
  ctx.strokeStyle = "rgba(232, 209, 167, 0.12)";
  ctx.lineWidth = 1;
  for (const mark of [-6, -3, 0, 3, 6]) {
    ctx.beginPath();
    ctx.moveTo(0, yOf(mark));
    ctx.lineTo(width, yOf(mark));
    ctx.stroke();
  }

  // 音节分界
  if (syllableCount > 1) {
    ctx.strokeStyle = "rgba(232, 209, 167, 0.08)";
    for (let i = 1; i < syllableCount; i += 1) {
      const x = (i / syllableCount) * width;
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x, height - 4);
      ctx.stroke();
    }
  }

  const paint = (curve: number[], color: string, dashed: boolean) => {
    if (curve.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.setLineDash(dashed ? [6, 5] : []);
    ctx.beginPath();
    curve.forEach((value, index) => {
      const x = curve.length === 1 ? width / 2 : (index / (curve.length - 1)) * width;
      const y = yOf(value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };

  if (template) paint(template, "rgba(240, 207, 131, 0.85)", true);
  if (user) paint(user, "#63aab0", false);

  // 音节级评分圆点（颜色即档位，与战斗 tier 一致）
  if (perSyllable?.length) {
    perSyllable.forEach((value, index) => {
      const x = ((index + 0.5) / perSyllable.length) * width;
      const color = value >= 85 ? "#79b892" : value >= 65 ? "#f0cf83" : "#f36a55";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, 12, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function skillCard(
  skill: Skill,
  options: { action?: string; disabled?: boolean; deckIndex?: number } = {}
): string {
  const action = options.action || "cast-skill";
  const disabled = Boolean(options.disabled);
  const extraClass = disabled ? " locked" : "";
  return `
    <button class="skill-card${extraClass}" type="button" data-action="${action}" data-skill-id="${escapeHtml(skill.id)}" ${options.deckIndex !== undefined ? `data-deck-index="${options.deckIndex}"` : ""} data-type-mark="${skillTypeMark(skill)}" ${disabled ? "disabled" : ""}>
      <span class="skill-cost">${skill.cost}</span>
      <strong>${escapeHtml(skill.name)}</strong>
      <span class="jyutping">${escapeHtml(skill.jyutping)}</span>
      <span class="meaning">${escapeHtml(skill.lesson)}</span>
      <span class="effect">${escapeHtml(skillDescription(skill))}</span>
      ${skillTags(skill)}
    </button>`;
}

function challengeBanner(state: GameState): string {
  const challenge = state.challenge;
  if (!challenge)
    return state.ruleset === "p7"
      ? `<div class="content-version">三幕深耕 · 扩展内容池${buildEnabled(state) ? " · 构筑已开启" : ""}</div>`
      : "";
  return `<aside class="challenge-banner" aria-label="本局变异词缀">
    <strong>${challenge.mode === "daily" ? `每日挑战 · ${escapeHtml(challenge.dateKey ?? "")}` : `无尽变异 · 第 ${challenge.stage * 5 + 1}–${challenge.stage * 5 + 5} 层`}</strong>
    ${mutationList(challenge.mutatorIds)
      .map(
        (entry) =>
          `<div class="mutation-rule" data-kind="${entry.kind}"><b>${entry.kind === "pressure" ? "试炼" : "助力"} · ${escapeHtml(entry.name)}</b><span>${escapeHtml(entry.description)}</span></div>`
      )
      .join("")}
  </aside>`;
}

function hud(state: GameState): string {
  const player = state.player!;
  return `
    <div class="hud-grid">
      <div class="hud-card">
        <small>生命</small>
        <strong>${player.hp} / ${player.maxHp}</strong>
        <div class="hp-meter"><span style="transform:scaleX(${ratio(player.hp, player.maxHp)})"></span></div>
      </div>
      <div class="hud-card"><small>楼层</small><strong>${state.endless ? `第 ${state.floor} 层 · ∞` : `${state.floor} / ${state.maxFloor}`}</strong></div>
      <div class="hud-card"><small>银两</small><strong>${player.gold} 两</strong></div>
      <div class="hud-card"><small>声韵</small><strong>+${player.voiceMastery}</strong></div>
    </div>`;
}

/** P3 每日挑战状态的展示文案。 */
function dailyStatusLabel(): string {
  const todayKey = dateKeyFor(new Date());
  const record = loadDailyRecords("p7")[todayKey];
  if (!record) return "今日未挑战";
  if (record.victory) return `今日已通关 · 综合 ${record.averageScore}`;
  return `今日已到第 ${record.floor} 层 · 综合 ${record.averageScore}`;
}

/** 标题屏的「每日三句」错词复习卡（无错词时不渲染）。 */
function titleReviewStrip(): string {
  const picks = dailyPicks(loadSrsStore(), new Date(), 3);
  if (!picks.length) return "";
  const chips = picks
    .map((entry) => {
      const skill = lookupSkill(entry.id);
      if (!skill) return "";
      return `<button class="review-chip" type="button" data-action="practice-select" data-skill-id="${escapeHtml(skill.id)}">
        <strong>${escapeHtml(skill.phrase)}</strong>
        <small>${escapeHtml(skill.jyutping)}</small>
        <span class="review-score">${entry.lastScore}分</span>
      </button>`;
    })
    .join("");
  return `
    <div class="panel review-strip">
      <div class="review-strip-head"><strong>每日三句</strong><small>错词本按记忆曲线推送，点一句直接练</small></div>
      <div class="review-chips">${chips}</div>
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
        <p class="content-version">三幕深耕 · ${ALL_SKILLS.length} 招式 · ${ALL_EVENTS.length} 奇遇 · ${ITEMS.length} 道具<br />战役开新局体验；旧存档保留原规则<br />构筑新玩法：歇脚升级 · 夜市删牌</p>
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
        <button class="${resume ? "ghost-button" : "secondary-button"} full-button" type="button" data-action="new-campaign">战役 · 第一幕 · 骑楼长街</button>
        ${titleCampaignActButtons()}
        <button class="ghost-button full-button" type="button" data-action="daily-challenge">每日挑战 · ${escapeHtml(dailyStatusLabel())}</button>
        <button class="ghost-button full-button" type="button" data-action="endless-run">无尽塔 · 深塔回廊（最佳 ${profileCache.stats.endlessBest} 层）</button>
        <div class="title-quick">
          <button class="ghost-button" type="button" data-action="open-practice">练习场 · 调准曲线</button>
          <button class="ghost-button" type="button" data-action="open-report">学习报告</button>
          <button class="ghost-button" type="button" data-action="open-achievements">成就</button>
          <button class="ghost-button" type="button" data-action="open-codex">图鉴</button>
        </div>
        ${titleReviewStrip()}
        <button class="ghost-button full-button" type="button" data-action="show-help">玩法与语音说明</button>
        <button class="ghost-button full-button" type="button" data-action="open-settings">设置 · 语音引擎</button>
        <p class="title-note">语音识别全部可选：经在线兜底引擎、可下载端侧模型（完全离线）、无声破阵拍三种方式施法。</p>
      </div>
    </section>`;
}

function towerTemplate(state: GameState, engine: GameEngine): string {
  const nextFloor = state.floor + 1;
  const player = state.player!;
  const lessonId = player.deck[(state.floor + 1) % player.deck.length];
  const lesson = lookupSkill(lessonId)!;
  const dots = state.endless
    ? ""
    : Array.from({ length: state.maxFloor }, (_, index) => {
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
      ${challengeBanner(state)}
      ${state.endless ? "" : `<div class="floor-progress">${dots}</div>`}
      <div class="floor-heading">
        <div>
          <p class="eyebrow">选择下一道门</p>
          <h1 class="screen-title">${escapeHtml(engine.getFloorName(nextFloor))}</h1>
          <p class="screen-subtitle">门后内容已由本局种子生成，读档不会改变。</p>
        </div>
        <div class="floor-number">${String(nextFloor).padStart(2, "0")}</div>
      </div>
      ${(state.adaptiveBoost ?? 0) !== 0 ? `<div class="adaptive-chip">自适应难度已${state.adaptiveBoost! > 0 ? "上调" : "减压"} ${(Math.abs(state.adaptiveBoost!) * 100).toFixed(0)}%</div>` : ""}
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

// ─── P2 战役地图（7×15 分支） ─────────────────────────────────────────────────

function mapNodeCell(state: GameState, node: ActNode): string {
  const campaign = state.campaign!;
  const meta = NODE_META[node.type];
  const available = new Set(state.floorOptions.map((option) => option.id));
  const isAvailable = available.has(node.id);
  const isCleared = campaign.clearedIds.includes(node.id);
  const stars = campaign.stars[node.id] ?? 0;
  const classes = [
    "map-node",
    `tone-${meta.tone}`,
    node.type === "boss" ? "is-boss" : "",
    isAvailable ? "is-available" : "",
    isCleared ? "is-cleared" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const attrs = isAvailable
    ? `data-action="choose-floor" data-option-id="${escapeHtml(node.id)}"`
    : "disabled";
  const caption =
    stars > 0
      ? `<small class="map-pips">${"★".repeat(Math.min(3, stars))}${"☆".repeat(3 - Math.min(3, stars))}</small>`
      : `<small class="map-pips dim">${escapeHtml(isAvailable ? meta.label : "")}</small>`;
  return `<div class="map-cell" style="grid-column:${node.col + 1}"><button class="${classes}" type="button" ${attrs} aria-label="${escapeHtml(meta.label)} ${escapeHtml(node.id)}">${escapeHtml(meta.mark)}</button>${caption}</div>`;
}

function campaignMapTemplate(state: GameState): string {
  const campaign = state.campaign!;
  const map = campaign.map;
  const cleared = new Set(campaign.clearedIds);
  const totalStars = Object.values(campaign.stars).reduce((sum, value) => sum + value, 0);
  const nodeIndex = new Map(map.nodes.map((node) => [node.id, node]));
  const rowHeight = 48;

  const rows: string[] = [];
  for (let row = map.rows - 1; row >= 0; row -= 1) {
    const cells = map.nodes
      .filter((node) => node.row === row)
      .sort((a, b) => a.col - b.col)
      .map((node) => mapNodeCell(state, node))
      .join("");
    rows.push(`<div class="map-row">${cells}</div>`);
  }

  const edgeLines = map.edges
    .map((edge) => {
      const from = nodeIndex.get(edge.from)!;
      const to = nodeIndex.get(edge.to)!;
      const x1 = (from.col + 0.5) * (700 / map.cols);
      const y1 = (map.rows - 1 - from.row + 0.5) * rowHeight;
      const x2 = (to.col + 0.5) * (700 / map.cols);
      const y2 = (map.rows - 1 - to.row + 0.5) * rowHeight;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cleared.has(edge.from) ? "lit" : ""}" />`;
    })
    .join("");

  return `
    <section class="screen map-screen">
      ${hud(state)}
      ${challengeBanner(state)}
      <div class="map-head">
        <div>
          <p class="eyebrow">第${ACT_NUMERALS[campaign.act - 1]}幕 · ${escapeHtml(actContent(campaign.act).theme)}</p>
          <h1 class="screen-title">沿分支路线登上声煞之巅</h1>
        </div>
        <div class="map-total"><strong>${totalStars}</strong><small>累计星辉</small></div>
      </div>
      ${state.notice ? `<div class="notice-strip">${escapeHtml(state.notice)}</div>` : ""}
      <div class="map-scroll">
        <div class="map-canvas">
          <svg class="map-edges" viewBox="0 0 700 ${map.rows * rowHeight}" preserveAspectRatio="none" aria-hidden="true">${edgeLines}</svg>
          <div class="map-rows">${rows.join("")}</div>
        </div>
      </div>
      <p class="map-legend">战 战斗 · 遇 奇遇 · 歇 歇脚 · 市 夜市 · 险 强敌 · 宝 宝箱 · 问 问答 · 首 首领</p>
    </section>`;
}

function quizTemplate(state: GameState): string {
  const quiz = state.quiz!;
  const question = quiz.questions[quiz.index];
  const answered = quiz.selected !== null;
  const options = question.options
    .map((option, index) => {
      let cls = "choice-button quiz-option";
      let mark = "›";
      if (answered) {
        if (index === question.answerIndex) {
          cls += " is-correct";
          mark = "✓";
        } else if (index === quiz.selected) {
          cls += " is-wrong";
          mark = "✗";
        }
      }
      return `
        <button class="${cls}" type="button" data-action="quiz-answer" data-option-index="${index}" ${answered ? "disabled" : ""}>
          <span><strong>${escapeHtml(option)}</strong></span><span>${mark}</span>
        </button>`;
    })
    .join("");
  return `
    <section class="screen story-screen">
      ${hud(state)}
      ${challengeBanner(state)}
      <p class="eyebrow">街坊问答 · 第 ${quiz.index + 1} / ${quiz.questions.length} 题 · 已答对 ${quiz.correct} 题</p>
      <h1 class="screen-title quiz-question">${escapeHtml(question.question)}</h1>
      <div class="choice-list">${options}</div>
      ${
        answered
          ? `<div class="panel outcome-card">${escapeHtml(question.explain)}</div>
             <button class="primary-button full-button" type="button" data-action="quiz-next">${quiz.index + 1 < quiz.questions.length ? "下一题" : "收星离开"}</button>`
          : `<p class="screen-subtitle">答对题数即本节点星数，答错也会继续。</p>`
      }
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
      const skill = engine.getDeckSkill(card.index)!;
      return skillCard(skill, {
        disabled: combat.energy < skill.cost || combat.locked,
        deckIndex: card.index
      });
    })
    .join("");
  const log = combat.log[0] || "轮到你开声。";

  return `
    <section class="battle-screen">
      ${challengeBanner(state)}
      <div class="battle-status">
        <div class="combatant-mini">
          <div class="label-line"><strong>你</strong><small>${player.hp}/${player.maxHp}</small></div>
          <div class="hp-meter"><span style="transform:scaleX(${ratio(player.hp, player.maxHp)})"></span></div>
        </div>
        <div class="turn-badge">第<br />${combat.turn} 回</div>
        <div class="combatant-mini enemy">
          <div class="label-line"><strong>${escapeHtml(enemy.name)}</strong><small>${enemy.hp}/${enemy.maxHp}</small></div>
          <div class="enemy-hp-meter"><span style="transform:scaleX(${ratio(enemy.hp, enemy.maxHp)})"></span></div>
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
  // P7 问义事件：作答前不把答案印在释义或分支提示里。
  const quizPending =
    state.ruleset === "p7" &&
    !event.resolved &&
    event.choices.some((choice) => choice.action === "quizCorrect");
  const wrongCost = event.choices.find((choice) => choice.action === "quizWrong")?.value ?? 0;
  const quizHint = `答对声韵 +2（上限 15）；答错失去 ${wrongCost} 生命`;
  const choices = event.choices
    .map(
      (choice) => `
    <button class="choice-button" type="button" data-action="event-choice" data-choice-id="${escapeHtml(choice.id)}">
      <span><strong>${escapeHtml(choice.label)}</strong><small>${escapeHtml(quizPending ? quizHint : choice.hint)}</small></span><span>›</span>
    </button>`
    )
    .join("");
  return `
    <section class="screen story-screen">
      ${hud(state)}
      ${challengeBanner(state)}
      <p class="eyebrow">${escapeHtml(event.kicker)} · 第 ${state.floor} 层</p>
      <h1 class="screen-title">${escapeHtml(event.title)}</h1>
      <div class="story-art"><span class="story-glyph">遇</span></div>
      <div class="panel story-copy">
        <p>${escapeHtml(event.text)}</p>
        <div class="phrase-ribbon">
          <strong>${escapeHtml(event.lesson.phrase)}</strong>
          <span>${escapeHtml(event.lesson.jyutping)}</span>
          <small>${quizPending ? "选择后揭晓释义" : escapeHtml(event.lesson.meaning)}</small>
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
      ${challengeBanner(state)}
      <p class="eyebrow">歇脚处 · 第 ${state.floor} 层</p>
      <h1 class="screen-title">调息练声</h1>
      <p class="screen-subtitle">烛火很稳。你只能选择一种休整方式。</p>
      <div class="story-art"><span class="story-glyph">息</span></div>
      <div class="rest-options">
        ${buildEnabled(state) ? '<div class="rest-card"><h3>磨练一招</h3><p>选择一张牌升级一次，替代本次回血或练声。同名牌分别强化。</p><button class="secondary-button full-button" type="button" data-action="open-build" data-build-mode="upgrade">选择升级</button></div>' : ""}
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
    const item = lookupSkill(offer.id)!;
    return { mark: "技", name: item.name, description: `${item.jyutping} · ${item.lesson}` };
  }
  if (offer.type === "item") {
    const item = ITEMS.find((entry) => entry.id === offer.id)!;
    return { mark: item.short, name: item.name, description: item.description };
  }
  const item = lookupRelic(offer.id)!;
  return { mark: item.short, name: item.name, description: item.description };
}

function shopTemplate(state: GameState): string {
  const offers = state
    .shop!.offers.map((offer) => {
      const detail = offerDetails(offer);
      return `
      <div class="shop-offer">
        <span class="offer-seal">${escapeHtml(detail.mark)}</span>
        <div><h3>${escapeHtml(detail.name)}</h3><p>${escapeHtml(detail.description)}</p>${offer.type === "skill" ? skillTags(lookupSkill(offer.id)!) : ""}${offer.type === "skill" && buildEnabled(state) ? synergyMarkup(lookupSkill(offer.id)!, state.player!) : ""}</div>
        <button class="price-button" type="button" data-action="buy-offer" data-offer-key="${escapeHtml(offer.key)}" ${offer.sold ? "disabled" : ""}>${offer.sold ? "已售" : `${offer.price} 两`}</button>
      </div>`;
    })
    .join("");
  return `
    <section class="screen story-screen">
      ${hud(state)}
      ${challengeBanner(state)}
      <p class="eyebrow">夜市 · 第 ${state.floor} 层</p>
      <h1 class="screen-title">榕树头声货摊</h1>
      <p class="screen-subtitle">货物每局不同，卖出后概不退换。</p>
      ${state.notice ? `<div class="notice-strip">${escapeHtml(state.notice)}</div>` : ""}
      ${buildEnabled(state) ? `<div class="panel build-service"><h3>精简牌组 · ${removalPrice(state.player!)} 两</h3><p>本店限一次，至少留 5 张及一张输出牌；服务不打折。</p><button class="secondary-button full-button" type="button" data-action="open-build" data-build-mode="remove" ${state.shop!.removalUsed ? "disabled" : ""}>${state.shop!.removalUsed ? "本店已删牌" : "选择删牌"}</button></div>` : ""}
      <div class="shop-grid">${offers}</div>
      <button class="ghost-button full-button" type="button" data-action="leave-shop" style="margin-top:14px">离开夜市</button>
    </section>`;
}

function rewardBonus(reward: { bonus: { type: string; id: string } | null }): string {
  if (!reward.bonus) return "";
  const source = reward.bonus.type === "relic" ? ALL_RELICS : ITEMS;
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
    .map(
      (id) =>
        `<div class="reward-candidate">${skillCard(lookupSkill(id)!, { action: "reward-skill" })}${buildEnabled(state) ? synergyMarkup(lookupSkill(id)!, state.player!) : ""}</div>`
    )
    .join("");
  return `
    <section class="screen">
      ${hud(state)}
      ${challengeBanner(state)}
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
  const campaignStars = state.campaign
    ? Object.values(state.campaign.stars).reduce((sum, value) => sum + value, 0)
    : 0;
  const campaignLine = state.campaign
    ? `<p class="screen-subtitle">第${ACT_NUMERALS[state.campaign.act - 1]}幕战役星辉累计 <strong>${campaignStars} 颗</strong>（已刻入地图，重打同一幕只会刷新最高纪录）。</p>`
    : "";
  const endlessLine = state.endless
    ? `<p class="screen-subtitle">无尽塔最佳纪录：<strong>${Math.max(loadProfile().stats.endlessBest, summary.floor)} 层</strong>（倒下即刻结算，纪录本地保留）。</p>`
    : "";
  return `
    <section class="screen end-screen ${victory ? "victory" : "defeat"}">
      <div class="end-seal">${victory ? "胜" : "落"}</div>
      <p class="eyebrow">${victory ? (state.campaign ? (state.campaign.act >= ACT_COUNT ? "三幕尽破" : `第${ACT_NUMERALS[state.campaign.act - 1]}幕通关`) : "十层尽破") : state.endless ? `无尽塔止步第 ${summary.floor} 层` : `止步第 ${summary.floor} 层`}</p>
      <h1 class="screen-title">${victory ? "你的声音响彻龙楼" : "声气未绝，下次再来"}</h1>
      ${campaignLine}${endlessLine}
      <p class="screen-subtitle">${victory ? escapeHtml(actContent(state.campaign?.act ?? 1).victoryText) : "本局路线与收获会被结算，重新开局将生成新的楼层。"}</p>
      <div class="summary-grid">
        <div class="summary-card"><strong>${summary.enemies}</strong><small>击败敌人</small></div>
        <div class="summary-card"><strong>${summary.averageScore}</strong><small>平均声韵</small></div>
        <div class="summary-card"><strong>${summary.bestScore}</strong><small>最高声韵</small></div>
        <div class="summary-card"><strong>${summary.skills}</strong><small>技能总数</small></div>
      </div>
      <div class="button-row">
        <button class="ghost-button" type="button" data-action="back-title">返回标题</button>
        <button class="ghost-button" type="button" data-action="share-poster">生成战绩海报</button>
        ${victory && state.campaign && state.campaign.act < ACT_COUNT ? `<button class="primary-button" type="button" data-action="campaign-next-act">乘胜登楼 · 进入第${ACT_NUMERALS[state.campaign.act]}幕</button>` : ""}
        <button class="${victory && state.campaign && state.campaign.act < ACT_COUNT ? "ghost-button" : "primary-button"}" type="button" data-action="restart-run">再闯一局</button>
      </div>
    </section>`;
}

const VOICE_MODE_COPY: Record<VoiceMode, string> = {
  auto: "自动（先用在线引擎，下载端侧模型后自动离线）",
  sensevoice: "端侧 SenseVoice · 完全离线（需先下载约 230MB 模型）",
  webspeech: "Web Speech · 在线识别（零下载）"
};

interface PendingVoice {
  deckIndex?: number;
  combat: GameState["combat"];
  skill: Skill;
  result: VoiceScoreResult | null;
}

export class GameUI {
  private engine: GameEngine;
  private voiceAdapter: VoiceAdapter | null;
  private services: VoiceServices;
  private root: HTMLElement;
  private topbar: HTMLElement;
  private modalRoot: HTMLElement;
  private toastNode: HTMLElement;
  private inventoryButton: HTMLElement;
  private lastNotice: string | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingVoice: PendingVoice | null = null;
  private pendingBuild: {
    operation: BuildOperation;
    index: number;
    id: string;
    player: GameState["player"];
    phase: GameState["phase"];
    floor: number;
    shop: GameState["shop"];
  } | null = null;
  private activeQte: VocalQte | null = null;
  /** P6-F2 语音光环：收音期间的龙吟环（说话可见）。 */
  private voiceAura: VoiceAura | null = null;
  /** P5 新手教学：当前步骤（null=未在教学中）；本会话只自动弹一次 */
  private tutorialStep: number | null = null;
  private tutorialShownThisSession = false;
  private modelUnsubscribe: (() => void) | null = null;
  private lastPhase: string | null = null;
  private combatStartHp: number | null = null;
  /** P3/P4：标题层视图（游戏界面 / 练习场 / 学习报告 / 成就 / 图鉴） */
  private view: "game" | "practice" | "report" | "achievements" | "codex" = "game";
  private practiceSkillId: string | null = null;
  private practiceRecording = false;
  private practiceLiveFrames: PitchFrame[] = [];
  private practiceResult: VoiceScoreResult | null = null;
  private practiceRaf: number | null = null;
  /** P3：本局为每日挑战时记录其日期键（结算时写入战绩） */
  private recordedDailyKey: string | null = null;
  /** P4：本局档案结算去重键（同一局结束只写一次档案） */
  private recordedRunKey: string | null = null;
  /** P4：复用的海报画布（结算屏分享按钮生成） */
  private posterCanvas: HTMLCanvasElement | null = null;

  constructor({
    engine,
    voiceAdapter,
    services
  }: {
    engine: GameEngine;
    voiceAdapter: VoiceAdapter | null;
    services: VoiceServices;
  }) {
    this.engine = engine;
    this.voiceAdapter = voiceAdapter;
    this.services = services;
    this.root = document.querySelector<HTMLElement>("#app")!;
    this.topbar = document.querySelector<HTMLElement>("#topbar")!;
    this.modalRoot = document.querySelector<HTMLElement>("#modal-root")!;
    this.toastNode = document.querySelector<HTMLElement>("#toast")!;
    this.inventoryButton = document.querySelector<HTMLElement>("#inventory-button")!;
    this.bindEvents();
    const platformLabel = document.querySelector<HTMLElement>("#platform-label");
    if (platformLabel) platformLabel.textContent = getPlatformLabel();
  }

  /** 适配器热切换（设置页改语音引擎 / 组合根异步构造完成后注入）。 */
  setVoiceAdapter(adapter: VoiceAdapter): void {
    this.voiceAdapter = adapter;
  }

  private get adapter(): VoiceAdapter | null {
    return this.voiceAdapter;
  }

  private bindEvents(): void {
    this.root.addEventListener("click", (event) => this.handleAction(event));
    this.modalRoot.addEventListener("click", (event) => this.handleModalAction(event));
    this.inventoryButton.addEventListener("click", () => this.openInventory());
    document.querySelector("#help-button")?.addEventListener("click", () => this.openHelp());
    document
      .querySelector("#settings-button")
      ?.addEventListener("click", () => this.openSettings());
  }

  private handleAction(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!button || (button as HTMLButtonElement).disabled) return;
    const action = button.dataset.action!;
    if (action === "new-run") this.confirmNewRun();
    if (action === "new-campaign") {
      const act = Number(button.dataset.act ?? 1);
      this.engine.startCampaign(Number.isFinite(act) ? act : 1, undefined, "p7", 1);
    }
    if (action === "campaign-next-act") this.engine.continueNextAct();
    if (action === "continue-run") {
      const payload = loadGame();
      if (payload) this.engine.load(payload.state);
      else this.engine.startNew();
    }
    if (action === "quiz-answer") this.engine.answerQuizOption(Number(button.dataset.optionIndex));
    if (action === "quiz-next") this.engine.advanceQuiz();
    // ─── P3 标题层动作 ───
    if (action === "daily-challenge") this.startDailyChallenge();
    if (action === "open-practice") this.openPractice();
    if (action === "practice-select") this.openPractice(button.dataset.skillId);
    if (action === "practice-tts") {
      const skill = this.currentPracticeSkill();
      if (skill) this.services.tts.speak(skill.phrase);
    }
    if (action === "practice-record") this.practiceRecord();
    if (action === "practice-stop") this.adapter?.stop();
    if (action === "open-report") this.openReport();
    // ─── P4 标题层动作 ───
    if (action === "endless-run") {
      clearSave();
      this.engine.startEndless(undefined, "p7");
    }
    if (action === "open-achievements") this.openView("achievements");
    if (action === "open-codex") this.openView("codex");
    if (action === "share-poster") void this.shareRunPoster();
    if (action === "close-view") this.closeView();
    if (action === "show-help") this.openHelp();
    if (action === "open-settings") this.openSettings();
    if (action === "choose-floor") this.engine.chooseFloorOption(button.dataset.optionId!);
    if (action === "cast-skill") {
      const index =
        button.dataset.deckIndex === undefined ? undefined : Number(button.dataset.deckIndex);
      this.openVoice(
        index === undefined
          ? lookupSkill(button.dataset.skillId!)
          : this.engine.getDeckSkill(index),
        index
      );
    }
    if (action === "open-build") this.openBuild(button.dataset.buildMode as BuildView);
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
      // P4：无尽局结算后「再闯一局」仍回无尽塔，其余按经典开局
      if (this.engine.state.endless) this.engine.startEndless(undefined, "p7");
      else if (this.engine.state.challenge?.mode === "daily") this.startDailyChallenge();
      else if (this.engine.state.campaign)
        this.engine.startCampaign(this.engine.state.campaign.act, undefined, "p7", 1);
      else this.engine.startNew();
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
    if (action === "open-build") this.openBuild(button.dataset.buildMode as BuildView);
    if (action === "build-select")
      this.selectBuild(
        button.dataset.operation as BuildOperation,
        Number(button.dataset.slot),
        button.dataset.skillId!
      );
    if (action === "confirm-build") this.confirmBuild();
    if (action === "start-listening") this.startListening();
    if (action === "stop-listening") this.adapter?.stop();
    if (action === "toggle-fallback") this.toggleFallback();
    if (action === "submit-fallback") this.submitFallback();
    if (action === "apply-voice") this.applyVoiceResult();
    if (action === "listen-sample") this.listenSample();
    if (action === "start-qte") this.startQte();
    if (action === "download-model") void this.downloadModel(button as HTMLButtonElement);
    if (action === "clear-model") void this.clearModel();
    if (action === "use-item") {
      this.engine.useItem(Number(button.dataset.itemIndex));
      this.openInventory();
    }
    if (action === "confirm-abandon") {
      clearSave();
      this.closeModal();
      this.engine.startNew();
    }
    if (action === "replay-tutorial") {
      this.tutorialShownThisSession = true;
      this.tutorialStep = 1;
      this.renderTutorial();
    }
    if (action === "tutorial-next") {
      this.tutorialStep = Math.min(3, (this.tutorialStep ?? 1) + 1);
      this.renderTutorial();
    }
    if (action === "tutorial-listen") this.services.tts.speak("唔使惊");
    if (action === "tutorial-mic") void this.grantTutorialMic();
    if (action === "tutorial-skip") this.finishTutorial("已选破阵拍——静音场合也能施法");
  }

  /** P5 新手教学：三步引导（§7.3：识招 → 听示范 → 跟读校准 + 剧情化麦克风请求）。 */
  private openTutorial(): void {
    this.tutorialShownThisSession = true;
    this.tutorialStep = 1;
    this.renderTutorial();
  }

  private renderTutorial(): void {
    const step = this.tutorialStep ?? 1;
    const pages: Array<{ head: string; sub: string; body: string }> = [
      {
        head: "第一式 · 识招",
        sub: "声气就是法力",
        body: `
          <p>每回合你有 <strong>3 点声气</strong>，点手牌消耗声气施法。</p>
          <p>施法威力由你的<strong>发音评分</strong>决定：正音 132% · 清晰 100% · 入门 78% · 未稳 52%——<strong>讲得准，打得狠</strong>。</p>
          <p>技能卡下方的粤语小字就是这句招式的意思，边打边学。</p>`
      },
      {
        head: "第二式 · 听示范",
        sub: "六声即六式",
        body: `
          <div class="phrase-ribbon">
            <strong>唔使惊</strong>
            <span>m4 sai2 geng1</span>
            <small>不用怕</small>
          </div>
          <p>先听一遍示范，留意「惊」字的高平调——粤语的六个声调就是六种招式路数。</p>
          <button class="secondary-button full-button" type="button" data-action="tutorial-listen">🔊 再听一次示范</button>`
      },
      {
        head: "第三式 · 开声校准",
        sub: "龙楼门童递来一支传声铜管",
        body: `
          <p>门童说：「对住佢讲一句就得，佢<strong>只听声，唔会传出去</strong>。」</p>
          <p class="settings-note">隐私承诺：语音识别在本机完成（端侧模型），收音绝不离开你的设备；在线兜底模式也只上传施法那几秒。</p>
          <p>允许麦克风后即可真声施法；不方便开声时，「破阵拍」节奏判定同样能通关。</p>`
      }
    ];
    const page = pages[step - 1];
    const footer =
      step < 3
        ? `<button class="primary-button full-button" type="button" data-action="tutorial-next">${step === 1 ? "下一步 · 听示范" : "下一步 · 开声校准"}</button>`
        : `<div class="button-row">
             <button class="primary-button" type="button" data-action="tutorial-mic">允许麦克风 · 开声</button>
             <button class="ghost-button" type="button" data-action="tutorial-skip">先用手拍 · 破阵拍</button>
           </div>`;
    this.modalRoot.innerHTML = `
      <div class="modal-sheet tutorial-sheet">
        <div class="modal-head">
          <div><h2>${page.head}</h2><p>${page.sub}</p></div>
          <button class="close-button" type="button" data-action="close-modal">×</button>
        </div>
        <div class="tutorial-dots" aria-label="教学步骤">${[1, 2, 3]
          .map((n) => `<span class="${n === step ? "on" : ""}">${n === step ? "●" : "○"}</span>`)
          .join("")}</div>
        <div class="tutorial-body">${page.body}</div>
        ${footer}
      </div>`;
  }

  /** 剧情化麦克风请求：当场授权、即取即停（不留下设备占用）。 */
  private async grantTutorialMic(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      this.finishTutorial("铜管嗡鸣——麦克风已就绪，开声吧！");
    } catch {
      this.finishTutorial("麦克风未开启：可稍后在设置重试，或先用破阵拍");
    }
  }

  private finishTutorial(toast: string): void {
    this.tutorialStep = null;
    this.services.settings.save({ tutorialSeen: true });
    this.closeModal(false);
    this.showToast(toast);
  }

  render(state: GameState, options: EmitOptions = {}): void {
    // P3 每日挑战记账：本局挑战在通关/倒下瞬间写入本地战绩（取更优者保留）
    const daily = state.challenge?.mode === "daily" ? state.challenge : null;
    const dailyKey = daily ? `${daily.dateKey}:${daily.seed}:${state.floor}:${state.phase}` : null;
    if (
      daily?.dateKey &&
      dailyKey !== this.recordedDailyKey &&
      (state.phase === "victory" || state.phase === "defeat")
    ) {
      const summary = this.engine.getRunSummary();
      saveDailyRecord({
        dateKey: daily.dateKey,
        seed: daily.seed,
        ruleset: "p7",
        floor: state.floor,
        victory: state.phase === "victory",
        averageScore: summary.averageScore,
        finishedAt: new Date().toISOString()
      });
      this.recordedDailyKey = dailyKey;
    }

    // P4 档案结算：同一局结束只写一次（种+层+相 去重）
    if (state.phase === "victory" || state.phase === "defeat") {
      const runKey = `${state.seed}:${state.floor}:${state.phase}`;
      if (this.recordedRunKey !== runKey) {
        this.recordedRunKey = runKey;
        this.recordRunToProfile(state);
      }
      // 图鉴点亮：本局见过的卡牌 / 敌人 / 事件 / 遗物 / 道具（幂等）
      this.markCodexFromState(state);
    }

    // 战斗入场埋点：战役结算需要「本场开始时的生命」快照
    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      if (state.phase === "battle") this.combatStartHp = state.player?.hp ?? null;
    }

    const isTitle = state.phase === "title";
    this.topbar.hidden = isTitle;

    // P3/P4 标题层视图：练习场 / 学习报告 / 成就 / 图鉴（引擎停留在 title 相）
    if (isTitle && this.view !== "game") {
      if (this.view === "practice") {
        this.root.innerHTML = this.practiceTemplate();
        this.paintPracticeCanvas();
      } else if (this.view === "report") {
        this.root.innerHTML = this.reportTemplate();
      } else if (this.view === "achievements") {
        this.root.innerHTML = this.achievementsTemplate();
      } else {
        this.root.innerHTML = this.codexTemplate();
      }
      return;
    }
    if (!isTitle) {
      const count = state.player ? state.player.items.length + state.player.relics.length : 0;
      const badge = this.inventoryButton.querySelector("b");
      if (badge) badge.textContent = String(count);
    }

    if (state.phase === "title") this.root.innerHTML = titleTemplate();
    else if (state.phase === "tower")
      this.root.innerHTML = state.campaign
        ? campaignMapTemplate(state)
        : towerTemplate(state, this.engine);
    else if (state.phase === "battle") this.root.innerHTML = battleTemplate(state, this.engine);
    else if (state.phase === "event") this.root.innerHTML = eventTemplate(state);
    else if (state.phase === "rest") this.root.innerHTML = restTemplate(state);
    else if (state.phase === "shop") this.root.innerHTML = shopTemplate(state);
    else if (state.phase === "reward") this.root.innerHTML = rewardTemplate(state);
    else if (state.phase === "quiz") this.root.innerHTML = quizTemplate(state);
    else if (state.phase === "victory") this.root.innerHTML = endTemplate(state, this.engine, true);
    else if (state.phase === "defeat") this.root.innerHTML = endTemplate(state, this.engine, false);

    if (state.notice && state.notice !== this.lastNotice) {
      this.lastNotice = state.notice;
      this.showToast(state.notice);
    }
    // P5 演出：浮字/抖动/星光（body.reduce-motion 时 fx 内部整体跳过）+ 触感反馈
    playBattleFx(this.root, state, {
      effect: options.effect,
      reducedMotion: document.body.classList.contains("reduce-motion")
    });
    if (options.effect === "hit") vibrate("light");
    if (options.effect === "enemy" || options.effect === "defeat") vibrate("heavy");

    // P5 新手教学：第一场战斗前弹三步引导（识招 → 听示范 → 开声校准）
    if (
      state.phase === "battle" &&
      !this.tutorialShownThisSession &&
      state.combat &&
      state.combat.turn === 1 &&
      (state.floor ?? 0) <= 1 &&
      !this.services.settings.get().tutorialSeen &&
      this.modalRoot.childElementCount === 0
    ) {
      this.openTutorial();
    }
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

  // ─── 施法（语音/无声 QTE 双通道） ──────────────────────────────────────────

  private openVoice(skill: Skill | undefined, deckIndex?: number): void {
    if (!skill || !this.engine.canUseSkill(skill.id, deckIndex)) return;
    this.pendingVoice = { skill, result: null, deckIndex, combat: this.engine.state.combat };
    const adapter = this.adapter;
    const canListen = Boolean(adapter?.ready);
    const engineLabel = adapter ? adapter.id : "loading";
    const hint = !adapter
      ? "语音引擎加载中，请稍候或直接破阵拍"
      : !adapter.supported
        ? "当前环境不支持所选语音引擎，已打开破阵拍"
        : !adapter.ready
          ? "端侧模型未就绪：可在设置页下载，或直接破阵拍"
          : "点击按钮后，请清晰说出上方短句";

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
          <button class="mini-button sample-button" type="button" data-action="listen-sample" aria-label="收听示范发音">🔊 听一听</button>
        </div>
        <div class="voice-orb-wrap">
          <canvas id="voice-aura-canvas" class="voice-aura-canvas" aria-hidden="true"></canvas>
          <div class="voice-orb" id="voice-orb">待开声</div>
        </div>
        <p class="voice-live-text" id="voice-live-text">${escapeHtml(hint)}（当前引擎：${escapeHtml(engineLabel)}）</p>
        <div class="voice-actions">
          <button class="primary-button full-button" type="button" data-action="start-listening" ${canListen ? "" : "disabled"}>开始收音</button>
          <button class="ghost-button full-button" type="button" data-action="start-qte">破阵拍（无声施法）</button>
        </div>
        <div id="qte-host"></div>
        <details class="fallback-panel" id="fallback-panel">
          <summary>键盘判定（开发者）</summary>
          <label for="fallback-transcript">模拟识别到的文字</label>
          <input id="fallback-transcript" type="text" value="${escapeHtml(skill.phrase)}" autocomplete="off" />
          <div class="range-line"><label for="fallback-confidence">模拟识别置信度</label><strong id="confidence-value">82%</strong></div>
          <input id="fallback-confidence" type="range" min="30" max="100" value="82" />
          <button class="secondary-button full-button" type="button" data-action="submit-fallback" style="margin-top:10px">计算并发动</button>
        </details>
        <p class="voice-disclaimer">分数用于游戏反馈，不等同于专业声学发音测评。无声也可用「破阵拍」完整通关。</p>
      </div>`;
    const slider = this.modalRoot.querySelector<HTMLInputElement>("#fallback-confidence");
    const sliderValue = this.modalRoot.querySelector<HTMLElement>("#confidence-value");
    slider?.addEventListener("input", () => {
      if (sliderValue) sliderValue.textContent = `${slider.value}%`;
    });
  }

  private listenSample(): void {
    if (!this.pendingVoice) return;
    this.services.tts.speak(this.pendingVoice.skill.phrase);
  }

  private startQte(): void {
    if (!this.pendingVoice) return;
    this.activeQte?.dispose();
    const host = this.modalRoot.querySelector<HTMLElement>("#qte-host");
    const orb = this.modalRoot.querySelector<HTMLElement>("#voice-orb");
    const text = this.modalRoot.querySelector<HTMLElement>("#voice-live-text");
    if (!host) return;
    if (orb) orb.textContent = "破阵拍";
    if (text) text.textContent = "看准甜区按「出手」——无声也能打出正音。";
    this.activeQte = new VocalQte(host, {
      onResolve: (score) => {
        this.activeQte = null;
        const skill = this.pendingVoice?.skill;
        if (!skill) return;
        const result: VoiceScoreResult = {
          score,
          similarity: 0,
          confidence: 0,
          matchedTarget: skill.phrase,
          transcript: `破阵拍 ${score} 分`,
          source: "qte"
        };
        this.showVoiceResult(result);
      },
      onCancel: () => {
        this.activeQte = null;
      }
    });
    this.activeQte.mount();
  }

  private startListening(): void {
    if (!this.pendingVoice || !this.adapter) return;
    const { skill } = this.pendingVoice;
    const adapter = this.adapter;
    const orb = this.modalRoot.querySelector<HTMLElement>("#voice-orb");
    const text = this.modalRoot.querySelector<HTMLElement>("#voice-live-text");
    const startButton = this.modalRoot.querySelector<HTMLButtonElement>(
      '[data-action="start-listening"]'
    );
    if (startButton) startButton.disabled = true;
    // P6-F2：升起龙吟环——音量驱动涨落，基频漂移六调域色相
    const auraCanvas = this.modalRoot.querySelector<HTMLCanvasElement>("#voice-aura-canvas");
    this.voiceAura?.stop();
    this.voiceAura = auraCanvas ? new VoiceAura(auraCanvas) : null;
    this.voiceAura?.start();
    adapter.start({
      targets: skill.alternatives || [skill.phrase],
      jyutping: skill.jyutping,
      onPitchFrame: (frame) => this.voiceAura?.pushPitchFrame(frame),
      onVolume: (rms) => this.voiceAura?.pushVolume(rms),
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
      onResult: (result) => {
        this.voiceAura?.stop();
        this.showVoiceResult(result);
      },
      onError: (error: Error) => {
        this.voiceAura?.stop();
        if (orb) {
          orb.classList.remove("listening");
          orb.textContent = "未识别";
        }
        if (text) text.textContent = `${error.message}，请改用破阵拍。`;
        if (startButton) startButton.disabled = false;
      }
    });
  }

  private toggleFallback(): void {
    const panel = this.modalRoot.querySelector<HTMLDetailsElement>("#fallback-panel");
    if (!panel) return;
    panel.open = !panel.open;
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
    const isQte = result.source === "qte";
    const confidence = result.confidence ?? Math.round((result.rawConfidence || 0.72) * 100);
    this.modalRoot.innerHTML = `
      <div class="modal-sheet score-result">
        <div class="modal-head">
          <div><h2>${escapeHtml(scoreLabel(result.score))}</h2><p>「${escapeHtml(skill.phrase)}」本次${isQte ? "破阵拍" : "声韵"}判定</p></div>
          <button class="close-button" type="button" data-action="close-modal">×</button>
        </div>
        <div class="score-ring" style="--score:${result.score}"><div><strong>${result.score}</strong><small>${isQte ? "节奏分" : "声韵分"}</small></div></div>
        <p class="screen-subtitle">${isQte ? "无声判定：" : "识别到："}${escapeHtml(result.transcript || "未返回文字")}</p>
        <div class="score-breakdown">
          ${
            isQte
              ? `<div><strong>破阵拍</strong><small>施法方式</small></div><div><strong>${result.score}分</strong><small>命中精度</small></div>`
              : `<div><strong>${result.similarity ?? 0}%</strong><small>字准相似度</small></div>${
                  result.toneScore != null
                    ? `<div><strong>${result.toneScore}分</strong><small>调准分</small></div>`
                    : `<div><strong>${confidence}%</strong><small>识别置信度</small></div>`
                }<div><strong>${result.score}分</strong><small>综合录入</small></div>`
          }
        </div>
        <button class="primary-button full-button" type="button" data-action="apply-voice">发动「${escapeHtml(skill.name)}」</button>
        <p class="voice-disclaimer">遗物、喉糖、永久声韵与敌方干扰会在发动时计入最终战斗分数。</p>
      </div>`;
  }

  private applyVoiceResult(): void {
    if (!this.pendingVoice?.result) return;
    const { skill, result, deckIndex, combat } = this.pendingVoice;
    this.pendingVoice = null;
    this.closeModal(false);
    if (combat !== this.engine.state.combat || !this.engine.canUseSkill(skill.id, deckIndex)) {
      this.showToast("战斗或手牌已变化，本次未消耗声气，请重新选牌。");
      return;
    }
    // P3：真实语音尝试进入学习闭环（错词本 / 学习报告 / 每日三句）
    this.recordVoiceAttempt(skill.id, result);
    // P4：真声施法累计进档案（连珠/最佳/次数），并即时点亮成就
    if (result.source !== "qte" && result.source !== "manual-test") {
      persistProfile((p) => recordVoiceCast(p, result.score));
      this.checkNewAchievements();
    }
    this.engine.resolveSkill(skill.id, result.score, result, deckIndex);
  }

  // ─── P4 档案 / 成就 / 图鉴接线 ─────────────────────────────────────────────

  /** 一局终局计入档案（战绩 / 无尽最佳 / 自适应节律），并点亮新成就。 */
  private recordRunToProfile(state: GameState): void {
    const summary = this.engine.getRunSummary();
    persistProfile((p) =>
      recordRunEnd(p, {
        victory: state.phase === "victory",
        endless: Boolean(state.endless),
        campaign: Boolean(state.campaign),
        floor: state.floor,
        summary
      })
    );
    this.checkNewAchievements();
  }

  /** 成就判定上下文：档案统计 + 各幕战役星辉（由种子重算节点类型）+ 每日战绩 + SRS 驯服数。 */
  private profileContext(): AchievementContext {
    const stats = profileCache.stats;
    const actMetas = Object.values(loadCampaignMeta()?.acts ?? {});
    const campaignStarsTotal = actMetas.reduce(
      (sum, entry) => sum + Object.values(entry.stars).reduce((inner, stars) => inner + stars, 0),
      0
    );
    let quizPerfects = 0;
    for (const entry of actMetas) {
      const quizNodeIds = new Set(mapQuizNodeIds(entry.mapSeed));
      for (const [nodeId, stars] of Object.entries(entry.stars)) {
        if (stars >= 3 && quizNodeIds.has(nodeId)) quizPerfects += 1;
      }
    }
    const actsCleared = actMetas.filter((entry) => entry.bossCleared).length;
    return {
      voiceAttempts: stats.voiceAttempts,
      bestVoice: stats.bestVoice,
      maxCombo85: stats.maxCombo85,
      runs: stats.runs,
      victories: stats.victories,
      classicVictories: stats.classicVictories,
      kills: stats.kills,
      elites: stats.elites,
      endlessBest: stats.endlessBest,
      campaignStarsTotal,
      campaignBossKills: stats.campaignBossKills,
      actsCleared,
      quizPerfects,
      dailyWins: Object.values(loadDailyRecords()).filter((record) => record.victory).length,
      srsGraduated: countSrsGraduated(loadSrsStore())
    };
  }

  /** 判定并toast新解锁成就（顺序按定义）。 */
  private checkNewAchievements(): void {
    const fresh = newlyUnlocked(this.profileContext(), profileCache.unlocked);
    if (!fresh.length) return;
    persistProfile((p) => {
      for (const def of fresh) p.unlocked.push(def.id);
    });
    const names = fresh.map((def) => `「${def.name}」`).join(" ");
    const points = fresh.reduce((sum, def) => sum + def.points, 0);
    this.showToast(`成就解锁 ${names} · +${points} 点`);
  }

  /** 本局足迹点亮图鉴（卡牌 / 遗物 / 道具 / 敌人 / 事件，幂等）。 */
  private markCodexFromState(state: GameState): void {
    persistProfile((p) => {
      const player = state.player;
      if (player) {
        markCodexSeen(p, "skills", player.deck);
        markCodexSeen(p, "relics", player.relics);
        markCodexSeen(p, "items", player.items);
      }
      if (state.combat) markCodexSeen(p, "enemies", [state.combat.enemy.id]);
      if (state.event) markCodexSeen(p, "events", [state.event.id]);
      // 终局必见关底：胜利 = 击败过该幕 boss（经典塔 = 第一幕九龙声煞）
      if (state.phase === "victory") {
        markCodexSeen(p, "enemies", [actContent(state.campaign?.act ?? 1).boss.id]);
      }
    });
  }

  /** 结算屏战绩海报：生成→系统分享（缺席时自动下载）。 */
  private async shareRunPoster(): Promise<void> {
    const state = this.engine.state;
    const summary = this.engine.getRunSummary();
    const victory = state.phase === "victory";
    if (!this.posterCanvas) {
      this.posterCanvas = document.createElement("canvas");
    }
    const campaignStars = state.campaign
      ? Object.values(state.campaign.stars).reduce((sum, value) => sum + value, 0)
      : 0;
    const modeLabel = state.endless
      ? "无尽塔"
      : state.campaign
        ? `战役 · 第${ACT_NUMERALS[state.campaign.act - 1]}幕`
        : "经典十层";
    drawRunPoster(this.posterCanvas, {
      victory,
      title: victory ? "声震龙楼" : "下次再会",
      subtitle: state.endless
        ? `${modeLabel} · 止步第 ${state.floor} 层`
        : victory
          ? `${modeLabel} · 一路登顶`
          : `${modeLabel} · 止步第 ${state.floor} 层`,
      seal: victory ? "胜" : "落",
      stats: [
        {
          label: "楼层",
          value: state.endless ? `${state.floor} ∞` : `${state.floor} / ${state.maxFloor}`
        },
        { label: "击败敌人", value: String(summary.enemies) },
        { label: "平均声韵", value: String(summary.averageScore) },
        { label: "最高声韵", value: String(summary.bestScore) },
        { label: "技能总数", value: String(summary.skills) },
        { label: "无尽最佳", value: `${profileCache.stats.endlessBest} 层` }
      ],
      starsLabel: state.campaign ? `战役星辉 × ${campaignStars}` : undefined,
      dateLabel: dateKeyFor(new Date())
    });
    const result = await sharePoster(this.posterCanvas, "voicedragon-run.png");
    if (result === "shared") this.showToast("已拉起系统分享");
    else if (result === "downloaded") this.showToast("已下载海报 PNG");
    else this.showToast("分享失败，请重试");
  }

  // ─── 设置页 ────────────────────────────────────────────────────────────────

  private openSettings(): void {
    const settings = this.services.settings.get();
    const current = settings.voiceMode;
    const radio = (mode: VoiceMode) => `
      <label class="radio-line">
        <input type="radio" name="voice-mode" value="${mode}" ${current === mode ? "checked" : ""} />
        <span>${escapeHtml(VOICE_MODE_COPY[mode])}</span>
      </label>`;
    this.modalRoot.innerHTML = `
      <div class="modal-sheet settings-sheet">
        <div class="modal-head"><div><h2>设置</h2><p>语音引擎与体验选项</p></div><button class="close-button" data-action="close-modal">×</button></div>
        <div class="settings-group">
          <h3>语音引擎</h3>
          ${radio("auto")}${radio("sensevoice")}${radio("webspeech")}
        </div>
        <div class="settings-group">
          <h3>声调评分（P3）</h3>
          <div class="range-line"><label for="set-tone-weight">调准占比 <strong id="tone-weight-value">${Math.round((settings.toneWeight ?? 0.4) * 100)}%</strong></label><span id="tone-word-label">字准 ${100 - Math.round((settings.toneWeight ?? 0.4) * 100)}%</span></div>
          <input id="set-tone-weight" type="range" min="0" max="80" step="10" value="${Math.round((settings.toneWeight ?? 0.4) * 100)}" />
          <p class="settings-note">仅端侧引擎可输出调准分；无调准时自动按纯字准计。默认 40%，即字 60% / 调 40%。</p>
        </div>
        <div class="settings-group" id="model-panel">
          <h3>端侧模型</h3>
          <p class="settings-note" id="model-status">查询中…</p>
          <div class="progress-track" id="model-progress-track" hidden><div class="progress-fill" id="model-progress-fill"></div></div>
          <div class="button-row">
            <button class="secondary-button full-button" type="button" data-action="download-model" id="download-model-button">下载模型（约 230MB）</button>
            <button class="ghost-button full-button" type="button" data-action="clear-model" id="clear-model-button">清除缓存</button>
          </div>
        </div>
        <div class="settings-group">
          <h3>外观主题（P4）</h3>
          ${THEME_DEFS.map((def) => {
            const points = achievementPoints(profileCache.unlocked);
            const locked = points < def.requirement;
            const active = (settings.theme ?? "ink") === def.id;
            return `
              <label class="radio-line ${locked ? "locked" : ""}">
                <input type="radio" name="theme" value="${def.id}" ${active ? "checked" : ""} ${locked ? "disabled" : ""} />
                <span>${escapeHtml(def.name)} · ${escapeHtml(def.desc)}${locked ? `（当前 ${points} 点）` : ""}</span>
              </label>`;
          }).join("")}
        </div>
        <div class="settings-group">
          <h3>体验</h3>
          <label class="radio-line"><input type="checkbox" id="set-sound" ${settings.sound ? "checked" : ""} /><span>音效（施法 / 受击 / 结算）</span></label>
          <label class="radio-line"><input type="checkbox" id="set-music" ${(settings.music ?? true) ? "checked" : ""} /><span>背景音乐（生成式粤韵环境乐）</span></label>
          <label class="radio-line"><input type="checkbox" id="set-reduce-motion" ${settings.reduceMotion ? "checked" : ""} /><span>减弱动效</span></label>
          <label class="radio-line"><input type="checkbox" id="set-adaptive" ${settings.adaptiveEnabled !== false ? "checked" : ""} /><span>自适应难度（连胜略加难、连败略减压，可在开局前随时关闭）</span></label>
          <div class="settings-sublabel">特效强度（P6：手动档优先于帧率自动降载）</div>
          ${(["auto", "full", "balanced", "eco"] as const)
            .map(
              (level) => `
              <label class="radio-line"><input type="radio" name="fx-intensity" value="${level}" ${(settings.fxIntensity ?? "auto") === level ? "checked" : ""} /><span>${
                {
                  auto: "自动（按帧率降载）",
                  full: "满（粒子全开）",
                  balanced: "均衡（粒子减半）",
                  eco: "省电（仅保留战斗演出）"
                }[level]
              }</span></label>`
            )
            .join("")}
        </div>
        <div class="notice-strip">隐私承诺：端侧模式下语音全部留在本机；在线模式只上传你施法的几秒收音，绝不收集其它数据。</div>
      </div>`;

    // 引擎选择
    for (const input of this.modalRoot.querySelectorAll<HTMLInputElement>(
      'input[name="voice-mode"]'
    )) {
      input.addEventListener("change", () => {
        void this.services.setVoiceMode(input.value as VoiceMode).then((adapterId) => {
          this.showToast(`语音引擎已切换：${adapterId}`);
          void this.refreshModelPanel();
        });
      });
    }
    // 声调权重
    const toneSlider = this.modalRoot.querySelector<HTMLInputElement>("#set-tone-weight");
    const toneValue = this.modalRoot.querySelector<HTMLElement>("#tone-weight-value");
    const toneWordLabel = this.modalRoot.querySelector<HTMLElement>("#tone-word-label");
    toneSlider?.addEventListener("input", () => {
      const percent = Number(toneSlider.value);
      this.services.settings.save({ toneWeight: percent / 100 });
      if (toneValue) toneValue.textContent = `${percent}%`;
      if (toneWordLabel) toneWordLabel.textContent = `字准 ${100 - percent}%`;
    });
    // 体验开关
    this.modalRoot
      .querySelector<HTMLInputElement>("#set-sound")
      ?.addEventListener("change", (e) => {
        this.services.settings.save({ sound: (e.target as HTMLInputElement).checked });
      });
    this.modalRoot
      .querySelector<HTMLInputElement>("#set-music")
      ?.addEventListener("change", (e) => {
        this.services.settings.save({ music: (e.target as HTMLInputElement).checked });
      });
    this.modalRoot
      .querySelector<HTMLInputElement>("#set-reduce-motion")
      ?.addEventListener("change", (e) => {
        this.services.settings.save({ reduceMotion: (e.target as HTMLInputElement).checked });
      });
    // P6-F3 特效强度
    for (const input of this.modalRoot.querySelectorAll<HTMLInputElement>(
      'input[name="fx-intensity"]'
    )) {
      input.addEventListener("change", () => {
        this.services.settings.save({ fxIntensity: input.value as GameSettings["fxIntensity"] });
      });
    }
    // 主题皮肤（P4）
    for (const input of this.modalRoot.querySelectorAll<HTMLInputElement>('input[name="theme"]')) {
      input.addEventListener("change", () => {
        this.services.settings.save({ theme: input.value as ThemeId });
        document.body.dataset.theme = input.value;
        const picked = THEME_DEFS.find((def) => def.id === input.value);
        this.showToast(`主题已切换：${picked?.name ?? input.value}`);
      });
    }
    // 自适应难度开关（P4）
    this.modalRoot
      .querySelector<HTMLInputElement>("#set-adaptive")
      ?.addEventListener("change", (e) => {
        this.services.settings.save({ adaptiveEnabled: (e.target as HTMLInputElement).checked });
      });

    this.refreshModelPanel();
  }

  private async refreshModelPanel(): Promise<void> {
    const statusEl = this.modalRoot.querySelector<HTMLElement>("#model-status");
    const downloadButton =
      this.modalRoot.querySelector<HTMLButtonElement>("#download-model-button");
    if (!statusEl) return;
    const status = await this.services.model.getStatus();
    if (status.state === "ready") {
      statusEl.textContent = `已缓存（${(status.totalBytes / 1024 / 1024).toFixed(0)}MB）· 端侧离线识别可用`;
      if (downloadButton) {
        downloadButton.disabled = true;
        downloadButton.textContent = "模型已就绪";
      }
    } else if (status.state === "partial") {
      statusEl.textContent = `已下载 ${status.percent}%（${status.doneParts}/${status.partCount} 片）· 中断后重开可续传`;
    } else {
      statusEl.textContent = "未下载 · 下载一次即可完全离线、高精度粤语识别";
    }
  }

  private async downloadModel(button: HTMLButtonElement): Promise<void> {
    const track = this.modalRoot.querySelector<HTMLElement>("#model-progress-track");
    const fill = this.modalRoot.querySelector<HTMLElement>("#model-progress-fill");
    const statusEl = this.modalRoot.querySelector<HTMLElement>("#model-status");
    button.disabled = true;
    button.textContent = "下载中…";
    if (track) track.hidden = false;
    this.modelUnsubscribe?.();
    this.modelUnsubscribe = this.services.model.onProgress((progress) => {
      if (!progress) {
        // 下载结束（无论成败），由 getStatus 定格
        void this.refreshModelPanel();
        return;
      }
      if (fill) fill.style.width = `${progress.percent}%`;
      if (statusEl) {
        statusEl.textContent = `下载中 ${progress.percent}% · ${(progress.downloadedBytes / 1024 / 1024).toFixed(0)}MB / ${(progress.totalBytes / 1024 / 1024).toFixed(0)}MB`;
      }
    });
    try {
      await this.services.model.download();
      this.showToast("模型下载完成，端侧粤语识别已就绪");
      button.textContent = "模型已就绪";
    } catch (error) {
      this.showToast(`下载失败：${(error as Error).message}（可重试，已下载部分自动续传）`);
      button.disabled = false;
      button.textContent = "重试下载";
    } finally {
      this.modelUnsubscribe?.();
      this.modelUnsubscribe = null;
      void this.refreshModelPanel();
    }
  }

  private async clearModel(): Promise<void> {
    await this.services.model.clear();
    this.showToast("模型缓存已清除");
    void this.refreshModelPanel();
  }

  // ─── 行囊 / 帮助 ────────────────────────────────────────────────────────────

  private openBuild(mode: BuildView = "view"): void {
    if (!this.engine.state.player) return;
    this.pendingBuild = null;
    const safeMode = mode === "remove" || mode === "upgrade" ? mode : "view";
    this.modalRoot.innerHTML = buildViewTemplate(this.engine.state, safeMode);
    this.modalRoot.querySelector<HTMLButtonElement>(".close-button")?.focus();
  }

  private selectBuild(operation: BuildOperation, index: number, id: string): void {
    const state = this.engine.state;
    const player = state.player;
    if (!buildEnabled(state) || !player || player.deck[index] !== id) return;
    if (operation === "upgrade" && (state.phase !== "rest" || upgradeReason(player, index))) return;
    if (
      operation === "remove" &&
      (state.phase !== "shop" ||
        state.shop?.removalUsed ||
        removalReason(player, index) ||
        player.gold < removalPrice(player))
    )
      return;
    if (operation !== "upgrade" && operation !== "remove") return;
    this.pendingBuild = {
      operation,
      index,
      id,
      player,
      phase: state.phase,
      floor: state.floor,
      shop: state.shop
    };
    this.modalRoot.innerHTML = buildConfirmTemplate(state, operation, index);
    this.modalRoot.querySelector<HTMLButtonElement>('[data-action="confirm-build"]')?.focus();
  }

  private confirmBuild(): void {
    const pending = this.pendingBuild;
    if (!pending) return;
    this.pendingBuild = null;
    const state = this.engine.state;
    if (
      pending.player !== state.player ||
      pending.phase !== state.phase ||
      pending.floor !== state.floor ||
      pending.shop !== state.shop
    ) {
      this.closeModal();
      this.showToast("当前节点已变化，请重新选择。");
      return;
    }
    this.closeModal();
    const ok =
      pending.operation === "upgrade"
        ? this.engine.upgradeDeckCard(pending.index, pending.id)
        : this.engine.removeDeckCard(pending.index, pending.id);
    if (!ok) this.showToast("操作条件已变化，牌组与银两保持不变。");
  }

  private openInventory(): void {
    const player = this.engine.state.player;
    if (!player) return;
    const relics = player.relics.length
      ? player.relics
          .map((id) => {
            const relic = lookupRelic(id)!;
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
        <button type="button" class="secondary-button full-button" data-action="open-build" data-build-mode="view">查看构筑 · ${player.deck.length} 张牌</button>
        <div class="section-label"><h2>遗物</h2><p>${player.relics.length} 件</p></div>
        <div class="inventory-list">${relics}</div>
        <div class="section-label"><h2>消耗品</h2><p>${player.items.length} 件</p></div>
        <div class="inventory-list">${items}</div>
      </div>`;
  }

  private openHelp(): void {
    const adapter = this.adapter;
    const engineLabel = adapter
      ? VOICE_MODE_COPY[this.services.settings.get().voiceMode]
      : "加载中";
    this.modalRoot.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-head"><div><h2>如何登楼</h2><p>${escapeHtml(engineLabel)}</p></div><button class="close-button" data-action="close-modal">×</button></div>
        <div class="help-steps">
          <div class="help-step"><b>1</b><div><strong>逐层择路</strong><small>普通楼层随机出现战斗、事件、歇脚处与夜市；第五层为强敌，第十层为最终首领。</small></div></div>
          <div class="help-step"><b>2</b><div><strong>开声出招 / 破阵拍</strong><small>说出卡牌上的粤语短句即可施法；无声环境改用「破阵拍」节奏判定，随时可在设置页切换引擎。</small></div></div>
          <div class="help-step"><b>3</b><div><strong>发音影响威力</strong><small>未稳 0.52 倍、入门 0.78 倍、清晰 1 倍、正音 1.32 倍。端侧引擎额外按粤语六调评「调准」；标题屏「练习场」可看基频曲线逐句校准。</small></div></div>
          <div class="help-step"><b>4</b><div><strong>构筑与存档</strong><small>战役新局启用 36 招式 / 26 奇遇 / 8 道具扩展池（逐幕解锁）。经典塔与旧存档保留原规则。每日固定两条词缀，无尽每五层重抽；每次行动自动保存。</small></div></div>
          <div class="help-step"><b>5</b><div><strong>开口有回响</strong><small>低分短句自动进「错词本」，标题屏每日推三句复习；「学习报告」看字准/调准/信心/词汇四维。</small></div></div>
        </div>
        <div class="notice-strip">端侧模型（约 230MB，可断点续传）下载一次即可完全离线游玩：设置 → 端侧模型。</div>
        <button class="ghost-button full-button" type="button" data-action="replay-tutorial" style="margin-top:10px">重看新手教学（识招 · 听示范 · 开声校准）</button>
      </div>`;
  }

  // ─── P3 学习闭环：练习场 / 学习报告 / 每日挑战 / 错词记录 ─────────────────

  private startDailyChallenge(): void {
    const dateKey = dateKeyFor(new Date());
    this.recordedDailyKey = null;
    this.closeModal();
    clearSave();
    this.engine.startDaily(dailySeedForKey(dateKey), dateKey);
    this.showToast("今日挑战开局：同一本地日期、同种子、同词缀");
  }

  private currentPracticeSkill(): Skill | null {
    return (this.practiceSkillId ? lookupSkill(this.practiceSkillId) : null) ?? null;
  }

  private openPractice(skillId?: string): void {
    this.view = "practice";
    if (skillId && lookupSkill(skillId)) this.practiceSkillId = skillId;
    if (!this.currentPracticeSkill()) this.practiceSkillId = ALL_SKILLS[0].id;
    this.practiceResult = null;
    this.practiceLiveFrames = [];
    this.render(this.engine.state);
  }

  private openReport(): void {
    this.view = "report";
    this.render(this.engine.state);
  }

  /** P4 标题层二级页（成就 / 图鉴） */
  private openView(view: "achievements" | "codex"): void {
    this.view = view;
    this.render(this.engine.state);
  }

  private closeView(): void {
    this.view = "game";
    this.adapter?.cancel();
    this.services.tts.stop();
    this.practiceRecording = false;
    this.render(this.engine.state);
  }

  /** 真实语音尝试计入学习闭环（QTE/键盘判定不算发音练习）。 */
  private recordVoiceAttempt(skillId: string, result: VoiceScoreResult): void {
    if (result.source === "qte" || result.source === "manual-test") return;
    const store = loadSrsStore();
    recordAttempt(store, skillId, {
      score: result.score,
      wordScore: result.similarity ?? result.score,
      toneScore: result.toneScore ?? null,
      confidence: result.confidence ?? null
    });
    saveSrsStore(store);
  }

  private practiceTemplate(): string {
    const skill = this.currentPracticeSkill()!;
    const guides = expectedToneGuides(skill.jyutping);
    const chips = ALL_SKILLS.map(
      (entry) =>
        `<button class="practice-chip${entry.id === skill.id ? " active" : ""}" type="button" data-action="practice-select" data-skill-id="${escapeHtml(entry.id)}">${escapeHtml(entry.phrase)}</button>`
    ).join("");
    const toneChips = guides
      .map(
        (guide) =>
          `<span class="tone-chip" title="${escapeHtml(guide.hint)}"><b>${guide.tone}</b>${escapeHtml(guide.name)}</span>`
      )
      .join("");
    const result = this.practiceResult;
    const detail = result?.toneDetail;
    const breakdown = result
      ? `
      <div class="score-breakdown practice-breakdown">
        <div><strong>${result.similarity ?? 0}%</strong><small>字准相似度</small></div>
        <div><strong>${result.toneScore != null ? `${result.toneScore}分` : "—"}</strong><small>调准${result.toneScore == null ? "（无基频通道）" : ""}</small></div>
        <div><strong>${result.score}分</strong><small>综合 · ${escapeHtml(scoreLabel(result.score))}</small></div>
      </div>
      ${
        detail
          ? `<p class="settings-note">音节调准（对应上方圆点）：${detail.perSyllable
              .map(
                (value, index) =>
                  `第${index + 1}音节 ${value}分（${detail.expectedTones[index]}调 ${TONE_TEMPLATES[detail.expectedTones[index]].name}）`
              )
              .join(" · ")}</p>`
          : ""
      }`
      : "";
    const toneCapable = this.adapter?.id === "sensevoice";
    return `
    <section class="screen practice-screen">
      <header class="practice-head">
        <button class="ghost-button" type="button" data-action="close-view">← 返回</button>
        <div>
          <p class="eyebrow">练习场 · 调准可视化</p>
          <h1 class="screen-title">跟读校准</h1>
        </div>
      </header>
      <div class="practice-chips">${chips}</div>
      <div class="panel practice-target">
        <div class="practice-phrase">
          <strong>${escapeHtml(skill.phrase)}</strong>
          <button class="mini-button" type="button" data-action="practice-tts">🔊 示范</button>
        </div>
        <small>${escapeHtml(skill.jyutping)} · ${escapeHtml(skill.lesson)}</small>
        <div class="tone-chips">${toneChips}</div>
      </div>
      <div class="panel pitch-panel">
        <canvas id="pitch-canvas" height="150"></canvas>
        <div class="pitch-legend">
          <span class="legend-template">--- 期望调型</span>
          <span class="legend-user">—— 你的基频</span>
          <span>圆点 = 每音节调准档位</span>
        </div>
      </div>
      ${breakdown}
      <div class="practice-actions">
        <button class="primary-button full-button" type="button" data-action="practice-record" ${this.practiceRecording ? "disabled" : ""}>
          ${this.practiceRecording ? "收音中…读出上方短句" : result ? "再读一次" : "开始跟读"}
        </button>
        ${this.practiceRecording ? `<button class="ghost-button full-button" type="button" data-action="practice-stop">结束并判定</button>` : ""}
        ${!toneCapable ? `<p class="settings-note">当前引擎（${escapeHtml(this.adapter?.id ?? "加载中")}）无基频通道，仅出字准；启用端侧模型可显示调准曲线。</p>` : ""}
      </div>
    </section>`;
  }

  private practiceRecord(): void {
    const skill = this.currentPracticeSkill();
    const adapter = this.adapter;
    if (!skill || !adapter || this.practiceRecording) return;
    this.practiceResult = null;
    this.practiceLiveFrames = [];
    this.practiceRecording = true;
    this.render(this.engine.state);
    adapter.start({
      targets: skill.alternatives || [skill.phrase],
      jyutping: skill.jyutping,
      onPitchFrame: (frame) => {
        this.practiceLiveFrames.push(frame);
        this.schedulePracticePaint();
      },
      onInterim: () => {},
      onState: () => {},
      onResult: (result) => {
        this.practiceRecording = false;
        this.practiceResult = result;
        this.recordVoiceAttempt(skill.id, result);
        vibrate("light");
        this.render(this.engine.state);
      },
      onError: (error) => {
        this.practiceRecording = false;
        this.practiceResult = null;
        this.showToast(error.message);
        this.render(this.engine.state);
      }
    });
  }

  private schedulePracticePaint(): void {
    if (this.practiceRaf !== null) return;
    this.practiceRaf = requestAnimationFrame(() => {
      this.practiceRaf = null;
      this.paintPracticeCanvas();
    });
  }

  private paintPracticeCanvas(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>("#pitch-canvas");
    const skill = this.currentPracticeSkill();
    if (!canvas || !skill) return;
    const detail = this.practiceResult?.toneDetail ?? null;
    const template = detail?.template ?? previewTemplateCurve(skill.jyutping);
    let user = detail?.userCurve ?? null;
    if (!user && this.practiceLiveFrames.length > 4) {
      const points = normalizeContour(this.practiceLiveFrames);
      if (points.length > 4) user = resamplePoints(points, template?.length ?? 72);
    }
    const syllableCount =
      detail?.expectedTones.length ?? parseJyutpingTones(skill.jyutping).length ?? 1;
    drawPitchCurves(canvas, template, user, detail?.perSyllable ?? null, syllableCount);
  }

  /** P4 成就页：点亮 / 未点亮 / 隐藏卡，附总点与主题解锁提示 */
  private achievementsTemplate(): string {
    const unlocked = new Set(profileCache.unlocked);
    const points = achievementPoints(unlocked);
    const cards = ACHIEVEMENTS.map((def) => {
      const got = unlocked.has(def.id);
      const masked = !got && def.secret;
      return `
        <div class="ach-card ${got ? "lit" : ""}">
          <span class="ach-seal">${got || !masked ? escapeHtml(def.seal) : "？"}</span>
          <div>
            <strong>${escapeHtml(masked ? "隐藏成就" : def.name)}<small>+${def.points} 点</small></strong>
            <small>${escapeHtml(masked ? "达成后揭晓……" : def.desc)}</small>
          </div>
          <span class="ach-state">${got ? "✓" : ""}</span>
        </div>`;
    }).join("");
    const nextTheme = THEME_DEFS.find((def) => points < def.requirement);
    return `
    <section class="screen achievements-screen">
      <header class="practice-head">
        <button class="ghost-button" type="button" data-action="close-view">← 返回</button>
        <div>
          <p class="eyebrow">成就 · 声迹志</p>
          <h1 class="screen-title">${unlocked.size} / ${ACHIEVEMENTS.length} · ${points} 点</h1>
        </div>
      </header>
      <p class="screen-subtitle">总成就点 ${points} / ${ACHIEVEMENT_POINTS_TOTAL}。${nextTheme ? `再攒 ${nextTheme.requirement - points} 点解锁「${nextTheme.name}」主题。` : "全部主题已解锁，可在设置页换装。"}</p>
      <div class="ach-list">${cards}</div>
    </section>`;
  }

  /** P4 图鉴页：履历点亮的卡牌 / 敌人 / 遗物 / 道具 / 事件 */
  private codexTemplate(): string {
    const codex = profileCache.codex;
    const section = (
      title: string,
      all: readonly { id: string; name: string; tip: string; mark?: string }[],
      seen: readonly string[]
    ): string => {
      const owned = new Set(seen);
      const items = all
        .map((def) => {
          const lit = owned.has(def.id);
          return `
            <div class="codex-card ${lit ? "lit" : ""}">
              <span class="codex-mark">${lit ? escapeHtml(def.mark ?? def.name.slice(0, 1)) : "？"}</span>
              <div>
                <strong>${escapeHtml(lit ? def.name : "？？？")}</strong>
                <small>${lit ? escapeHtml(def.tip) : "在楼中遇见后点亮"}</small>
              </div>
            </div>`;
        })
        .join("");
      const litCount = all.filter((def) => owned.has(def.id)).length;
      return `
        <details class="panel codex-section" open>
          <summary>${escapeHtml(title)} <small>${litCount} / ${all.length}</small></summary>
          <div class="codex-grid">${items}</div>
        </details>`;
    };
    return `
    <section class="screen codex-screen">
      <header class="practice-head">
        <button class="ghost-button" type="button" data-action="close-view">← 返回</button>
        <div>
          <p class="eyebrow">图鉴 · 登楼履痕</p>
          <h1 class="screen-title">见过什么，一目了然</h1>
        </div>
      </header>
      ${section(
        "声诀（技能）",
        ALL_SKILLS.map((s) => ({ id: s.id, name: s.name, tip: `${s.phrase} · ${s.jyutping}` })),
        codex.skills
      )}
      ${section(
        "楼中对手",
        codexEnemyList().map((e) => ({ id: e.id, name: e.name, tip: e.epithet })),
        codex.enemies
      )}
      ${section(
        "遗物",
        ALL_RELICS.map((r) => ({ id: r.id, name: r.name, tip: r.description, mark: r.short })),
        codex.relics
      )}
      ${section(
        "道具",
        ITEMS.map((i) => ({ id: i.id, name: i.name, tip: i.description, mark: i.short })),
        codex.items
      )}
      ${section(
        "事件",
        ALL_EVENTS.map((e) => ({ id: e.id, name: e.title, tip: e.text })),
        codex.events
      )}
    </section>`;
  }

  private reportTemplate(): string {
    const report = buildLearningReport(loadSrsStore(), new Date());
    const axes: { label: string; value: number; muted?: string }[] = [
      { label: "字准", value: report.wordAvg },
      {
        label: "调准",
        value: report.toneAvg ?? 0,
        muted: report.toneAvg == null ? "暂无基频数据" : undefined
      },
      { label: "信心", value: report.confidenceAvg },
      { label: "词汇", value: Math.min(100, Math.round((report.vocab / ALL_SKILLS.length) * 100)) }
    ];
    const cx = 100;
    const cy = 100;
    const radius = 76;
    const pointOf = (axis: number, value: number): string => {
      const angle = (-90 + axis * 90) * (Math.PI / 180);
      const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    };
    const rings = [25, 50, 75, 100]
      .map((level) => {
        const points = [0, 1, 2, 3].map((axis) => pointOf(axis, level)).join(" ");
        return `<polygon points="${points}" class="radar-ring" />`;
      })
      .join("");
    const shape = [0, 1, 2, 3].map((axis) => pointOf(axis, axes[axis].value)).join(" ");
    const labels = axes
      .map((axis, index) => {
        const angle = (-90 + index * 90) * (Math.PI / 180);
        const x = cx + (radius + 18) * Math.cos(angle);
        const y = cy + (radius + 14) * Math.sin(angle);
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="radar-label">${escapeHtml(axis.label)} ${axis.muted ? "" : `${axis.value}`}</text>`;
      })
      .join("");
    const mistakes = report.mistakes.slice(0, 8).map((entry) => {
      const skill = lookupSkill(entry.id);
      if (!skill) return "";
      const dueDays = Math.max(0, Math.ceil((Date.parse(entry.dueAt) - Date.now()) / 86400000));
      return `<div class="inventory-item">
        <span class="item-mark">${escapeHtml(skill.phrase.slice(0, 1))}</span>
        <div><strong>${escapeHtml(skill.phrase)} <small>${escapeHtml(skill.jyutping)}</small></strong>
        <small>上次 ${entry.lastScore} 分 · 最佳 ${entry.bestScore} 分 · ${dueDays === 0 ? "今日到期" : `${dueDays} 天后复习`} · 已练 ${entry.attempts} 次</small></div>
        <button class="mini-button" type="button" data-action="practice-select" data-skill-id="${escapeHtml(entry.id)}">去练</button>
      </div>`;
    });
    const todayRecord = loadDailyRecords()[dateKeyFor(new Date())];
    return `
    <section class="screen report-screen">
      <header class="practice-head">
        <button class="ghost-button" type="button" data-action="close-view">← 返回</button>
        <div>
          <p class="eyebrow">学习报告 · 粤语开口档案</p>
          <h1 class="screen-title">练到哪，错在哪</h1>
        </div>
      </header>
      <div class="panel radar-panel">
        <svg viewBox="0 0 200 200" class="radar" role="img" aria-label="四维能力雷达图">
          ${rings}
          <polygon points="${shape}" class="radar-shape" />
          ${labels}
        </svg>
        <div class="radar-notes">
          <p>开口练习 <strong>${report.voiceAttempts}</strong> 次 · 覆盖短句 <strong>${report.vocab}</strong> / ${ALL_SKILLS.length}</p>
          ${axes[1].muted ? `<p class="settings-note">调准轴：${escapeHtml(axes[1].muted)}（端侧模型可产出）</p>` : ""}
          <p class="settings-note">今日挑战：${escapeHtml(todayRecord ? (todayRecord.victory ? `已通关 · 综合 ${todayRecord.averageScore}` : `到第 ${todayRecord.floor} 层 · 综合 ${todayRecord.averageScore}`) : "未挑战")}</p>
        </div>
      </div>
      <div class="section-label"><h2>错词本</h2><p>${report.mistakes.length} 句 · ${report.dueCount} 句到期</p></div>
      <div class="inventory-list">
        ${mistakes.length ? mistakes.join("") : `<div class="notice-strip">错词本是空的——综合分低于 65 的短句会自动钉进来。</div>`}
      </div>
    </section>`;
  }

  private closeModal(cancelVoice = true): void {
    if (cancelVoice) {
      this.adapter?.cancel();
      this.activeQte?.dispose();
      this.activeQte = null;
      this.services.tts.stop();
      this.modelUnsubscribe?.();
      this.modelUnsubscribe = null;
    }
    this.voiceAura?.stop();
    this.voiceAura = null;
    this.pendingVoice = cancelVoice ? null : this.pendingVoice;
    this.pendingBuild = null;
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
