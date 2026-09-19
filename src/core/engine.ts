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

import {
  ACT_DIFFICULTY_TARGET,
  CAMPAIGN_SUSTAIN,
  DIFFICULTY_CURVE,
  MAX_ENERGY,
  QUIZ_PER_NODE,
  REST_HEAL,
  TREASURE
} from "./config/balance";
import { ACT_COUNT, actContent, lookupSkill, relicsUpToAct, skillsUpToAct } from "./content";
import { FLOOR_NAMES, ITEMS, MAX_FLOOR, QUIZ_QUESTIONS, clone } from "./data";
import type { EnemyBlueprint, EnemyIntent, GameEventContent, QuizQuestion, Skill } from "./data";
import { availableNodeIds, evaluateCombatStars, generateActMap, nodeById } from "./levelgen";
import type { ActMap, MapNodeType } from "./levelgen";

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
}

/** P4 自适应难度注入点（组合根接 profile / 设置；默认 0，行为与原版一致）。 */
export type AdaptiveProvider = () => number;

export interface IntentPreview {
  label: string;
  detail: string;
  type: string;
}

export interface HitResult {
  actual: number;
  blocked: number;
}

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

  createRunState(seed: number = makeSeed()): GameState {
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
      adaptiveBoost: this.adaptiveProvider()
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
  startCampaign(act = 1, seed: number = makeSeed()): void {
    const pack = actContent(act);
    const actNo = pack.act;
    // P5 修复：种子同时驱动地图与战斗 LCG——同 (act, seed) 必得同局（可复现/回放的基石）
    this.state = this.createRunState(seed);
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
    campaign.act = nextAct;
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
    this.state.notice = `${pack.notice}（塔间小憩：回复 ${rested} 点生命。）`;
    this.prepareFloorOptions();
    this.emit({ save: true });
  }

  /** P4 无尽塔：无终点的单段爬楼，楼层无限延伸（5 的倍数为强敌关，永不出现 Boss）。 */
  startEndless(seed?: number): void {
    this.state = this.createRunState(seed);
    this.state.endless = true;
    this.state.maxFloor = Number.MAX_SAFE_INTEGER;
    this.state.notice = "无尽塔开楼：没有天台，只有下一层。";
    this.prepareFloorOptions();
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
      const item = this.pick(ITEMS);
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
  startQuiz(nodeId: string): void {
    const questions = this.pickDistinct(QUIZ_QUESTIONS, QUIZ_PER_NODE);
    this.state.quiz = { nodeId, questions, index: 0, correct: 0, selected: null };
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
    const scaleFloor = campaign
      ? 1 +
        (this.state.floor / Math.max(1, campaign.map.rows - 1)) *
          ((ACT_DIFFICULTY_TARGET[campaign.act] ?? MAX_FLOOR) - 1)
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
      blueprint = this.pick(pack.elites);
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
    return enemy.pattern[(turn - 1) % enemy.pattern.length];
  }

  getIntentPreview(): IntentPreview | null {
    const intent = this.currentIntent();
    const combat = this.state.combat;
    if (!intent || !combat) return null;
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
        type: "attack"
      };
    }
    if (intent.type === "guardAttack") {
      return {
        label: intent.label,
        detail: `${adjusted} 伤害 / ${intent.guard} 护甲`,
        type: "mixed"
      };
    }
    if (intent.type === "guard") {
      return { label: intent.label, detail: `${intent.guard} 护甲`, type: "guard" };
    }
    if (intent.type === "silence") {
      return { label: intent.label, detail: `${adjusted} 伤害 / 扰乱发音`, type: "debuff" };
    }
    return { label: intent.label, detail: "施加发音干扰", type: "debuff" };
  }

  canUseSkill(skillId: string): boolean {
    const skill = lookupSkill(skillId);
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
    if (score >= 40) return { key: "learning", label: "入门", multiplier: 0.78 };
    return { key: "shaky", label: "未稳", multiplier: 0.52 };
  }

  resolveSkill(
    skillId: string,
    rawScore: number,
    voiceMeta: VoiceResultMeta = {}
  ): ResolvedSkillResult | null {
    if (!this.canUseSkill(skillId)) return null;
    const skill = lookupSkill(skillId) as Skill;
    const combat = this.state.combat!;
    const player = this.state.player!;

    let bonus = player.voiceMastery + combat.voiceBoost;
    if (this.hasRelic("metronome")) bonus += 5;
    const interference = player.buffs.find((buff) => buff.id === "voice-interference")?.value || 0;
    const score = clamp(Math.round(rawScore + bonus - interference), 0, 100);
    combat.voiceBoost = 0;
    player.buffs = player.buffs.filter((buff) => buff.id !== "voice-interference");

    const tier = this.getScoreTier(score);
    combat.energy -= skill.cost;
    combat.scoreHistory.push(score);
    this.state.stats!.voiceAttempts += 1;
    this.state.stats!.voiceScoreTotal += score;
    this.state.stats!.bestVoiceScore = Math.max(this.state.stats!.bestVoiceScore, score);

    const scaledPower = Math.max(1, Math.round(skill.power * tier.multiplier));
    const messages = [`你说出「${skill.phrase}」：${tier.label} ${score} 分。`];
    let damageDone = 0;
    let armorGained = 0;
    let healing = 0;

    const dealDamage = (base: number, options: { bypassArmor?: boolean } = {}): number => {
      let damage = Math.max(0, base + player.strength);
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

    if (skill.type === "attack") {
      const bypass = skill.id === "dim-gwo-luk-ze" && score >= 65;
      dealDamage(scaledPower, { bypassArmor: bypass });
      if (skill.id === "ding-ngang-soeng" && score >= 85) gainArmor(3);
    } else if (skill.type === "multi") {
      for (let i = 0; i < (skill.hits ?? 1); i += 1) dealDamage(scaledPower);
    } else if (skill.type === "guard") {
      gainArmor(scaledPower + (score >= 65 && skill.id === "m-sai-geng" ? 2 : 0));
      if (skill.id === "dak-haan-jam-caa") healing += this.healPlayer(3);
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
      healing += this.healPlayer(scaledPower);
      gainArmor(5);
    } else if (skill.type === "weaken") {
      dealDamage(scaledPower);
      combat.enemy.weakness = Math.max(combat.enemy.weakness, 2);
      messages.push("敌人进入虚弱状态 2 回合。");
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

    if (combat.enemy.hp <= 0) {
      this.finishCombatVictory();
    }
    this.emit({ save: true, effect: damageDone ? "hit" : "skill" });
    return combat.lastResult;
  }

  healPlayer(amount: number): number {
    const player = this.state.player!;
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + Math.max(0, amount));
    return player.hp - before;
  }

  applyEnemyHit(amount: number): HitResult {
    const player = this.state.player!;
    let damage = amount;
    const vulnerable = player.buffs.find((buff) => buff.id === "vulnerable");
    if (vulnerable) damage = Math.round(damage * 1.25);
    // P5 龙鳞音甲：无甲受击时先张出 3 点鳞甲（每次被击破后可再次触发）
    if (this.hasRelic("dragon-scale") && player.armor <= 0) player.armor = 3;
    const blocked = Math.min(player.armor, damage);
    player.armor -= blocked;
    const actual = Math.max(0, damage - blocked);
    player.hp = Math.max(0, player.hp - actual);
    this.state.stats!.damageTaken += actual;
    if (this.state.combat) this.state.combat.damageTaken += actual;
    return { actual, blocked };
  }

  endTurn(): void {
    if (this.state.phase !== "battle" || !this.state.combat || this.state.combat.locked) return;
    const combat = this.state.combat;
    const player = this.state.player!;
    const enemy = combat.enemy;
    const intent = this.currentIntent()!;
    combat.locked = true;

    const messages: string[] = [];
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
      messages.push(
        `${enemy.name}施展「${intent.label}」，造成 ${total} 点伤害${blocked ? `，护甲抵消 ${blocked}` : ""}。`
      );
    } else if (intent.type === "guardAttack") {
      const result = this.applyEnemyHit(attack);
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
      player.buffs = player.buffs.filter((buff) => buff.id !== "voice-interference");
      player.buffs.push({ id: "voice-interference", name: "吞音", value: 10, turns: 1 });
      messages.push(
        `${enemy.name}施展「${intent.label}」，造成 ${result.actual} 点伤害；下次语音得分 -10。`
      );
    }

    if (enemy.weakness > 0) enemy.weakness -= 1;
    if (enemy.vulnerable > 0) enemy.vulnerable -= 1;
    combat.log.unshift(...messages);
    combat.log = combat.log.slice(0, 10);

    if (player.hp <= 0) {
      this.state.phase = "defeat";
      combat.locked = false;
      this.emit({ save: true, effect: "defeat" });
      return;
    }

    combat.turn += 1;
    combat.energy = MAX_ENERGY;
    player.armor = 0;
    combat.teaTriggered = false;
    combat.bellTriggered = false;
    combat.lemonTriggered = false;
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
    const skillPool = skillsUpToAct(this.state.campaign?.act ?? 1);
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
      const item = this.pick(ITEMS);
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
    const eventPool = actContent(this.state.campaign?.act ?? 1).events;
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
        const learned = this.pick(skillsUpToAct(this.state.campaign?.act ?? 1));
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
      const item = this.pick(ITEMS);
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

  rest(action: string): void {
    if (this.state.phase !== "rest") return;
    const player = this.state.player!;
    if (action === "heal") {
      const amount = Math.ceil(player.maxHp * REST_HEAL.ratio);
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
    const skillOffers = this.pickDistinct(skillsUpToAct(this.state.campaign?.act ?? 1), 2).map(
      (skill, index) => ({
        key: `skill-${index}`,
        type: "skill" as const,
        id: skill.id,
        price: priceOf(skill.rarity === "rare" ? 34 : 22),
        sold: false
      })
    );
    const item = this.pick(ITEMS);
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
    const player = this.state.player!;
    const itemId = player.items[index];
    const item = ITEMS.find((entry) => entry.id === itemId);
    if (!item) return;

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
