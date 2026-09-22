import { BOSS_EVOLUTIONS, EVOLVED_ELITES } from "./content/encounters";
import {
  type BossPhaseState,
  evolutionEnabled,
  forecastEnemyAction,
  intentAt,
  resolveEnemyAction,
  resolveIncomingHit,
  shouldQueuePhase
} from "./encounters";
/**
 * 领域内核：GameEngine（原版 js/engine.js 的 1:1 TypeScript 化迁移）。
 *
 * 设计约束：
 * - 纯函数式内核：不依赖 DOM/IO/存储，订阅式状态广播（Observer）；
 * - 确定性：LCG 种子随机，同一命令流必然同一结局（测试与回放的基石）；
 * - 行为与原版逐行等价，由 tests/contract 九个契约测试守护。
 *
 * P2 演进（见 docs/REDESIGN-PLAN.md）：新增战役模式 startCampaign——
 * 楼层选择由 LevelMapGenerator 生成的分支地图驱动（prepareFloorOptions 双轨：
 * 无 campaign 时走原线性池，9 个黄金契约不动；有 campaign 时走地图前线）。
 * 节点 ★ 评价（无伤/声韵≥85/限时）与宝箱/问答节点纯函数规则见 levelgen.ts。
 */

import { bravoTransition, ultimateEnabled, ultimateResolve } from "./bravo";
import {
  buildEnabled,
  deckSkill,
  removalPrice,
  removalReason,
  upgradeReason,
  upgradesAfterRemoval
} from "./buildcraft";
import type { ChallengeRun } from "./challenge";
import {
  ACT_DIFFICULTY_TARGET,
  CAMPAIGN_SUSTAIN,
  DIFFICULTY_CURVE,
  MAX_ENERGY,
  P7_ACT_DIFFICULTY_TARGET,
  P8B_ACT_DIFFICULTY_TARGET,
  P8_ACT_DIFFICULTY_TARGET,
  QUIZ_PER_NODE,
  REST_HEAL,
  TREASURE
} from "./config/balance";
import {
  ACT_COUNT,
  ALL_ITEMS,
  type ContentRuleset,
  actContent,
  eventsFor,
  itemsFor,
  lookupSkill,
  relicsUpToAct,
  skillsFor
} from "./content";
import { FORGE_RELICS } from "./content/forge";
import { quizPoolFor } from "./content/listening";
import { CHARACTERS, type CharacterId, lookupCharacter } from "./content/roster";
import { ULTIMATE_FOR_CHARACTER } from "./content/ultimates";
import { type CounterStance, counterEnabled, resolveCounterDamage } from "./counter";
import { FLOOR_NAMES, MAX_FLOOR, QUIZ_QUESTIONS, clone } from "./data";
import type { EnemyBlueprint, EnemyIntent, GameEventContent, QuizQuestion, Skill } from "./data";
import { availableNodeIds, evaluateCombatStars, generateActMap, nodeById } from "./levelgen";
import type { ActMap, MapNodeType } from "./levelgen";
import { MASTERY_FLOOR, masteryEnabled, masteryJudgeScore } from "./mastery";
import { type ChallengeState, mutationEffects, mutationStage, selectMutators } from "./mutators";
import { applyCastPassive, resetTurnPassives, rosterEnabled } from "./roster";
import { parseJyutpingTones } from "./tone";

export type Phase =
  | "title"
  | "tower"
  | "battle"
  | "event"
  | "rest"
  | "shop"
  | "reward"
  | "quiz"
  | "victory"
  | "defeat";

/** P2 起：节点类型全集由 levelgen 定义（新增 treasure/quiz），引擎按类型派发生成。 */
export type NodeType = MapNodeType;
export type CombatKind = "battle" | "elite" | "boss";

export interface NodeMeta {
  label: string;
  mark: string;
  tone: string;
  hint: string;
}

export interface FloorOption extends NodeMeta {
  id: string;
  floor: number;
  type: NodeType;
}

export interface Buff {
  id: string;
  name: string;
  value: number;
  turns: number;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  armor: number;
  strength: number;
  voiceMastery: number;
  gold: number;
  deck: string[];
  relics: string[];
  items: string[];
  buffs: Buff[];
  /** P8-A 按牌组槽位标记，删除时平移；不修改全局技能。 */
  upgradedSlots?: number[];
  removedCards?: number;
}

export interface RuntimeEnemy extends EnemyBlueprint {
  maxHp: number;
  baseAttack: number;
  armor: number;
  weakness: number;
  vulnerable: number;
}

export interface HandCard {
  id: string;
  index: number;
}

export interface ScoreTier {
  key: string;
  label: string;
  multiplier: number;
}

export interface VoiceResultMeta {
  transcript?: string;
  confidence?: number | null;
  similarity?: number | null;
  source?: string;
  /** P10：调准分（花旦「绕梁」消费）；适配器已产出、UI 整体透传，无基频通道恒 null。 */
  toneScore?: number | null;
}

export interface ResolvedSkillResult {
  skillId: string;
  rawScore: number;
  score: number;
  tier: ScoreTier;
  damage: number;
  armor: number;
  healing: number;
  transcript: string;
  confidence: number | null;
  similarity: number | null;
  source: string;
}

export interface CombatState {
  /** P8-B 序列化阶段进度；读档不重放阶段切换。 */
  bossPhase?: BossPhaseState;
  kind: CombatKind;
  enemy: RuntimeEnemy;
  turn: number;
  energy: number;
  hand: HandCard[];
  log: string[];
  firstAttack: boolean;
  teaTriggered: boolean;
  voiceBoost: number;
  scoreHistory: number[];
  /** 本场战斗受到的生命伤害累计（P2 无伤★评价依据；护甲抵消不计）。 */
  damageTaken: number;
  lastResult: ResolvedSkillResult | null;
  locked: boolean;
  /** P5 手牌数（碧玉洞箫 +1；缺省 3，旧存档兼容）。 */
  handSize?: number;
  /** P5 泊港铜铃：本回合首次施法标记。 */
  bellTriggered?: boolean;
  /** P5 咸柠茶盅：本回合回血标记。 */
  lemonTriggered?: boolean;
  /** P9 反击姿态：敌方下次攻击被挡下时按比率还击，触发后消耗；随存档序列化。 */
  counter?: CounterStance;
  /** P10 名伶一次性被动标记（亮相=每场；jest-turn=每回合）；旧档缺省不启用。 */
  passives?: Record<string, boolean>;
  /** P11 满堂彩（0–3）；连续正音累积，非正音归零；彩满可发动绝技。 */
  bravo?: number;
  /** P11 本场绝技已发动（每场一次）；旧档缺省未用。 */
  ultimateUsed?: boolean;
  /** P15 锻造遗物「每场一次」消耗标记（存已生效的遗物 id；旧档缺省不启用）。 */
  forgeUsed?: string[];
}

export interface EventState extends GameEventContent {
  resolved: boolean;
  outcome: string;
}

export interface ShopOffer {
  key: string;
  type: "skill" | "item" | "relic";
  id: string;
  price: number;
  sold: boolean;
}

export interface ShopState {
  offers: ShopOffer[];
  removalUsed?: boolean;
}

export interface RewardBonus {
  type: "relic" | "item";
  id: string;
}

export interface RewardState {
  gold: number;
  choices: string[];
  bonus: RewardBonus | null;
}

export interface RunStats {
  startedAt: string;
  enemiesDefeated: number;
  elitesDefeated: number;
  voiceAttempts: number;
  voiceScoreTotal: number;
  bestVoiceScore: number;
  damageDealt: number;
  damageTaken: number;
  skillsLearned: number;
}

/** P2 战役进度（内嵌于存档 GameState；可选字段，旧版经典局不受影响）。 */
export interface CampaignState {
  act: number;
  map: ActMap;
  clearedIds: string[];
  /** 节点 ★ 最高纪录（重打覆盖只升不降） */
  stars: Record<string, number>;
  /** 正在进行的战斗节点（战斗胜利结算后清空） */
  currentNodeId: string | null;
}

/** P2 问答节点进行中状态。 */
export interface QuizState {
  nodeId: string;
  questions: QuizQuestion[];
  index: number;
  correct: number;
  /** 已选项下标（null=未作答）；作答后停留展示解析，advanceQuiz 推进 */
  selected: number | null;
  /** P13：本节点抽中的听音题数（UI 提示可用 🔊 重播） */
  listeningCount?: number;
  /** P13：本机无粤语音色而被跳过的听音题数（UI 如实说明） */
  listeningSkipped?: number;
}

/**
 * P12 切磋身份：本局由他人（或自己的历史战绩）的切磋码开局时挂上，
 * 只记录码与码内身份，不含任何玩家数据；旧局无此字段。
 */
export interface DuelState {
  /** 原始切磋码（分享与战绩簿展示用） */
  code: string;
  /** 码哈希（战绩簿键；同一码只有一条最佳记录） */
  hash: string;
  mode: "campaign" | "endless" | "daily" | "classic";
  act: number;
  seed: number;
  dateKey?: string;
  character?: CharacterId;
}

export interface GameState {
  version: 2;
  phase: Phase;
  seed: number;
  rngState: number;
  floor: number;
  maxFloor: number;
  floorOptions: FloorOption[];
  player: PlayerState | null;
  combat: CombatState | null;
  event: EventState | null;
  shop: ShopState | null;
  reward: RewardState | null;
  notice: string | null;
  stats: RunStats | null;
  campaign?: CampaignState | null;
  quiz?: QuizState | null;
  /** P4 无尽塔模式：无 Boss 无终点，难度按层持续放大 */
  endless?: boolean;
  /** P4 自适应难度系数（± 生命/攻击缩放，由组合根注入，存档自恢复） */
  adaptiveBoost?: number;
  /** P7 可选版本：缺失保留基础池，跨幕/读档不变。 */
  ruleset?: ContentRuleset;
  /** 构筑规则独立于内容版本；只在显式开启的新战役中生效。 */
  buildVersion?: 1;
  encounterVersion?: 1;
  /** P9 反击姿态版本；与 build/encounter 版本分离，缺省保留旧行为。 */
  counterVersion?: 1;
  /** P10 名伶版本；缺省 = 旧局，起始牌组与被动逐位不变。 */
  rosterVersion?: 1;
  characterId?: CharacterId;
  /** P11 满堂彩版本；缺省 = 旧局，无彩槽与绝技。 */
  ultimateVersion?: 1;
  /** P12 切磋码版本；缺省 = 非切磋局（既有开局路径零接触）。 */
  challengeVersion?: 1;
  /** P13 语言力量化版本；缺省 = 旧局，牌面威力逐位不变。 */
  masteryPowerVersion?: 1;
  /** P15 铸剑炉内容版本；缺省 = 旧局，事件/题池与 P14 逐位一致。 */
  forgeVersion?: 1;
  /** P17 词海内容版本；缺省 = 旧局，短句/题池与 P16 逐位一致。 */
  lexiconVersion?: 1;
  /** P15 锻造流派遗物已于本局首胜授予（一局一件，确定性，不入随机池）。 */
  forgeRelicGranted?: 1;
  /** P12 切磋局身份；缺省 = 自开一局。 */
  duel?: DuelState;
  challenge?: ChallengeState;
}

/** P4 自适应难度注入点（组合根接 profile / 设置；默认 0，行为与原版一致）。 */
/**
 * P14 自适应难度注入点。带上下文是因为难度 2.0 改成**按模式/按幕记账**：
 * 组合根据 `{ endless, campaign, act }` 选对应的本地评级换算缩放；零参实现依旧合法（等价 classic）。
 */
export interface AdaptiveContext {
  endless?: boolean;
  campaign?: boolean;
  act?: number;
}

export type AdaptiveProvider = (context?: AdaptiveContext) => number;

export interface IntentPreview {
  forecast?: string;
  hint?: string;
  hpLoss?: number;
  blocked?: number;
  nextLabel?: string;
  /** P9：反击姿态下的预计还击伤害（与实际结算共用 resolveCounterDamage；穿甲/无伤害意图缺省）。 */
  counter?: number;
  label: string;
  detail: string;
  type: string;
}

export interface HitResult {
  actual: number;
  blocked: number;
}

/** P10 战役配置对象：新开战役首选 API；旧位置签名保留为等价转发（理由见 docs/ROSTER-PLAN.md §2）。 */
export interface CampaignConfig {
  act?: number;
  seed?: number;
  ruleset?: ContentRuleset;
  buildVersion?: 1;
  encounterVersion?: 1;
  counterVersion?: 1;
  rosterVersion?: 1;
  /** 仅 rosterVersion=1 生效；缺省文武生（确定性缺省） */
  character?: CharacterId;
  /** P11 满堂彩绝技版本 */
  ultimateVersion?: 1;
  /** P13 语言力量化版本（词林掌握度 → 该句 +1/+2 威力） */
  masteryPowerVersion?: 1;
  /** P15 铸剑炉内容版本（锻造事件/遗物/题池；仅 ruleset=p7 生效） */
  forgeVersion?: 1;
  /** P17 词海内容版本（+155 短句 / +80 问答；仅 ruleset=p7 生效） */
  lexiconVersion?: 1;
}

/** startCampaign 兼容两种形态：位置参数（旧）或 CampaignConfig（新）。 */
export type StartCampaignArgs = [number?, number?, ContentRuleset?, 1?, 1?, 1?] | [CampaignConfig];

export interface RunSummary {
  floor: number;
  enemies: number;
  elites: number;
  averageScore: number;
  bestScore: number;
  damage: number;
  skills: number;
}

export interface EmitOptions {
  save?: boolean;
  effect?: string;
}

export type EngineListener = (state: GameState, options: EmitOptions) => void;

const STARTER_DECK = [
  "ding-ngang-soeng",
  "ding-ngang-soeng",
  "m-sai-geng",
  "hou-sai-lei",
  "zap-saang-laa"
];

export const NODE_META: Record<NodeType, NodeMeta> = {
  battle: { label: "街巷战", mark: "战", tone: "red", hint: "遭遇随机敌人" },
  event: { label: "奇遇", mark: "遇", tone: "blue", hint: "选择会改变旅程" },
  rest: { label: "歇脚处", mark: "歇", tone: "green", hint: "疗伤或练声" },
  shop: { label: "夜市", mark: "市", tone: "gold", hint: "购买技能和道具" },
  elite: { label: "强敌关", mark: "险", tone: "violet", hint: "高风险，必得遗物" },
  boss: { label: "声煞之巅", mark: "首", tone: "gold", hint: "幕顶最终试炼" },
  treasure: { label: "藏宝箱", mark: "宝", tone: "gold", hint: "纯收益：银两与旧物" },
  quiz: { label: "街坊问答", mark: "问", tone: "blue", hint: "粤语常识评星" }
};

function makeSeed(): number {
  const time = Date.now() >>> 0;
  const random = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return time ^ random || 0x6d2b79f5;
}

/** 音节数（P13 力量化按音节逐项判定，需与内容侧同一套粤拼解析）。 */
function syllableCountOf(jyutping: string | undefined): number {
  return jyutping ? parseJyutpingTones(jyutping).length : 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function unique<T>(list: T[]): T[] {
  return [...new Set(list)];
}

export class GameEngine {
  state: GameState;
  private listeners = new Set<EngineListener>();
  /** P4：自适应难度系数提供者（组合根注入；默认关闭=0）。 */
  adaptiveProvider: AdaptiveProvider = () => 0;

  /**
   * P13 词林力量化注入点（组合根接本地 SRS 聚合；缺省 undefined = 零加成）。
   * 内核依旧零 IO：引擎只拿「这句加几点威力」这一个纯数字。
   */
  masteryProvider?: (skillId: string, syllableCount: number) => number;
  /** 仿真仪表：本局「词林保底」真正抬分的次数（不参与任何判定与结算）。 */
  masterySaves = 0;

  /**
   * P13 本机是否有粤语音色（组合根注入；缺省 false = 保守跳过听音题）。
   * 只决定问答题池大小，不参与任何战斗数值。
   */
  quizVoiceAvailable?: () => boolean;

  constructor(initialState: GameState | null = null) {
    this.state = initialState || this.createTitleState();
  }

  createTitleState(): GameState {
    return {
      version: 2,
      phase: "title",
      seed: 0,
      rngState: 0,
      floor: 0,
      maxFloor: MAX_FLOOR,
      floorOptions: [],
      player: null,
      combat: null,
      event: null,
      shop: null,
      reward: null,
      notice: null,
      stats: null,
      campaign: null,
      quiz: null
    };
  }

  createRunState(seed: number = makeSeed(), context?: AdaptiveContext): GameState {
    return {
      version: 2,
      phase: "tower",
      seed,
      rngState: seed,
      floor: 0,
      maxFloor: MAX_FLOOR,
      floorOptions: [],
      player: {
        hp: 72,
        maxHp: 72,
        armor: 0,
        strength: 0,
        voiceMastery: 0,
        gold: 26,
        deck: [...STARTER_DECK],
        relics: [],
        items: ["throat-candy"],
        buffs: []
      },
      combat: null,
      event: null,
      shop: null,
      reward: null,
      notice: "旅程开始。选择第一道门。",
      stats: {
        startedAt: new Date().toISOString(),
        enemiesDefeated: 0,
        elitesDefeated: 0,
        voiceAttempts: 0,
        voiceScoreTotal: 0,
        bestVoiceScore: 0,
        damageDealt: 0,
        damageTaken: 0,
        skillsLearned: 0
      },
      campaign: null,
      quiz: null,
      endless: false,
      adaptiveBoost: this.adaptiveProvider(context)
    };
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(options: EmitOptions = {}): void {
    for (const listener of this.listeners) {
      listener(this.state, options);
    }
  }

  startNew(seed?: number): void {
    this.state = this.createRunState(seed);
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  /**
   * P2 闯关战役：以给定种子生成该幕分支地图并开新一局。
   * 同一 act 种子 = 同一张地图（★最高纪录可跨局累计，由组合根注入/同步）。
   * P5 起：内容（敌/精英/Boss/事件/楼层名）随幕切换，act 越界钳到 [1, ACT_COUNT]。
   */
  startCampaign(
    actOrConfig: number | CampaignConfig = 1,
    seedArg?: number,
    rulesetArg?: ContentRuleset,
    buildVersionArg?: 1,
    encounterVersionArg?: 1,
    counterVersionArg?: 1
  ): void {
    // P10 参数对象归一化：新形态 CampaignConfig 与旧位置签名等价（旧契约零改动）
    const config: CampaignConfig =
      typeof actOrConfig === "object" && actOrConfig !== null
        ? actOrConfig
        : {
            act: actOrConfig,
            seed: seedArg,
            ruleset: rulesetArg,
            buildVersion: buildVersionArg,
            encounterVersion: encounterVersionArg,
            counterVersion: counterVersionArg
          };
    const act = config.act ?? 1;
    const seed = config.seed ?? makeSeed();
    const ruleset = config.ruleset ?? "legacy";
    const buildVersion = config.buildVersion;
    const encounterVersion = config.encounterVersion;
    const counterVersion = config.counterVersion;
    const ultimateVersion = config.ultimateVersion;
    const pack = actContent(act);
    const actNo = pack.act;
    // P5 修复：种子同时驱动地图与战斗 LCG——同 (act, seed) 必得同局（可复现/回放的基石）
    // P14：难度按**幕**在建局时一次采样（三幕曲线不同，共用一个数会互相污染）
    this.state = this.createRunState(seed, { campaign: true, act: actNo });
    if (ruleset === "p7") this.state.ruleset = ruleset;
    if (ruleset === "p7" && buildVersion === 1) {
      this.state.buildVersion = 1;
      this.state.player!.upgradedSlots = [];
      this.state.player!.removedCards = 0;
    }
    if (ruleset === "p7" && encounterVersion === 1) this.state.encounterVersion = 1;
    if (ruleset === "p7" && counterVersion === 1) this.state.counterVersion = 1;
    if (ruleset === "p7" && ultimateVersion === 1) this.state.ultimateVersion = 1;
    // P13 语言力量化：独立门控；缺省 = 旧局，牌面威力逐位不变
    if (ruleset === "p7" && config.masteryPowerVersion === 1) this.state.masteryPowerVersion = 1;
    // P15 铸剑炉内容：独立门控；缺省 = 旧局，事件/题池逐位不变（流派遗物首胜授予）
    if (ruleset === "p7" && config.forgeVersion === 1) this.state.forgeVersion = 1;
    // P17 词海内容：独立门控；缺省 = 旧局，短句/题池逐位不变
    if (ruleset === "p7" && config.lexiconVersion === 1) this.state.lexiconVersion = 1;
    // P10 名伶：独立版本门控；角色缺省文武生（确定性缺省）；起始牌组覆写不耗 RNG
    if (ruleset === "p7" && config.rosterVersion === 1) {
      this.state.rosterVersion = 1;
      const character = lookupCharacter(config.character) ?? lookupCharacter("man-mou-saang")!;
      this.state.characterId = character.id;
      this.state.player!.deck = [...character.startingDeck];
    }
    const map = generateActMap(seed, actNo);
    this.state.campaign = {
      act: actNo,
      map,
      clearedIds: [],
      stars: {},
      currentNodeId: null
    };
    this.state.maxFloor = map.rows - 1;
    this.state.notice = pack.notice;
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  /**
   * P5 跨幕续行：幕 Boss 落幕后乘胜登楼——保留牌组/遗物/生命/战绩，
   * 换一张新幕地图（种子由当前局种子派生，同局续行可复现），
   * 塔间小憩回复 20% 最大生命。仅战役胜利相可用，终幕（第三幕）后不可续。
   */
  continueNextAct(seed?: number): void {
    const campaign = this.state.campaign;
    if (this.state.phase !== "victory" || !campaign) return;
    const nextAct = campaign.act + 1;
    if (nextAct > ACT_COUNT) return;
    const pack = actContent(nextAct);
    const mapSeed = seed ?? (this.state.seed + nextAct * 0x9e3779b9) >>> 0;
    const map = generateActMap(mapSeed, nextAct);
    const rested = this.healPlayer(Math.ceil(this.state.player!.maxHp * 0.2));
    this.state.seed = mapSeed;
    // P14：续行换了幕 → 难度按新幕重采样（同一局内跟随幕变化，而非开局钉死）
    campaign.act = nextAct;
    if (!this.state.duel) {
      this.state.adaptiveBoost = this.adaptiveProvider({ campaign: true, act: nextAct });
    }
    campaign.map = map;
    campaign.clearedIds = [];
    campaign.stars = {};
    campaign.currentNodeId = null;
    this.state.floor = 0;
    this.state.maxFloor = map.rows - 1;
    this.state.combat = null;
    this.state.reward = null;
    this.state.quiz = null;
    this.state.phase = "tower";
    // P12：切磋码只约定它写明的那一幕；续行之后的塔是玩家自己的局，
    // 摘掉码身份，避免不同幕的战绩挂在同一个码哈希下（战绩簿串幕）。
    this.state.duel = undefined;
    this.state.notice = `${pack.notice}（塔间小憩：回复 ${rested} 点生命。）`;
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  /** P4 无尽塔：无终点的单段爬楼，楼层无限延伸（5 的倍数为强敌关，永不出现 Boss）。 */
  startEndless(seed?: number, ruleset: ContentRuleset = "legacy"): void {
    // P14：无尽与经典分开记账
    this.state = this.createRunState(seed, { endless: true });
    if (ruleset === "p7") {
      this.state.ruleset = ruleset;
      this.state.challenge = {
        mode: "endless",
        seed: this.state.seed,
        stage: 0,
        mutatorIds: selectMutators(this.state.seed)
      };
    }
    this.state.endless = true;
    this.state.maxFloor = Number.MAX_SAFE_INTEGER;
    this.state.notice = "无尽塔开楼：没有天台，只有下一层。";
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  /** P7 每日挑战：日期身份随存档保存；个人自适应不参与同日挑战。 */
  startDaily(seed: number, dateKey: string): void {
    this.state = this.createRunState(seed);
    this.state.ruleset = "p7";
    this.state.adaptiveBoost = 0;
    this.state.challenge = {
      mode: "daily",
      seed,
      dateKey,
      stage: 0,
      mutatorIds: selectMutators(seed)
    };
    this.state.notice = "每日挑战：同一本地日期使用同一种子与词缀；本局不启用自适应难度。";
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  /**
   * P12 切磋码开局：按码内身份与版本束**原样**开一局（同码同局）。
   * 校验与还原已在 core/challenge.ts 完成（拒绝路径不会走到这里）；本方法只负责：
   * 1) 透传既有开局路径（战役版本束 / 无尽词缀 / 每日日期键 / 经典十层种子）；
   * 2) 盖上切磋身份（duel + challengeVersion），战绩簿与结算屏据此认码；
   * 3) 难度跟随码（码内自适应加成，缺省 0）——切磋局**不采样本机自适应节律**，
   *    否则连胜玩家的码在连败玩家手里就不是同一局（GROWTH §6.2 同码同难）。
   */
  startChallenge(run: ChallengeRun): void {
    if (run.mode === "daily") {
      this.startDaily(run.seed, run.dateKey ?? "");
    } else if (run.mode === "endless") {
      this.startEndless(run.seed, run.ruleset);
    } else if (run.mode === "campaign") {
      this.startCampaign({
        act: run.act,
        seed: run.seed,
        ruleset: run.ruleset,
        buildVersion: run.build,
        encounterVersion: run.encounter,
        counterVersion: run.counter,
        rosterVersion: run.roster,
        character: run.character,
        ultimateVersion: run.ultimate,
        forgeVersion: run.forge,
        lexiconVersion: run.lexicon
      });
    } else {
      this.startNew(run.seed);
    }
    this.state.challengeVersion = 1;
    this.state.duel = {
      code: run.code,
      hash: run.hash,
      mode: run.mode,
      act: run.act,
      seed: run.seed,
      dateKey: run.dateKey,
      character: run.character
    };
    // 码内以百分点整数携带（5 / -8），引擎内是比值（0.05 / -0.08）
    this.state.adaptiveBoost = (run.adaptiveBoost ?? 0) / 100;
    this.state.notice = `切磋局 #${run.hash.slice(0, 8)}：同码同局，本局不启用本机自适应难度。`;
    this.emit({ save: true });
  }

  load(state: GameState): void {
    this.state = clone(state);
    this.state.notice = "已恢复上次进度。";
    this.emit({ save: false });
  }

  showTitle(): void {
    this.state = this.createTitleState();
    this.emit({ save: false });
  }

  random(): number {
    this.state.rngState = (Math.imul(this.state.rngState, 1664525) + 1013904223) >>> 0;
    return this.state.rngState / 4294967296;
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  pick<T>(list: T[]): T {
    return list[Math.floor(this.random() * list.length)];
  }

  pickDistinct<T extends { id: string }>(list: T[], count: number, excluded: string[] = []): T[] {
    const pool = list.filter((item) => !excluded.includes(item.id));
    const result: T[] = [];
    while (pool.length && result.length < count) {
      const index = Math.floor(this.random() * pool.length);
      result.push(pool.splice(index, 1)[0]);
    }
    return result;
  }

  hasRelic(id: string): boolean {
    return Boolean(this.state.player?.relics.includes(id));
  }

  /** P15 锻造遗物「每场一次」消耗：本场首次生效返回 true，随后恒 false。 */
  private forgeConsume(relicId: string): boolean {
    const combat = this.state.combat;
    if (!combat || !this.hasRelic(relicId)) return false;
    combat.forgeUsed ??= [];
    if (combat.forgeUsed.includes(relicId)) return false;
    combat.forgeUsed.push(relicId);
    return true;
  }

  prepareFloorOptions(): void {
    // P2 战役轨：候选节点 = 地图前线（未清理且父节点已清理；未开局时为首行起点）
    const campaign = this.state.campaign;
    if (campaign) {
      this.state.floorOptions = availableNodeIds(campaign.map, campaign.clearedIds).map((id) => {
        const node = nodeById(campaign.map, id)!;
        return { id: node.id, floor: node.row, type: node.type, ...NODE_META[node.type] };
      });
      return;
    }

    const nextFloor = this.state.floor + 1;
    const challenge = this.state.challenge;
    if (challenge) {
      challenge.stage = mutationStage(challenge.mode, nextFloor);
      challenge.mutatorIds = selectMutators(challenge.seed, challenge.stage);
    }
    const endless = Boolean(this.state.endless);
    if (!endless && nextFloor > MAX_FLOOR) return;

    let types: NodeType[];
    if (!endless && nextFloor === MAX_FLOOR) {
      types = ["boss"];
    } else if (nextFloor === 5 || (endless && nextFloor % 5 === 0)) {
      types = ["elite"];
    } else {
      const pool: NodeType[] =
        nextFloor <= 2
          ? ["battle", "battle", "event", "rest"]
          : ["battle", "battle", "battle", "event", "event", "rest", "shop"];
      const first = this.pick(pool);
      const secondPool = pool.filter((type) => type !== first);
      const second = this.pick(secondPool.length ? secondPool : pool);
      types = unique([first, second]);
      if (types.length === 1) types.push(first === "battle" ? "event" : "battle");
    }

    this.state.floorOptions = types.map((type, index) => ({
      id: `${nextFloor}-${type}-${index}`,
      floor: nextFloor,
      type,
      ...NODE_META[type]
    }));
  }

  chooseFloorOption(optionId: string): void {
    if (this.state.phase !== "tower") return;
    const option = this.state.floorOptions.find((entry) => entry.id === optionId);
    if (!option) return;

    this.state.floor = option.floor;
    this.state.floorOptions = [];
    this.state.notice = null;

    // 战役：记下当前节点，节点内容完成时（战斗胜利/离开事件/歇脚/离店）标记清理
    if (this.state.campaign) this.state.campaign.currentNodeId = option.id;

    if (option.type === "battle" || option.type === "elite" || option.type === "boss") {
      this.startCombat(option.type);
    } else if (option.type === "event") {
      this.startEvent();
    } else if (option.type === "rest") {
      this.state.phase = "rest";
    } else if (option.type === "shop") {
      this.startShop();
    } else if (option.type === "treasure") {
      this.openTreasure(option.id);
    } else if (option.type === "quiz") {
      this.startQuiz(option.id);
    }
    this.emit({ save: true });
  }

  /** P2 节点结算：标记清理 + ★纪录只升不降。 */
  completeMapNode(nodeId: string, stars: number): void {
    const campaign = this.state.campaign;
    if (!campaign) return;
    if (!campaign.clearedIds.includes(nodeId)) campaign.clearedIds.push(nodeId);
    campaign.stars[nodeId] = Math.max(campaign.stars[nodeId] ?? 0, stars);
    campaign.currentNodeId = null;
  }

  /** P2 宝箱节点：纯收益（银两 + 概率道具/遗物），固定 1★。 */
  openTreasure(nodeId: string): void {
    const player = this.state.player!;
    const gold = this.randomInt(TREASURE.goldMin, TREASURE.goldMax);
    player.gold += gold;
    const finds: string[] = [`${gold} 两`];
    if (this.random() < TREASURE.itemChance) {
      const item = this.pick(itemsFor(this.state.ruleset));
      player.items.push(item.id);
      finds.push(`「${item.name}」`);
    }
    if (this.random() < TREASURE.relicChance) {
      const relic = this.pickDistinct(
        relicsUpToAct(this.state.campaign?.act ?? 1),
        1,
        player.relics
      )[0];
      if (relic) {
        player.relics.push(relic.id);
        finds.push(`遗物「${relic.name}」`);
      }
    }
    this.completeMapNode(nodeId, 1);
    this.state.notice = `藏宝箱开启：获得 ${finds.join("、")}。`;
    this.emit({ save: false, effect: "treasure" });
    this.state.phase = "tower";
    this.prepareFloorOptions();
  }

  /** P2 问答节点：3 道粤语常识题，答对题数即★数。 */
  /**
   * P13：题池按（内容版本 × 本机粤语音色）组装——无音色时听音题整题跳过（诚实降级）。
   * 抽题仍走同一 pickDistinct：同设备 + 同种子 = 同题；设备能力差异如实计入报告。
   */
  startQuiz(nodeId: string): void {
    const voiceAvailable = this.quizVoiceAvailable?.() ?? false;
    const { pool, listeningTotal } = quizPoolFor(
      this.state.ruleset,
      voiceAvailable,
      this.state.forgeVersion,
      this.state.lexiconVersion
    );
    const questions = this.pickDistinct(pool, QUIZ_PER_NODE);
    this.state.quiz = {
      nodeId,
      questions,
      index: 0,
      correct: 0,
      selected: null,
      listeningCount: questions.filter((question) => question.requiresAudio).length,
      listeningSkipped: voiceAvailable ? 0 : listeningTotal
    };
    this.state.phase = "quiz";
  }

  answerQuizOption(optionIndex: number): void {
    const quiz = this.state.quiz;
    if (this.state.phase !== "quiz" || !quiz || quiz.selected !== null) return;
    const question = quiz.questions[quiz.index];
    quiz.selected = optionIndex;
    if (optionIndex === question.answerIndex) quiz.correct += 1;
    this.emit({ save: true });
  }

  advanceQuiz(): void {
    const quiz = this.state.quiz;
    if (this.state.phase !== "quiz" || !quiz || quiz.selected === null) return;
    if (quiz.index + 1 < quiz.questions.length) {
      quiz.index += 1;
      quiz.selected = null;
      this.emit({ save: true });
      return;
    }
    const total = quiz.questions.length;
    this.completeMapNode(quiz.nodeId, Math.max(1, Math.min(3, quiz.correct)));
    this.state.quiz = null;
    this.state.notice = `问答结束：答对 ${quiz.correct}/${total}，星辉已刻入地图。`;
    this.state.phase = "tower";
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  scaledEnemy(source: EnemyBlueprint, kind: CombatKind): RuntimeEnemy {
    const enemy = clone(source) as unknown as RuntimeEnemy;
    // P4 自适应系数：组合根按近绩注入（±15% 上限内微调生命/攻击）
    const adaptive = 1 + clamp(this.state.adaptiveBoost ?? 0, -0.15, 0.15);
    // P5 战役难度映射：敌人曲线按经典 10 层调校，战役 15 行的行号按各幕
    // 难度目标折算等效层数（一幕顶 ≈ 第 6 层，三幕顶 = 第 10 层旧版终局强度）；
    // 经典/无尽模式沿用真实楼层，行为不变。
    const campaign = this.state.campaign;
    const targets = evolutionEnabled(this.state)
      ? P8B_ACT_DIFFICULTY_TARGET
      : buildEnabled(this.state)
        ? P8_ACT_DIFFICULTY_TARGET
        : this.state.ruleset === "p7"
          ? P7_ACT_DIFFICULTY_TARGET
          : ACT_DIFFICULTY_TARGET;
    const scaleFloor = campaign
      ? 1 +
        (this.state.floor / Math.max(1, campaign.map.rows - 1)) *
          ((targets[campaign.act] ?? MAX_FLOOR) - 1)
      : this.state.floor;
    const steps = Math.max(0, scaleFloor - 1);
    const hpScale =
      (1 +
        steps *
          (kind === "boss" ? DIFFICULTY_CURVE.bossHpPerFloor : DIFFICULTY_CURVE.enemyHpPerFloor)) *
      adaptive;
    const attackScale = (1 + steps * DIFFICULTY_CURVE.attackPerFloor) * adaptive;
    enemy.maxHp = Math.round(enemy.hp * hpScale);
    enemy.hp = enemy.maxHp;
    enemy.baseAttack = Math.max(1, Math.round(enemy.attack * attackScale));
    enemy.armor = 0;
    enemy.weakness = 0;
    enemy.vulnerable = 0;
    return enemy;
  }

  startCombat(kind: CombatKind = "battle"): void {
    // P5：敌人池按幕取（act 1 与既有 ENEMIES/ELITES/BOSS 逐位一致）
    const pack = actContent(this.state.campaign?.act ?? 1);
    let blueprint: EnemyBlueprint;
    if (kind === "boss") {
      blueprint = pack.boss;
    } else if (kind === "elite") {
      blueprint = this.pick(
        evolutionEnabled(this.state) ? [...pack.elites, EVOLVED_ELITES[pack.act]] : pack.elites
      );
    } else {
      const unlocked = pack.enemies.slice(
        0,
        clamp(2 + Math.floor(this.state.floor / 2), 2, pack.enemies.length)
      );
      blueprint = this.pick(unlocked);
    }

    const openingStrength = this.hasRelic("old-radio") ? 1 : 0;
    const player = this.state.player!;
    this.state.phase = "battle";
    player.armor = this.hasRelic("ferry-lantern") ? 4 : 0;
    player.strength = openingStrength;
    const handSize = this.hasRelic("jade-flute") ? 4 : 3;
    this.state.combat = {
      kind,
      enemy: this.scaledEnemy(blueprint, kind),
      turn: 1,
      energy: this.hasRelic("old-compass") ? MAX_ENERGY + 1 : MAX_ENERGY,
      hand: this.drawHand(handSize),
      log: [`${blueprint.name} 挡住去路。`],
      firstAttack: true,
      teaTriggered: false,
      voiceBoost: 0,
      scoreHistory: [],
      damageTaken: 0,
      lastResult: null,
      locked: false,
      handSize,
      bellTriggered: false,
      lemonTriggered: false
    };
    // P15 戏班锦囊：战斗开始时得 4 两（锻造局授予的流派遗物；每场一次）
    if (this.forgeConsume("p15-gam-noung")) {
      player.gold += 4;
      this.state.combat.log.push("戏班锦囊：战斗开始获得 4 两。");
    }
    // P7：只消费已存档词缀，独立随机采样不触碰游戏 LCG。
    const modifiers = mutationEffects(this.state.challenge?.mutatorIds);
    const combat = this.state.combat;
    const enemy = combat.enemy;
    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * modifiers.hpScale));
    enemy.hp = enemy.maxHp;
    enemy.baseAttack = Math.max(1, Math.round(enemy.baseAttack * modifiers.attackScale));
    enemy.armor += modifiers.enemyArmor;
    enemy.vulnerable = modifiers.vulnerable;
    player.armor += modifiers.playerArmor;
    player.strength += modifiers.strength;
    combat.energy = Math.max(0, combat.energy + modifiers.energy);
    combat.voiceBoost += modifiers.voiceBoost;
    this.healPlayer(modifiers.heal);
    if (evolutionEnabled(this.state) && kind === "boss" && BOSS_EVOLUTIONS[enemy.id]) {
      combat.bossPhase = { phase: 1, pending: false, startTurn: 1 };
    }
  }

  drawHand(count: number, omitIds: number[] = []): HandCard[] {
    const player = this.state.player!;
    const deck = player.deck.map((id, index) => ({ id, index }));
    const available = deck.filter((card) => !omitIds.includes(card.index));
    const hand: HandCard[] = [];
    while (available.length && hand.length < count) {
      const index = Math.floor(this.random() * available.length);
      hand.push(available.splice(index, 1)[0]);
    }
    return hand;
  }

  currentIntent(): EnemyIntent | null {
    if (!this.state.combat) return null;
    const { enemy, turn } = this.state.combat;
    return intentAt(
      enemy.pattern,
      turn,
      evolutionEnabled(this.state) ? this.state.combat.bossPhase : undefined
    );
  }

  getIntentPreview(): IntentPreview | null {
    const intent = this.currentIntent();
    const combat = this.state.combat;
    if (!intent || !combat) return null;
    const counter = this.counterForecast(intent);
    if (evolutionEnabled(this.state)) {
      const player = this.state.player!;
      const preview = forecastEnemyAction(
        resolveEnemyAction(intent, combat.enemy.baseAttack, combat.enemy.weakness),
        {
          hp: player.hp,
          armor: player.armor,
          vulnerable: player.buffs.some((buff) => buff.id === "vulnerable"),
          dragonScale: this.hasRelic("dragon-scale")
        }
      );
      const next = combat.bossPhase?.pending
        ? BOSS_EVOLUTIONS[combat.enemy.id]?.pattern[0]
        : intentAt(combat.enemy.pattern, combat.turn + 1, combat.bossPhase);
      return { ...preview, nextLabel: next?.label, ...(counter === null ? {} : { counter }) };
    }
    // 吞音意图预览同样按固定伤害展示（与 endTurn 的 P5 修复一致）
    const rawAttack =
      intent.type === "silence"
        ? intent.amount || 0
        : combat.enemy.baseAttack * (intent.amount || 0);
    const attack = Math.max(0, Math.round(rawAttack));
    const adjusted = combat.enemy.weakness > 0 ? Math.round(attack * 0.65) : attack;
    if (intent.type === "attack") {
      return {
        label: intent.label,
        detail: `${adjusted}${intent.hits ? ` × ${intent.hits}` : ""} 伤害`,
        type: "attack",
        ...(counter === null ? {} : { counter })
      };
    }
    if (intent.type === "guardAttack") {
      return {
        label: intent.label,
        detail: `${adjusted} 伤害 / ${intent.guard} 护甲`,
        type: "mixed",
        ...(counter === null ? {} : { counter })
      };
    }
    if (intent.type === "guard") {
      return { label: intent.label, detail: `${intent.guard} 护甲`, type: "guard" };
    }
    if (intent.type === "silence") {
      return {
        label: intent.label,
        detail: `${adjusted} 伤害 / 扰乱发音`,
        type: "debuff",
        ...(counter === null ? {} : { counter })
      };
    }
    return { label: intent.label, detail: "施加发音干扰", type: "debuff" };
  }

  /**
   * P9 反击预测：与 endTurn 实际结算共用 resolveEnemyAction / forecastEnemyAction /
   * resolveCounterDamage 纯规则；穿甲或无伤害意图返回 null（不显示预测）。
   */
  private counterForecast(intent: EnemyIntent): number | null {
    const combat = this.state.combat;
    if (!combat || !counterEnabled(this.state) || !combat.counter) return null;
    const player = this.state.player!;
    const action = resolveEnemyAction(intent, combat.enemy.baseAttack, combat.enemy.weakness);
    if (action.pierce || action.hits === 0) return null;
    const blocked = forecastEnemyAction(action, {
      hp: player.hp,
      armor: player.armor,
      vulnerable: player.buffs.some((buff) => buff.id === "vulnerable"),
      dragonScale: this.hasRelic("dragon-scale")
    }).blocked;
    if (blocked <= 0) return null;
    return resolveCounterDamage({
      blocked,
      ratio: combat.counter.ratio,
      enemyArmor: combat.enemy.armor,
      enemyVulnerable: combat.enemy.vulnerable > 0
    }).damage;
  }

  /** 读取一张实体卡的有效数值；旧局忽略所有升级附加字段。 */
  getDeckSkill(index: number): Skill | undefined {
    return this.state.player
      ? deckSkill(this.state.player, index, buildEnabled(this.state))
      : undefined;
  }

  canUseSkill(skillId: string, deckIndex?: number): boolean {
    const isBuild = buildEnabled(this.state);
    if (
      isBuild &&
      (deckIndex === undefined ||
        !this.state.combat?.hand.some((card) => card.index === deckIndex && card.id === skillId))
    )
      return false;
    const skill = isBuild ? this.getDeckSkill(deckIndex!) : lookupSkill(skillId);
    if (skill?.id !== skillId) return false;
    return Boolean(
      this.state.phase === "battle" &&
        this.state.combat &&
        !this.state.combat.locked &&
        skill &&
        this.state.combat.energy >= skill.cost
    );
  }

  getScoreTier(score: number): ScoreTier {
    if (score >= 85) return { key: "master", label: "正音", multiplier: 1.32 };
    if (score >= 65) return { key: "clear", label: "清晰", multiplier: 1 };
    // P16 乐学快打：低分档是初学者常态，减罚让"每句练习"更快打完、更快听到下一句
    if (score >= 40) return { key: "learning", label: "入门", multiplier: 0.88 };
    return { key: "shaky", label: "未稳", multiplier: 0.62 };
  }

  resolveSkill(
    skillId: string,
    rawScore: number,
    voiceMeta: VoiceResultMeta = {},
    deckIndex?: number
  ): ResolvedSkillResult | null {
    if (!this.canUseSkill(skillId, deckIndex)) return null;
    const skill = (
      buildEnabled(this.state) ? this.getDeckSkill(deckIndex!) : lookupSkill(skillId)
    ) as Skill;
    const combat = this.state.combat!;
    const player = this.state.player!;

    let bonus = player.voiceMastery + combat.voiceBoost;
    if (this.hasRelic("metronome")) bonus += 5;
    const interference = player.buffs.find((buff) => buff.id === "voice-interference")?.value || 0;
    const score = clamp(Math.round(rawScore + bonus - interference), 0, 100);
    combat.voiceBoost = 0;
    player.buffs = player.buffs.filter((buff) => buff.id !== "voice-interference");

    // P13 词林力量化：掌握度只抬「判定档位」的下限，不进裸分、不进彩（彩仍看 rawScore）
    const masteryFloor = masteryEnabled(this.state)
      ? clamp(
          this.masteryProvider?.(skill.id, syllableCountOf(skill.jyutping)) ?? 0,
          0,
          MASTERY_FLOOR
        )
      : 0;
    const masteryJudge = masteryJudgeScore(
      score,
      masteryFloor,
      (value) => this.getScoreTier(value).key
    );
    const appliedMastery = masteryJudge.applied;
    // 仿真仪表：保底真正救回档位的次数（不影响任何判定；掌握关行恒为 0）
    if (masteryJudge.rescued) this.masterySaves += 1;
    const judgedScore = clamp(masteryJudge.judged, 0, 100);
    const tier = this.getScoreTier(judgedScore);
    combat.energy -= skill.cost;
    combat.scoreHistory.push(score);
    // P11 满堂彩：按裸分累积/断彩（不含声韵加成——彩要真本事；绝技不经此路径）
    if (ultimateEnabled(this.state)) {
      combat.bravo = bravoTransition(combat.bravo ?? 0, rawScore);
    }
    this.state.stats!.voiceAttempts += 1;
    this.state.stats!.voiceScoreTotal += score;
    this.state.stats!.bestVoiceScore = Math.max(this.state.stats!.bestVoiceScore, score);

    const scaledPower = Math.max(1, Math.round(skill.power * tier.multiplier));
    const messages = [`你说出「${skill.phrase}」：${tier.label} ${score} 分。`];
    if (appliedMastery > 0) {
      messages.push(
        `词林保底：判定按 ${judgedScore} 分起算（+${appliedMastery}，这句已练透——正音仍需当场唱准）。`
      );
    }
    const passiveMessages: string[] = []; // P10 名伶被动消息：结算后置顶，确保 HUD 可见
    let damageDone = 0;
    let armorGained = 0;
    let healing = 0;

    let passiveDamageBonus = 0; // P10 亮相：当次施法一次性伤害加成
    const dealDamage = (base: number, options: { bypassArmor?: boolean } = {}): number => {
      let damage = Math.max(0, base + player.strength + passiveDamageBonus);
      if (combat.firstAttack && this.hasRelic("lion-ribbon")) {
        damage += 5;
        messages.push("醒狮红绸令首次攻击 +5。");
      }
      if (combat.enemy.vulnerable > 0) damage = Math.round(damage * 1.25);
      const bypassArmor = options.bypassArmor || false;
      const blocked = bypassArmor ? 0 : Math.min(combat.enemy.armor, damage);
      if (!bypassArmor) combat.enemy.armor -= blocked;
      const actual = Math.max(0, damage - blocked);
      combat.enemy.hp = Math.max(0, combat.enemy.hp - actual);
      combat.firstAttack = false;
      damageDone += actual;
      this.state.stats!.damageDealt += actual;
      return actual;
    };

    const gainArmor = (amount: number): void => {
      player.armor += amount;
      armorGained += amount;
    };

    // P10 名伶被动：纯规则（roster.ts），旧局 rosterEnabled=false 零开销
    if (rosterEnabled(this.state)) {
      const passive = applyCastPassive({
        characterId: this.state.characterId!,
        score,
        toneScore: voiceMeta.toneScore ?? null,
        source: voiceMeta.source || "",
        passives: combat.passives ?? {}
      });
      if (passive) {
        combat.passives = passive.passives;
        if (passive.strengthDelta) {
          player.strength += passive.strengthDelta;
          passiveMessages.push(`声势 +${passive.strengthDelta}。`);
        }
        if (passive.armorDelta) gainArmor(passive.armorDelta);
        if (passive.energyDelta) {
          combat.energy += passive.energyDelta;
          passiveMessages.push(`「打诨」声气 +${passive.energyDelta}。`);
        }
        if (passive.castDamageBonus) {
          passiveDamageBonus = passive.castDamageBonus;
          passiveMessages.push(`「亮相」本次伤害 +${passive.castDamageBonus}。`);
        }
      }
    }

    if (skill.type === "attack") {
      const bypass =
        (skill.id === "dim-gwo-luk-ze" && score >= 65) ||
        (skill.id === "p10-jat-fu-dong-gwaan" && score >= 85);
      dealDamage(scaledPower, { bypassArmor: bypass });
      if (skill.id === "ding-ngang-soeng" && score >= 85) gainArmor(3);
    } else if (skill.type === "multi") {
      // P15 醒狮铜铃：本场首次多段招式每段 +1（锻造局授予的流派遗物）
      const lionBell = this.forgeConsume("p15-sing-tung-ling") ? 1 : 0;
      for (let i = 0; i < (skill.hits ?? 1); i += 1) dealDamage(scaledPower + lionBell);
      if (lionBell) messages.push("醒狮铜铃摇响：每段伤害 +1。");
    } else if (skill.type === "guard") {
      // P15 守夜铁牌：本场首次护甲招式额外 +2（锻造局授予的流派遗物）
      const ironPlate = this.forgeConsume("p15-tit-paai") ? 2 : 0;
      gainArmor(scaledPower + (score >= 65 && skill.id === "m-sai-geng" ? 2 : 0) + ironPlate);
      if (ironPlate) messages.push("守夜铁牌：护甲额外 +2。");
      if (skill.id === "dak-haan-jam-caa") healing += this.healPlayer(3);
      // P9 反击姿态：数据化字段驱动（skill.counter），仅反击版本战役生效。
      if (skill.counter && counterEnabled(this.state)) {
        combat.counter = { ratio: skill.counter.ratio };
        messages.push(
          `摆出反击姿态：敌方下次攻击被护甲挡下时，还击 ${skill.counter.ratio}% 被挡伤害（穿甲不触发）。`
        );
      }
    } else if (skill.type === "hybrid") {
      dealDamage(scaledPower);
      gainArmor(scaledPower);
    } else if (skill.type === "cleanse") {
      gainArmor(scaledPower);
      const before = player.buffs.length;
      player.buffs = player.buffs.filter(
        (buff) => !["voice-interference", "vulnerable"].includes(buff.id)
      );
      if (player.buffs.length < before) messages.push("发音干扰已清除。");
    } else if (skill.type === "strength") {
      let amount = Math.max(1, Math.round(skill.power * (0.7 + tier.multiplier / 2)));
      if (this.hasRelic("thunder-drum")) amount = Math.round(amount * 1.5);
      player.strength += amount;
      messages.push(`声势提升 ${amount}。`);
    } else if (skill.type === "tempo") {
      gainArmor(scaledPower);
      combat.hand = this.drawHand(combat.handSize ?? 3);
      messages.push("你借势换了一组技能。");
    } else if (skill.type === "heal") {
      // P15 陈皮老壶：本场首次治疗招式多回复 4（锻造局授予的流派遗物）
      const agedPot = this.forgeConsume("p15-cean-bei-wu") ? 4 : 0;
      healing += this.healPlayer(scaledPower + agedPot);
      if (agedPot) messages.push("陈皮老壶回甘：多回复 4 点生命。");
      gainArmor(5);
      // P10 顾盼生辉：良好发音清除发音干扰
      if (skill.id === "p10-gu-paan-saang-fai" && score >= 65) {
        const before = player.buffs.length;
        player.buffs = player.buffs.filter((buff) => buff.id !== "voice-interference");
        if (player.buffs.length < before) messages.push("顾盼生辉，发音干扰已清除。");
      }
    } else if (skill.type === "weaken") {
      dealDamage(scaledPower);
      combat.enemy.weakness = Math.max(combat.enemy.weakness, 2);
      messages.push("敌人进入虚弱状态 2 回合。");
      // P10 搞掂晒：夺取敌方半数护甲
      if (skill.id === "p10-gaau-ding-saai" && combat.enemy.armor > 0) {
        const stolen = Math.floor(combat.enemy.armor / 2);
        combat.enemy.armor -= stolen;
        gainArmor(stolen);
        if (stolen > 0) messages.push(`搞掂晒！夺其 ${stolen} 点护甲归为己用。`);
      }
    }

    // P5 泊港铜铃：每回合第一次施法获得 2 点护甲
    if (this.hasRelic("harbor-bell") && !combat.bellTriggered) {
      combat.bellTriggered = true;
      gainArmor(2);
      messages.push("泊港铜铃轻响。");
    }
    // P5 咸柠茶盅：声韵 ≥70 的施法回复 2 点生命（每回合最多一次）
    if (this.hasRelic("salty-lemon") && !combat.lemonTriggered && score >= 70) {
      combat.lemonTriggered = true;
      const lemonHealing = this.healPlayer(2);
      healing += lemonHealing;
      if (lemonHealing) messages.push("咸柠茶盅回甘。");
    }
    // P5 九音骊珠：正音施法后，下一次判定 +6 分
    if (this.hasRelic("nine-tone-pearl") && score >= 85) {
      combat.voiceBoost += 6;
      messages.push("九音骊珠泛起微光。");
    }

    if (score >= 85 && this.hasRelic("tea-cup") && !combat.teaTriggered) {
      const relicHealing = this.healPlayer(2);
      healing += relicHealing;
      combat.teaTriggered = true;
      messages.push("粤韵茶盅回响，回复 2 点生命。");
    }
    // P15 镇楼老鼓：本场首次正音（≥85）施法追加 1 点伤害（锻造局授予的流派遗物）
    if (score >= 85 && this.forgeConsume("p15-zan-lou-gu")) {
      dealDamage(1);
      messages.push("镇楼老鼓擂响：追加 1 点伤害。");
    }

    if (damageDone) messages.push(`造成 ${damageDone} 点伤害。`);
    if (armorGained) messages.push(`获得 ${armorGained} 点护甲。`);
    if (healing) messages.push(`回复 ${healing} 点生命。`);

    combat.lastResult = {
      skillId,
      rawScore,
      score,
      tier,
      damage: damageDone,
      armor: armorGained,
      healing,
      transcript: voiceMeta.transcript || "",
      confidence: voiceMeta.confidence ?? null,
      similarity: voiceMeta.similarity ?? null,
      source: voiceMeta.source || "unknown"
    };
    combat.log.unshift(...messages.reverse());
    combat.log = combat.log.slice(0, 10);
    if (passiveMessages.length) {
      // P10 名伶被动消息置顶（HUD 只显示最新一条）
      combat.log.unshift(...passiveMessages);
      combat.log = combat.log.slice(0, 10);
    }

    if (combat.enemy.hp <= 0) {
      if (combat.bossPhase) combat.bossPhase.pending = false;
      this.finishCombatVictory();
    } else if (
      evolutionEnabled(this.state) &&
      shouldQueuePhase(combat.enemy.id, combat.enemy.hp, combat.enemy.maxHp, combat.bossPhase)
    ) {
      combat.bossPhase!.pending = true;
      combat.log.unshift(
        `半血变招准备：本回合仍执行「${this.currentIntent()!.label}」，行动结束后进入${BOSS_EVOLUTIONS[combat.enemy.id].phaseName}。`
      );
      combat.log = combat.log.slice(0, 10);
    }
    this.emit({ save: true, effect: damageDone ? "hit" : "skill" });
    return combat.lastResult;
  }

  /**
   * P11 满堂彩绝技：彩满 3 时发动角色绝技句，走与施法同式的最终计分
   * （声韵/骊珠/干扰照常），效果由 bravo.ts ultimateResolve 纯规则给出。
   * 不消耗声气；消耗全部彩；绝技分数不回馈蓄彩；不触发 firstAttack 与施法类遗物。
   */
  castUltimate(rawScore: number, voiceMeta: VoiceResultMeta = {}): ResolvedSkillResult | null {
    const combat = this.state.combat;
    if (
      this.state.phase !== "battle" ||
      !combat ||
      combat.locked ||
      !ultimateEnabled(this.state) ||
      (combat.bravo ?? 0) < 3 ||
      combat.ultimateUsed
    )
      return null;
    const player = this.state.player!;
    const enemy = combat.enemy;

    let bonus = player.voiceMastery + combat.voiceBoost;
    if (this.hasRelic("metronome")) bonus += 5;
    const interference = player.buffs.find((buff) => buff.id === "voice-interference")?.value || 0;
    const score = clamp(Math.round(rawScore + bonus - interference), 0, 100);
    const tier = this.getScoreTier(score);
    const ultimateSkill = ULTIMATE_FOR_CHARACTER[this.state.characterId ?? "man-mou-saang"];
    const plan = ultimateResolve(
      this.state.characterId ?? "man-mou-saang",
      tier.multiplier,
      score,
      voiceMeta.toneScore ?? null
    );

    combat.bravo = 0;
    combat.ultimateUsed = true;
    combat.scoreHistory.push(score);
    this.state.stats!.voiceAttempts += 1;
    this.state.stats!.voiceScoreTotal += score;
    this.state.stats!.bestVoiceScore = Math.max(this.state.stats!.bestVoiceScore, score);

    const messages = [`绝技「${ultimateSkill.name}」：${tier.label} ${score} 分。`];
    let damageDone = 0;
    let healing = 0;

    if (plan.damage > 0) {
      let damage = Math.max(0, plan.damage + player.strength);
      if (enemy.vulnerable > 0) damage = Math.round(damage * 1.25);
      const blocked = plan.bypassArmor ? 0 : Math.min(enemy.armor, damage);
      if (!plan.bypassArmor) enemy.armor -= blocked;
      const actual = Math.max(0, damage - blocked);
      enemy.hp = Math.max(0, enemy.hp - actual);
      damageDone += actual;
      this.state.stats!.damageDealt += actual;
      if (plan.bypassArmor && score >= 85) messages.push("正音绝技，无视护甲。");
    }
    if (plan.heal > 0) healing += this.healPlayer(plan.heal);
    if (plan.armor > 0) player.armor += plan.armor;
    if (plan.clearInterference) {
      const before = player.buffs.length;
      player.buffs = player.buffs.filter((buff) => buff.id !== "voice-interference");
      if (player.buffs.length < before) messages.push("莺声清朗，发音干扰已清除。");
    }
    if (plan.weaknessTurns > 0) {
      enemy.weakness = Math.max(enemy.weakness, plan.weaknessTurns);
      messages.push(`敌人进入虚弱状态 ${plan.weaknessTurns} 回合。`);
    }
    if (plan.stealAllArmor && enemy.armor > 0) {
      const stolen = enemy.armor;
      enemy.armor = 0;
      player.armor += stolen;
      messages.push(`反客为主，夺其 ${stolen} 点护甲。`);
    }
    if (plan.redraw) {
      combat.hand = this.drawHand(combat.handSize ?? 3);
      messages.push("你借势换了一组技能。");
    }
    if (damageDone) messages.push(`造成 ${damageDone} 点伤害。`);
    if (plan.armor) messages.push(`获得 ${plan.armor} 点护甲。`);
    if (healing) messages.push(`回复 ${healing} 点生命。`);

    combat.lastResult = {
      skillId: ultimateSkill.id,
      rawScore,
      score,
      tier,
      damage: damageDone,
      armor: plan.armor,
      healing,
      transcript: voiceMeta.transcript || "",
      confidence: voiceMeta.confidence ?? null,
      similarity: voiceMeta.similarity ?? null,
      source: voiceMeta.source || "unknown"
    };
    // 绝技句置顶为头条（与被动消息同策略；效果明细紧随其后）
    combat.log.unshift(...messages);
    combat.log = combat.log.slice(0, 10);

    if (enemy.hp <= 0) {
      if (combat.bossPhase) combat.bossPhase.pending = false;
      this.finishCombatVictory();
    } else if (
      evolutionEnabled(this.state) &&
      shouldQueuePhase(enemy.id, enemy.hp, enemy.maxHp, combat.bossPhase)
    ) {
      combat.bossPhase!.pending = true;
      combat.log.unshift(
        `绝技把对手打到半血：本回合意图不变，行动结束后进入${BOSS_EVOLUTIONS[enemy.id].phaseName}。`
      );
      combat.log = combat.log.slice(0, 10);
    }
    this.emit({ save: true, effect: damageDone ? "ultimate" : "skill" });
    return combat.lastResult;
  }

  healPlayer(amount: number): number {
    const player = this.state.player!;
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + Math.max(0, amount));
    return player.hp - before;
  }

  applyEnemyHit(amount: number, pierce = false): HitResult {
    const player = this.state.player!;
    const hit = resolveIncomingHit(
      amount,
      {
        armor: player.armor,
        vulnerable: player.buffs.some((buff) => buff.id === "vulnerable"),
        dragonScale: this.hasRelic("dragon-scale")
      },
      pierce
    );
    player.armor = hit.armorAfter;
    player.hp = Math.max(0, player.hp - hit.actual);
    this.state.stats!.damageTaken += hit.actual;
    if (this.state.combat) this.state.combat.damageTaken += hit.actual;
    return { actual: hit.actual, blocked: hit.blocked };
  }

  endTurn(): void {
    if (this.state.phase !== "battle" || !this.state.combat || this.state.combat.locked) return;
    const combat = this.state.combat;
    const player = this.state.player!;
    const enemy = combat.enemy;
    const intent = this.currentIntent()!;
    combat.locked = true;
    const action = evolutionEnabled(this.state)
      ? resolveEnemyAction(intent, enemy.baseAttack, enemy.weakness)
      : null;

    const messages: string[] = [];
    let counterBlocked = 0; // P9：本次敌方行动被护甲挡下的总伤害（穿甲段为 0）
    if (action) {
      let total = 0;
      let blocked = 0;
      for (let i = 0; i < action.hits; i++) {
        const hit = this.applyEnemyHit(action.damage, action.pierce);
        total += hit.actual;
        blocked += hit.blocked;
      }
      counterBlocked = blocked;
      messages.push(
        `${enemy.name}施展「${action.label}」${action.hits ? `，造成 ${total} 点伤害，护甲抵消 ${blocked}${action.pierce ? "（穿甲）" : ""}` : "，本招无伤害"}。`
      );
      if (action.guard) {
        enemy.armor += action.guard;
        messages.push(`敌方护甲 +${action.guard}。`);
      }
      if (action.voicePenalty) {
        player.buffs = player.buffs.filter((buff) => buff.id !== "voice-interference");
        player.buffs.push({
          id: "voice-interference",
          name: action.type === "silence" ? "吞音" : "错调干扰",
          value: action.voicePenalty,
          turns: 1
        });
        messages.push(`下次语音或破阵拍判定 -${action.voicePenalty}。`);
      }
    } else {
      // P5 修复（平衡仿真发现的原版遗留 bug）：「吞音」意图的 amount 是固定伤害值，
      // 原实现误乘 baseAttack（铜钟 9×8=72 点，秒杀满血玩家）。其余意图仍按倍率。
      const rawAttack =
        intent.type === "silence" ? intent.amount || 0 : enemy.baseAttack * (intent.amount || 0);
      const baseAttack = Math.max(1, Math.round(rawAttack));
      const attack = enemy.weakness > 0 ? Math.max(1, Math.round(baseAttack * 0.65)) : baseAttack;

      if (intent.type === "attack") {
        let total = 0;
        let blocked = 0;
        const hits = intent.hits || 1;
        for (let i = 0; i < hits; i += 1) {
          const result = this.applyEnemyHit(attack);
          total += result.actual;
          blocked += result.blocked;
        }
        counterBlocked = blocked;
        messages.push(
          `${enemy.name}施展「${intent.label}」，造成 ${total} 点伤害${blocked ? `，护甲抵消 ${blocked}` : ""}。`
        );
      } else if (intent.type === "guardAttack") {
        const result = this.applyEnemyHit(attack);
        counterBlocked = result.blocked;
        enemy.armor += intent.guard!;
        messages.push(
          `${enemy.name}施展「${intent.label}」，造成 ${result.actual} 点伤害并获得 ${intent.guard} 点护甲。`
        );
      } else if (intent.type === "guard") {
        enemy.armor += intent.guard!;
        messages.push(`${enemy.name}施展「${intent.label}」，获得 ${intent.guard} 点护甲。`);
      } else if (intent.type === "debuff") {
        const penalty = 7 * (intent.amount || 1);
        player.buffs = player.buffs.filter((buff) => buff.id !== "voice-interference");
        player.buffs.push({ id: "voice-interference", name: "错调干扰", value: penalty, turns: 1 });
        messages.push(`${enemy.name}施展「${intent.label}」，下次语音得分 -${penalty}。`);
      } else if (intent.type === "silence") {
        const result = this.applyEnemyHit(attack);
        counterBlocked = result.blocked;
        player.buffs = player.buffs.filter((buff) => buff.id !== "voice-interference");
        player.buffs.push({ id: "voice-interference", name: "吞音", value: 10, turns: 1 });
        messages.push(
          `${enemy.name}施展「${intent.label}」，造成 ${result.actual} 点伤害；下次语音得分 -10。`
        );
      }
    }

    // P9 守势反击：敌方行动完全结算后（含其护甲获取），按被挡总伤害还击；
    // 结算次序在层甲词缀与虚弱/露隙递减之前——还击打在旧护甲上，行动自带的露隙下回合才生效。
    if (counterEnabled(this.state) && combat.counter && counterBlocked > 0) {
      const stance = combat.counter;
      combat.counter = undefined;
      const counterResult = resolveCounterDamage({
        blocked: counterBlocked,
        ratio: stance.ratio,
        enemyArmor: enemy.armor,
        enemyVulnerable: enemy.vulnerable > 0
      });
      const armorAbsorbed = enemy.armor - counterResult.armorAfter;
      enemy.armor = counterResult.armorAfter;
      enemy.hp = Math.max(0, enemy.hp - counterResult.damage);
      this.state.stats!.damageDealt += counterResult.damage;
      // 置顶为本回合头条（与施法块新消息在前一致；敌方行动紧随其后供上下文）
      messages.unshift(
        `反击姿态生效：挡下 ${counterBlocked} 点，还击 ${counterResult.damage} 点伤害${armorAbsorbed > 0 ? `（其护甲挡下 ${armorAbsorbed}）` : ""}。`
      );
      if (enemy.hp <= 0) {
        if (combat.bossPhase) combat.bossPhase.pending = false;
        combat.log.unshift(...messages.reverse());
        combat.log = combat.log.slice(0, 10);
        this.finishCombatVictory();
        return;
      }
      if (
        evolutionEnabled(this.state) &&
        shouldQueuePhase(enemy.id, enemy.hp, enemy.maxHp, combat.bossPhase)
      ) {
        combat.bossPhase!.pending = true;
        messages.push(
          `还击把对手打到半血：本回合行动已结束，进入${BOSS_EVOLUTIONS[enemy.id].phaseName}。`
        );
      }
    }

    const layerArmor = mutationEffects(this.state.challenge?.mutatorIds).armorPerTurn;
    if (layerArmor > 0) {
      enemy.armor += layerArmor;
      messages.push(`层甲词缀：敌人护甲 +${layerArmor}。`);
    }
    if (enemy.weakness > 0) enemy.weakness -= 1;
    if (enemy.vulnerable > 0) enemy.vulnerable -= 1;
    if (action?.selfVulnerable) {
      enemy.vulnerable = Math.max(enemy.vulnerable, action.selfVulnerable);
      messages.push(`敌人露隙 ${action.selfVulnerable} 轮：所受攻击伤害 +25%。`);
    }
    combat.log.unshift(...messages);
    combat.log = combat.log.slice(0, 10);

    if (player.hp <= 0) {
      this.state.phase = "defeat";
      combat.locked = false;
      this.emit({ save: true, effect: "defeat" });
      return;
    }

    combat.turn += 1;
    if (evolutionEnabled(this.state) && combat.bossPhase?.phase === 1 && combat.bossPhase.pending) {
      const phase = BOSS_EVOLUTIONS[enemy.id];
      if (phase) {
        enemy.pattern = clone(phase.pattern);
        combat.bossPhase = { phase: 2, pending: false, startTurn: combat.turn };
        combat.log.unshift(`进入第二阶段「${phase.phaseName}」。下一招为蓄势，无直接伤害。`);
        combat.log = combat.log.slice(0, 10);
      }
    }
    combat.energy = MAX_ENERGY;
    player.armor = 0;
    combat.teaTriggered = false;
    combat.bellTriggered = false;
    combat.lemonTriggered = false;
    if (combat.passives) combat.passives = resetTurnPassives(combat.passives);
    combat.hand = this.drawHand(combat.handSize ?? 3);
    combat.locked = false;
    this.emit({ save: true, effect: "enemy" });
  }

  finishCombatVictory(): void {
    const combat = this.state.combat!;
    const isBoss = combat.kind === "boss";
    const isElite = combat.kind === "elite";
    this.state.stats!.enemiesDefeated += 1;
    if (isElite) this.state.stats!.elitesDefeated += 1;

    // P15 铸剑炉 · 流派遗物：锻造局首胜按（角色 × 幕）确定性授予一件（不入随机池，零稀释）。
    // 槽位 = 角色序号 × 3 +（幕 − 1），mod 6——三角色 × 三幕共九个开局槽位覆盖全部六件。
    if (this.state.forgeVersion === 1 && !this.state.forgeRelicGranted) {
      this.state.forgeRelicGranted = 1;
      const characterIndex = CHARACTERS.findIndex((entry) => entry.id === this.state.characterId);
      const actNo = this.state.campaign?.act ?? 1;
      const slot = (characterIndex >= 0 ? characterIndex : CHARACTERS.length) * 3 + (actNo - 1);
      const relic = FORGE_RELICS[slot % FORGE_RELICS.length];
      if (relic && !this.state.player!.relics.includes(relic.id)) {
        this.state.player!.relics.push(relic.id);
        combat.log.unshift(`铸剑炉授器：获得「${relic.name}」（${relic.school ?? "百搭行头"}）。`);
      }
    }

    // P5 凌云香囊：战斗胜利后回复 5 点生命
    if (this.hasRelic("cloud-herb")) this.healPlayer(5);
    // P5 战役续航：胜利后小额回血（经典/无尽不适用，行为不变）
    if (this.state.campaign) {
      const regen = this.healPlayer(CAMPAIGN_SUSTAIN.victoryRegen);
      if (regen) combat.log.unshift(`凯旋缓气，回复 ${regen} 点生命。`);
    }

    // P2 战役：胜利即评★（无伤 / 平均声韵≥85 / 限时）并清理节点
    const campaign = this.state.campaign;
    if (campaign?.currentNodeId) {
      const history = combat.scoreHistory;
      const averageScore = history.length
        ? Math.round(history.reduce((sum, score) => sum + score, 0) / history.length)
        : 0;
      const breakdown = evaluateCombatStars({
        victory: true,
        kind: combat.kind,
        turns: combat.turn,
        damageTaken: combat.damageTaken,
        averageScore
      });
      this.completeMapNode(campaign.currentNodeId, breakdown.total);
      if (breakdown.total >= 3) this.emit({ save: false, effect: "star" });
    }

    if (isBoss) {
      this.state.phase = "victory";
      this.state.reward = null;
      this.emit({ save: true, effect: "victory" });
      return;
    }

    const gold = this.randomInt(10, 16) + (isElite ? 10 : 0);
    this.state.player!.gold += gold;
    // P5：奖励卡池按幕累计（act 1 = 既有 12 张，行为不变）
    const skillPool = skillsFor(
      this.state.campaign?.act ?? 1,
      this.state.ruleset,
      this.state.counterVersion,
      undefined,
      this.state.lexiconVersion
    );
    const relicPool = relicsUpToAct(this.state.campaign?.act ?? 1);
    const choices = this.pickDistinct(skillPool, 3).map((skill) => skill.id);
    let bonus: RewardBonus | null = null;

    if (isElite) {
      const relic = this.pickDistinct(relicPool, 1, this.state.player!.relics)[0];
      if (relic) {
        this.state.player!.relics.push(relic.id);
        bonus = { type: "relic", id: relic.id };
      }
    } else if (this.random() < 0.35) {
      const item = this.pick(itemsFor(this.state.ruleset));
      this.state.player!.items.push(item.id);
      bonus = { type: "item", id: item.id };
    }

    this.state.reward = { gold, choices, bonus };
    this.state.phase = "reward";
  }

  chooseReward(skillId: string | null = null): void {
    if (this.state.phase !== "reward") return;
    const reward = this.state.reward!;
    if (skillId && reward.choices.includes(skillId)) {
      this.state.player!.deck.push(skillId);
      this.state.stats!.skillsLearned += 1;
      this.state.notice = `学会了「${lookupSkill(skillId)!.name}」。`;
    } else {
      this.state.notice = "你保留现有招式，继续登楼。";
    }
    this.state.reward = null;
    this.state.combat = null;
    this.state.phase = "tower";
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  startEvent(): void {
    this.state.phase = "event";
    const eventPool = eventsFor(
      this.state.campaign?.act ?? 1,
      this.state.ruleset,
      this.state.forgeVersion
    );
    this.state.event = {
      ...clone(this.pick(eventPool)),
      resolved: false,
      outcome: ""
    };
    if (this.hasRelic("jade-token")) {
      this.state.player!.gold += 6;
      this.state.event!.outcome = "街坊玉牌在门前一亮，附近街坊送来 6 两。";
    }
  }

  resolveEvent(choiceId: string): void {
    const event = this.state.event;
    if (this.state.phase !== "event" || !event || event.resolved) return;
    const choice = event.choices.find((entry) => entry.id === choiceId);
    if (!choice) return;

    const player = this.state.player!;
    let outcome = "";
    if (choice.action === "heal") {
      const healed = this.healPlayer(choice.value);
      outcome = `茶气入喉，回复了 ${healed} 点生命。`;
    } else if (choice.action === "buySkill") {
      if (player.gold >= choice.value) {
        player.gold -= choice.value;
        const learned = this.pick(
          skillsFor(
            this.state.campaign?.act ?? 1,
            this.state.ruleset,
            this.state.counterVersion,
            this.state.characterId,
            this.state.lexiconVersion
          )
        );
        player.deck.push(learned.id);
        this.state.stats!.skillsLearned += 1;
        outcome = `你花了 ${choice.value} 两，学会「${learned.name}」。`;
      } else {
        outcome = "钱袋太轻，掌柜只送你一杯清茶。";
        this.healPlayer(4);
      }
    } else if (choice.action === "quizCorrect") {
      player.voiceMastery = Math.min(15, player.voiceMastery + 2);
      outcome = "答对了。永久声韵加成 +2。";
    } else if (choice.action === "quizWrong") {
      player.hp = Math.max(1, player.hp - choice.value);
      outcome = `字墙震出一道回声，你失去 ${choice.value} 点生命。正确意思是“${event.lesson.meaning}”。`;
    } else if (choice.action === "maxHp") {
      player.maxHp += choice.value;
      player.hp += choice.value;
      outcome = `呼吸更稳，最大生命提高 ${choice.value}。`;
    } else if (choice.action === "gold") {
      player.gold += choice.value;
      outcome = `整理完唱片，你获得 ${choice.value} 两。`;
    } else if (choice.action === "relicForHp") {
      player.hp = Math.max(1, player.hp - choice.value);
      const relic = this.pickDistinct(
        relicsUpToAct(this.state.campaign?.act ?? 1),
        1,
        player.relics
      )[0];
      if (relic) {
        player.relics.push(relic.id);
        outcome = `手上磨出血泡，失去 ${choice.value} 点生命；老师傅送你「${relic.name}」。`;
      } else {
        player.gold += 24;
        outcome = "你已集齐这里的旧物，老师傅改送 24 两。";
      }
    } else if (choice.action === "item") {
      const item = this.pick(itemsFor(this.state.ruleset));
      player.items.push(item.id);
      outcome = `雨停时，你在檐角发现「${item.name}」。`;
    } else if (choice.action === "gamble") {
      if (this.random() < 0.5) {
        player.gold += choice.value;
        outcome = `近道尽头藏着钱箱，你获得 ${choice.value} 两。`;
      } else {
        const damage = 11;
        player.hp = Math.max(1, player.hp - damage);
        outcome = `黑巷里机关骤响，你失去 ${damage} 点生命。`;
      }
    }

    event.resolved = true;
    event.outcome = [event.outcome, outcome].filter(Boolean).join(" ");
    this.emit({ save: true });
  }

  leaveEvent(): void {
    if (this.state.phase !== "event" || !this.state.event?.resolved) return;
    this.state.event = null;
    if (this.state.campaign?.currentNodeId) {
      this.completeMapNode(this.state.campaign.currentNodeId, 1);
    }
    this.state.phase = "tower";
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  /** P8-A 歇脚升级事务：全部校验通过才写入，结束节点与回血互斥。 */
  upgradeDeckCard(index: number, expectedId: string): boolean {
    const player = this.state.player;
    if (
      !buildEnabled(this.state) ||
      this.state.phase !== "rest" ||
      !player ||
      player.deck[index] !== expectedId ||
      upgradeReason(player, index)
    )
      return false;
    player.upgradedSlots = [...(player.upgradedSlots ?? []), index];
    this.state.notice = `「${this.getDeckSkill(index)!.name}」磨练完成，只强化这一张牌。`;
    this.finishRest();
    return true;
  }

  /** P8-A 夜市删牌事务：同店仅一次，余额/牌数/最后输出保护。 */
  removeDeckCard(index: number, expectedId: string): boolean {
    const player = this.state.player;
    const shop = this.state.shop;
    if (
      !buildEnabled(this.state) ||
      this.state.phase !== "shop" ||
      !player ||
      !shop ||
      shop.removalUsed ||
      player.deck[index] !== expectedId ||
      removalReason(player, index)
    )
      return false;
    const price = removalPrice(player);
    if (player.gold < price) return false;
    const name = this.getDeckSkill(index)!.name;
    player.gold -= price;
    player.deck.splice(index, 1);
    player.upgradedSlots = upgradesAfterRemoval(player.upgradedSlots ?? [], index);
    player.removedCards = (player.removedCards ?? 0) + 1;
    shop.removalUsed = true;
    this.state.notice = `花费 ${price} 两，移除「${name}」。本店删牌服务已使用。`;
    this.emit({ save: true });
    return true;
  }

  rest(action: string): void {
    if (this.state.phase !== "rest") return;
    const player = this.state.player!;
    if (action === "heal") {
      // P15 街客茶壶：歇脚回复额外 +4（锻造局授予的流派遗物）
      const amount =
        Math.ceil(player.maxHp * REST_HEAL.ratio) + (this.hasRelic("p15-gaa-haak-wo") ? 4 : 0);
      const healed = this.healPlayer(amount);
      this.state.notice = `歇息完毕，回复 ${healed} 点生命。`;
    } else if (action === "practice") {
      player.voiceMastery = Math.min(15, player.voiceMastery + 3);
      this.state.notice = "你对着空楼练声，永久声韵加成 +3。";
    } else if (action === "fortify") {
      player.maxHp += 5;
      player.hp += 5;
      this.state.notice = "调匀气息，最大生命 +5。";
    }
    this.finishRest();
  }

  private finishRest(): void {
    if (this.state.campaign?.currentNodeId) {
      this.completeMapNode(this.state.campaign.currentNodeId, 1);
    }
    this.state.phase = "tower";
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  startShop(): void {
    // P5：夜市卡池按幕累计；夜市贵宾牌全场 -15%
    const discount = this.hasRelic("night-market-vip") ? 0.85 : 1;
    const priceOf = (base: number) => Math.round(base * discount);
    const skillOffers = this.pickDistinct(
      skillsFor(
        this.state.campaign?.act ?? 1,
        this.state.ruleset,
        this.state.counterVersion,
        this.state.characterId,
        this.state.lexiconVersion
      ),
      2
    ).map((skill, index) => ({
      key: `skill-${index}`,
      type: "skill" as const,
      id: skill.id,
      price: priceOf(skill.rarity === "rare" ? 34 : 22),
      sold: false
    }));
    const item = this.pick(itemsFor(this.state.ruleset));
    const relic = this.pickDistinct(
      relicsUpToAct(this.state.campaign?.act ?? 1),
      1,
      this.state.player!.relics
    )[0];
    const offers: ShopOffer[] = [
      ...skillOffers,
      { key: "item-0", type: "item", id: item.id, price: priceOf(18), sold: false }
    ];
    if (relic)
      offers.push({ key: "relic-0", type: "relic", id: relic.id, price: priceOf(52), sold: false });
    this.state.shop = { offers };
    this.state.phase = "shop";
  }

  buyOffer(key: string): void {
    if (this.state.phase !== "shop") return;
    const offer = this.state.shop?.offers.find((entry) => entry.key === key);
    if (!offer || offer.sold) return;
    if (this.state.player!.gold < offer.price) {
      this.state.notice = "银两不足。";
      this.emit({ save: false });
      return;
    }

    this.state.player!.gold -= offer.price;
    offer.sold = true;
    if (offer.type === "skill") {
      this.state.player!.deck.push(offer.id);
      this.state.stats!.skillsLearned += 1;
    } else if (offer.type === "item") {
      this.state.player!.items.push(offer.id);
    } else if (offer.type === "relic") {
      this.state.player!.relics.push(offer.id);
    }
    this.state.notice = "交易完成。";
    this.emit({ save: true });
  }

  leaveShop(): void {
    if (this.state.phase !== "shop") return;
    this.state.shop = null;
    if (this.state.campaign?.currentNodeId) {
      this.completeMapNode(this.state.campaign.currentNodeId, 1);
    }
    this.state.phase = "tower";
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  useItem(index: number): void {
    const player = this.state.player;
    if (!player || !Number.isInteger(index) || index < 0) return;
    const itemId = player.items[index];
    const item = ALL_ITEMS.find((entry) => entry.id === itemId);
    if (!item) return;
    // 新道具必须在未锁定战斗中使用；拒绝时不消耗。
    const tactical = ["armor", "cleanse", "energy", "redraw", "expose"].includes(item.effect);
    if (
      tactical &&
      (this.state.phase !== "battle" || !this.state.combat || this.state.combat.locked)
    ) {
      this.state.notice = "这件战术道具要在战斗出招前使用。";
      this.emit({ save: false });
      return;
    }
    if (item.effect === "energy" && this.state.combat!.energy >= MAX_ENERGY) {
      this.state.notice = "声气已满，道具保留。";
      this.emit({ save: false });
      return;
    }

    if (item.effect === "heal") {
      const healed = this.healPlayer(item.power);
      this.state.notice = `使用「${item.name}」，回复 ${healed} 点生命。`;
    } else if (item.effect === "voiceBoost") {
      if (this.state.phase !== "battle") {
        this.state.notice = "喉糖要在战斗中使用。";
        this.emit({ save: false });
        return;
      }
      this.state.combat!.voiceBoost += item.power;
      this.state.notice = `下一次语音判定 +${item.power}。`;
    } else if (item.effect === "weakenEnemy") {
      if (this.state.phase !== "battle") {
        this.state.notice = "铜锣要在战斗中使用。";
        this.emit({ save: false });
        return;
      }
      this.state.combat!.enemy.weakness = Math.max(this.state.combat!.enemy.weakness, item.power);
      this.state.notice = "锣声扰乱敌人，它的下一轮攻击减弱。";
    }

    if (tactical) {
      const combat = this.state.combat!;
      if (item.effect === "armor") player.armor += item.power;
      if (item.effect === "cleanse") {
        player.buffs = player.buffs.filter(
          (buff) => !["voice-interference", "vulnerable"].includes(buff.id)
        );
        player.armor += item.power;
      }
      if (item.effect === "energy")
        combat.energy = Math.min(MAX_ENERGY, combat.energy + item.power);
      if (item.effect === "redraw") combat.hand = this.drawHand(combat.handSize ?? 3);
      if (item.effect === "expose")
        combat.enemy.vulnerable = Math.max(combat.enemy.vulnerable, item.power);
      this.state.notice = `使用「${item.name}」：${item.description}`;
    }
    player.items.splice(index, 1);
    this.emit({ save: true, effect: "item" });
  }

  getAverageVoiceScore(): number {
    const stats = this.state.stats;
    if (!stats || !stats.voiceAttempts) return 0;
    return Math.round(stats.voiceScoreTotal / stats.voiceAttempts);
  }

  getFloorName(floor: number = this.state.floor): string {
    if (this.state.endless && floor > MAX_FLOOR) return "深塔回廊";
    if (this.state.campaign) {
      // P5：战役楼层名随幕（act 1 = 既有 FLOOR_NAMES + 塔门回退，行为不变）
      const pack = actContent(this.state.campaign.act);
      return pack.floorNames[Math.max(0, floor - 1)] || pack.fallbackName;
    }
    return FLOOR_NAMES[Math.max(0, floor - 1)] || "塔门";
  }

  getRunSummary(): RunSummary {
    return {
      floor: this.state.floor,
      enemies: this.state.stats?.enemiesDefeated || 0,
      elites: this.state.stats?.elitesDefeated || 0,
      averageScore: this.getAverageVoiceScore(),
      bestScore: this.state.stats?.bestVoiceScore || 0,
      damage: this.state.stats?.damageDealt || 0,
      skills: this.state.player?.deck.length || 0
    };
  }
}
