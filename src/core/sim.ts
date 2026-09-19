import { removalPrice, removalReason, upgradeReason, upgradedSkill } from "./buildcraft";
import { evolutionEnabled, intentAt, resolveEnemyAction } from "./encounters";
/**
 * P5 自动化平衡仿真（核心层，纯函数）：无头引擎 + 两种策略 Bot 蒙特卡洛。
 *
 * 设计（REDESIGN-PLAN §7.7 / §10 P5 验收）：
 * - Bot 只通过 GameEngine 公开指令行动（chooseFloorOption / resolveSkill / endTurn …），
 *   与真人命令流完全同构——仿真即回放，无需 mock；
 * - Bot 决策用独立 mulberry32 流（种子派生），不消耗引擎 LCG——
 *   游戏随机（敌方出招/掉落）与玩家决策互不干扰，同种子必同结果；
 * - 语音得分按 Bot 档位三角分布采样（均值 ± 波幅），叠加玩家自身声韵加成；
 * - 产出：胜率 / 均到达层 / 场均回合 / 战斗场次 / 超时局，供 CI 阈值与调参报表。
 *
 * 参考 Bot（greedy）= 「会玩的普通玩家」：优先补状态、按威胁选卡、不赌；
 * 随机 Bot（random）= 下限玩家：均匀决策。CI 只对 greedy 的胜率带 45–65% 设阈值。
 */

import { type ContentRuleset, lookupSkill } from "./content";
import type { CharacterId } from "./content/roster";
import { counterEnabled } from "./counter";
import type { Skill } from "./data";
import { GameEngine } from "./engine";
import type { GameState } from "./engine";
import { childrenIds, mulberry32, nodeById } from "./levelgen";

export type BotId = "random" | "greedy";

export interface BotProfile {
  id: BotId;
  label: string;
  /** 语音得分均值（三角分布中心） */
  voiceMean: number;
  /** 语音得分半波幅（三角分布 ±） */
  voiceSd: number;
  /** 问答节点答对概率 */
  quizCorrect: number;
}

export const BOTS: Record<BotId, BotProfile> = {
  greedy: {
    id: "greedy",
    label: "贪心（参考玩家）",
    voiceMean: 74,
    voiceSd: 12,
    quizCorrect: 0.75
  },
  random: {
    id: "random",
    label: "随机（下限玩家）",
    voiceMean: 62,
    voiceSd: 16,
    quizCorrect: 0.5
  }
};

export interface SimRunResult {
  win: boolean;
  /** 到达的最高地图行（0–14） */
  floor: number;
  /** 战斗总回合数 */
  turns: number;
  /** 战斗场数 */
  battles: number;
  /** 回合超时保护触发（视为败北） */
  timeout: boolean;
  upgrades?: number;
  removals?: number;
  bossPhases?: number;
  newElites?: number;
  /** P9：实际打出伤害 ≥1 的还击次数（仅 counterVersion 统计）。 */
  counterHits?: number;
  /** P10：名伶一次性被动实际触发次数（亮相/打诨；花旦为逐次判定不计数）。 */
  passiveHits?: number;
}

export interface SimOptions {
  act: number;
  /** 本局种子（决定地图与全部游戏随机） */
  seed: number;
  bot: BotId;
  profile?: Partial<BotProfile>;
  ruleset?: ContentRuleset;
  buildVersion?: 1;
  encounterVersion?: 1;
  counterVersion?: 1;
  rosterVersion?: 1;
  /** P10：角色；仅 rosterVersion=1 生效 */
  character?: CharacterId;
  /** P10：以破阵拍通道施法（丑生「打诨」被动可触发；= 全程无声玩法的乐观界） */
  qteSource?: boolean;
}

const MAX_TURNS_PER_BATTLE = 60;
const MAX_STEPS_PER_RUN = 6000;

/** 三角分布采样（便宜的正态近似）：中心 mean，半波幅 sd。 */
function sampleScore(rng: () => number, mean: number, sd: number): number {
  const unit = rng() + rng() - 1; // [-1, 1] 三角
  return Math.max(0, Math.min(100, Math.round(mean + unit * sd)));
}

/** 敌方下回合意图的预估威胁（对 Bot 而言只是启发式，不偷看内部状态）。 */
function threatScore(state: GameState): number {
  const combat = state.combat!;
  const intent = intentAt(
    combat.enemy.pattern,
    combat.turn,
    evolutionEnabled(state) ? combat.bossPhase : undefined
  );
  if (evolutionEnabled(state)) {
    const action = resolveEnemyAction(intent, combat.enemy.baseAttack, combat.enemy.weakness);
    return action.damage * action.hits;
  }
  const raw =
    state.ruleset === "p7" && intent.type === "silence"
      ? intent.amount || 0
      : combat.enemy.baseAttack * (intent.amount || 0);
  const attack = Math.round(raw) * (intent.hits || 1);
  if (intent.type === "attack" || intent.type === "silence" || intent.type === "guardAttack") {
    return attack;
  }
  return 0; // 纯护甲/纯削弱：威胁低
}

/** 手牌权重：贪心 Bot 的出牌启发式（只看卡面与场面公开信息）。 */
function cardWeight(skill: Skill, state: GameState): number {
  const combat = state.combat!;
  const threat = threatScore(state);
  const hpRatio = state.player!.hp / state.player!.maxHp;
  switch (skill.type) {
    case "attack":
      return skill.power * 1.1 + (skill.id === "dim-gwo-luk-ze" ? 4 : 0);
    case "multi":
      return skill.power * (skill.hits ?? 1) * 1.15;
    case "hybrid":
      return skill.power * (1 + Math.min(1, threat / 20));
    case "guard":
      return skill.power * (threat >= 10 ? 1.6 : 0.6);
    case "heal":
      return hpRatio < 0.55 ? skill.power * 1.8 : skill.power * 0.3;
    case "strength":
      return combat.turn <= 2 ? skill.power * 3 : skill.power * 0.8;
    case "weaken":
      return skill.power + (threat >= 12 ? 4 : 0);
    case "tempo":
      return skill.power * 0.7;
    case "cleanse":
      return skill.power * 0.8;
    default:
      return skill.power;
  }
}

/** P7 扩池策略：护甲足够时不继续盲目叠甲；按费用比较，声势计入多段。 */
function p7CardWeight(skill: Skill, state: GameState): number {
  let weight = cardWeight(skill, state);
  const incoming = threatScore(state);
  const armor = state.player!.armor;
  if (["guard", "cleanse", "tempo"].includes(skill.type) && armor >= incoming) weight *= 0.15;
  if (skill.type === "hybrid" && armor >= incoming) weight = skill.power;
  if (["attack", "multi", "hybrid", "weaken"].includes(skill.type))
    weight += state.player!.strength * (skill.hits ?? 1);
  if (skill.id === "dim-gwo-luk-ze" && state.combat!.enemy.armor > 0) weight += 10;
  let pierceIncoming = false;
  if (evolutionEnabled(state)) {
    const combat = state.combat!;
    const action = resolveEnemyAction(
      intentAt(combat.enemy.pattern, combat.turn, combat.bossPhase),
      combat.enemy.baseAttack,
      combat.enemy.weakness
    );
    pierceIncoming = action.pierce;
    if (action.pierce) {
      if (["guard", "cleanse", "tempo"].includes(skill.type)) weight *= 0.2;
      if (skill.type === "hybrid") weight = skill.power + state.player!.strength;
      if (skill.type === "weaken") weight += 5;
    }
  }
  // P9 反击卡：威胁 ≥10 且非穿甲、当前无姿态时按「护甲 + 预期还击」估值；
  // 姿态已存在或穿甲将至时按普通护甲处理（不重复摆、不给穿甲送分）。
  if (skill.counter && counterEnabled(state)) {
    if (state.combat!.counter) {
      weight = skill.power * 0.3;
    } else if (incoming >= 10 && !pierceIncoming) {
      weight = skill.power + incoming * 0.5;
    } else {
      weight = skill.power * (pierceIncoming ? 0.4 : 0.7);
    }
  }
  return weight / Math.max(1, skill.cost);
}

/** 节点类型基准优先级：贪心 Bot 的登楼启发式（会再按场面动态调整）。 */
const NODE_PRIORITY: Record<string, number> = {
  treasure: 7, // 纯收益，无风险
  quiz: 6, // 无血量风险的评星收益
  battle: 5, // 卡组需要成长
  event: 4,
  shop: 3,
  elite: 2, // 高风险高收益，血线/卡组成型才碰
  rest: 1,
  boss: -1
};

function pickNode(state: GameState, rng: () => number, bot: BotId): string {
  const options = state.floorOptions;
  if (bot === "random") return options[Math.floor(rng() * options.length)].id;
  const player = state.player!;
  const hpRatio = player.hp / player.maxHp;
  const available = new Set(options.map((option) => option.type));
  // 低血优先歇脚；血线充足才碰强敌
  if (hpRatio < 0.45 && available.has("rest")) {
    return options.find((option) => option.type === "rest")!.id;
  }
  // 会读图的玩家：血量吃紧时，朝最近能到的歇脚处方向走（BFS 前瞻）
  if (hpRatio < 0.66 && state.campaign) {
    const map = state.campaign.map;
    let bestRestId: string | null = null;
    let bestHops = Number.POSITIVE_INFINITY;
    for (const option of options) {
      const hops = hopsToType(map, option.id, "rest", 5);
      if (hops < bestHops) {
        bestHops = hops;
        bestRestId = option.id;
      }
    }
    if (bestRestId && bestHops <= 4) return bestRestId;
  }
  let best = options[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const option of options) {
    let score = NODE_PRIORITY[option.type] ?? 0;
    // 卡组成型（≥9 张）后战斗收益递减，转向白拿节点
    if (option.type === "battle" && player.deck.length >= 9) score -= 2;
    if (option.type === "shop" && player.gold < 55) score -= 3;
    if (option.type === "elite") {
      score += hpRatio >= 0.62 && player.deck.length >= 8 ? 3 : -2;
    }
    if (option.type === "rest" && hpRatio > 0.7) score -= 2;
    if (option.type === "boss" && options.length > 1) score -= 1;
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best.id;
}

/** 自某节点向上最少几跳能到指定类型节点（读图前瞻，不进入未知）。 */
function hopsToType(
  map: Parameters<typeof childrenIds>[0],
  fromId: string,
  type: string,
  maxHops: number
): number {
  const queue: Array<[string, number]> = [[fromId, 0]];
  const seen = new Set([fromId]);
  while (queue.length) {
    const [id, depth] = queue.shift()!;
    for (const childId of childrenIds(map, id)) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      const child = nodeById(map, childId);
      if (!child) continue;
      if (child.type === type) return depth + 1;
      if (depth + 1 < maxHops) queue.push([childId, depth + 1]);
    }
  }
  return Number.POSITIVE_INFINITY;
}

function pickEventChoice(state: GameState, rng: () => number, bot: BotId): string {
  const choices = state.event!.choices;
  if (bot === "random") return choices[Math.floor(rng() * choices.length)].id;
  const hpRatio = state.player!.hp / state.player!.maxHp;
  const rank = (action: string): number => {
    switch (action) {
      case "heal":
        return hpRatio < 0.6 ? 9 : 5;
      case "maxHp":
        return 6;
      case "gold":
        return 5;
      case "item":
        return 4;
      case "quizCorrect":
        return 3;
      case "buySkill":
        return state.player!.gold >= 12 ? 4 : 1;
      case "relicForHp":
        return hpRatio >= 0.7 ? 5 : 0;
      case "gamble":
        return 1;
      default:
        return 2;
    }
  };
  let best = choices[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const choice of choices) {
    const score = rank(choice.action);
    if (score > bestScore) {
      bestScore = score;
      best = choice;
    }
  }
  return best.id;
}

/** 无头跑完整局战役（不含组合根包装：无存档、无自适应难度注入）。 */
export function simulateCampaign(options: SimOptions): SimRunResult {
  const profile = { ...BOTS[options.bot], ...options.profile };
  const engine = new GameEngine();
  engine.startCampaign({
    act: options.act,
    seed: options.seed,
    ruleset: options.ruleset,
    buildVersion: options.buildVersion,
    encounterVersion: options.encounterVersion,
    counterVersion: options.counterVersion,
    rosterVersion: options.rosterVersion,
    character: options.character
  });
  // Bot 决策流独立于引擎 LCG：同种子下游戏随机与决策随机都可复现
  const rng = mulberry32((options.seed ^ 0x5eed_b07 ^ (options.act * 0x85eb_ca6b)) >>> 0);

  let turns = 0;
  let battles = 0;
  let timeout = false;
  let steps = 0;
  let maxFloor = 0;
  const state = engine.state;
  let upgrades = 0;
  let removals = 0;
  let bossPhases = 0;
  let newElites = 0;
  let counterHits = 0;
  let passiveHits = 0;
  const finish = (result: SimRunResult): SimRunResult => ({
    ...result,
    ...(options.buildVersion === 1 ? { upgrades, removals } : {}),
    ...(options.encounterVersion === 1 ? { bossPhases, newElites } : {}),
    ...(options.counterVersion === 1 ? { counterHits } : {}),
    ...(options.rosterVersion === 1 ? { passiveHits } : {})
  });

  while (steps < MAX_STEPS_PER_RUN) {
    steps += 1;
    maxFloor = Math.max(maxFloor, state.floor);
    if (state.phase === "victory")
      return finish({ win: true, floor: maxFloor, turns, battles, timeout });
    if (state.phase === "defeat")
      return finish({ win: false, floor: maxFloor, turns, battles, timeout });
    if (state.phase === "tower") {
      engine.chooseFloorOption(pickNode(state, rng, options.bot));
      continue;
    }
    if (state.phase === "battle") {
      battles += 1;
      let battleTurns = 0;
      let observedPhase = false;
      if (state.combat!.enemy.id.startsWith("p8b-")) newElites++;
      while (state.phase === "battle" && battleTurns < MAX_TURNS_PER_BATTLE) {
        steps += 1;
        if (state.combat!.bossPhase?.phase === 2 && !observedPhase) {
          bossPhases++;
          observedPhase = true;
        }
        // 战斗内道具：低血先回血
        const healItem = state.player!.items.indexOf("herbal-tea");
        if (healItem >= 0 && state.player!.hp / state.player!.maxHp < 0.4) {
          engine.useItem(healItem);
          continue;
        }
        // 贪心会用道具：开局喉糖提分；重击将至先敲锣减压
        if (options.bot === "greedy" && battleTurns === 0) {
          const candy = state.player!.items.indexOf("throat-candy");
          if (candy >= 0) {
            engine.useItem(candy);
            continue;
          }
        }
        if (options.bot === "greedy" && threatScore(state) >= 16) {
          const gong = state.player!.items.indexOf("small-gong");
          if (gong >= 0) {
            engine.useItem(gong);
            continue;
          }
        }
        // P7 新道具要有策略消费者，不能把不会使用道具的旧 Bot 当真人调平衡。
        if (options.ruleset === "p7" && options.bot === "greedy") {
          const player = state.player!;
          const combat = state.combat!;
          const tactical = player.items.findIndex((id) => {
            if (id === "p7-bamboo-shield") return threatScore(state) > player.armor;
            if (id === "p7-salt-rinse")
              return player.buffs.some((buff) =>
                ["voice-interference", "vulnerable"].includes(buff.id)
              );
            if (id === "p7-ginger-shot") return combat.energy <= 1;
            if (id === "p7-crack-bell") return combat.enemy.vulnerable === 0 && combat.energy >= 2;
            if (id === "p7-fan")
              return (
                combat.energy > 0 &&
                !combat.hand.some((card) => engine.canUseSkill(card.id, card.index))
              );
            return false;
          });
          if (tactical >= 0) {
            engine.useItem(tactical);
            continue;
          }
        }
        // 出牌：贪心按权重降序；随机打乱
        const hand = [...state.combat!.hand];
        if (options.bot === "greedy") {
          hand.sort((a, b) => {
            const weight = options.ruleset === "p7" ? p7CardWeight : cardWeight;
            return (
              weight(engine.getDeckSkill(b.index)!, state) -
              weight(engine.getDeckSkill(a.index)!, state)
            );
          });
        } else {
          for (let i = hand.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [hand[i], hand[j]] = [hand[j], hand[i]];
          }
        }
        let cast = false;
        for (const card of hand) {
          const skill = engine.getDeckSkill(card.index)!;
          if (!engine.canUseSkill(skill.id, card.index)) continue;
          // P10 统计：一次性被动标记新增 = 本次施法触发亮相/打诨（只看公开状态）
          const flagsBefore = Object.keys(state.combat?.passives ?? {}).length;
          engine.resolveSkill(
            skill.id,
            sampleScore(rng, profile.voiceMean, profile.voiceSd),
            {
              source: options.qteSource ? "qte" : "sim"
            },
            card.index
          );
          if (Object.keys(state.combat?.passives ?? {}).length > flagsBefore) passiveHits += 1;
          cast = true;
          break; // 每次循环最多出一张，重估场面
        }
        if (state.phase !== "battle") break; // 已分胜负
        if (!cast || state.combat!.energy <= 0) {
          // P9 统计：姿态存在且行动后消失 = 本次还击实际打出（只看公开状态，不偷看内部）
          const stanceBefore = Boolean(state.combat?.counter);
          engine.endTurn();
          if (stanceBefore && !state.combat?.counter) counterHits += 1;
          battleTurns += 1;
          turns += 1;
        }
      }
      if (state.phase === "battle") {
        // 超时保护：视为败北（真实玩家不会 60 回合不倒）
        timeout = true;
        return finish({ win: false, floor: maxFloor, turns, battles, timeout });
      }
      continue;
    }
    if (state.phase === "reward") {
      const choices = state.reward!.choices;
      if (options.bot === "random") {
        engine.chooseReward(rng() < 0.5 ? choices[Math.floor(rng() * choices.length)] : null);
      } else {
        let best: string | null = null;
        let bestScore = 0;
        for (const id of choices) {
          const skill = lookupSkill(id)!;
          // P9：反击卡按「护甲 + 预期还击」估值（参考玩家视角，不偷看内部状态）
          const score =
            skill.counter && counterEnabled(state)
              ? (skill.power + 6) / skill.cost
              : (skill.power *
                  (skill.hits ?? 1) *
                  (skill.type === "attack" || skill.type === "multi" ? 1.1 : 0.9)) /
                skill.cost;
          if (score > bestScore) {
            bestScore = score;
            best = id;
          }
        }
        engine.chooseReward(best);
      }
      continue;
    }
    if (state.phase === "event") {
      if (!state.event!.resolved) engine.resolveEvent(pickEventChoice(state, rng, options.bot));
      else engine.leaveEvent();
      continue;
    }
    if (state.phase === "rest") {
      if (
        options.buildVersion === 1 &&
        options.bot === "greedy" &&
        state.player!.hp / state.player!.maxHp >= 0.65 &&
        state.player!.voiceMastery >= 6
      ) {
        const candidate = state
          .player!.deck.map((id, index) => ({ id, index }))
          .filter((card) => !upgradeReason(state.player!, card.index))
          .sort((a, b) => {
            const value = (index: number) => {
              const skill = engine.getDeckSkill(index)!;
              const next = upgradedSkill(skill)!;
              return (
                ((next.power - skill.power) *
                  (skill.hits ??
                    (skill.type === "strength" ? 3 : skill.type === "hybrid" ? 2 : 1))) /
                skill.cost
              );
            };
            return value(b.index) - value(a.index);
          })[0];
        if (candidate && engine.upgradeDeckCard(candidate.index, candidate.id)) {
          upgrades++;
          continue;
        }
      }
      const hpRatio = state.player!.hp / state.player!.maxHp;
      const action =
        options.bot === "random"
          ? (["heal", "practice", "fortify"] as const)[Math.floor(rng() * 3)]
          : hpRatio < 0.65
            ? "heal"
            : "practice";
      engine.rest(action);
      continue;
    }
    if (state.phase === "shop") {
      const player = state.player!;
      if (
        options.buildVersion === 1 &&
        options.bot === "greedy" &&
        !state.shop!.removalUsed &&
        player.deck.length >= 9 &&
        player.gold >= removalPrice(player) + 30
      ) {
        const candidate = player.deck
          .map((id, index) => ({ id, index }))
          .filter(
            (card) =>
              !removalReason(player, card.index) &&
              !player.upgradedSlots?.includes(card.index) &&
              player.deck.filter((id) => id === card.id).length > 1
          )
          .sort((a, b) => {
            const value = (id: string) => {
              const skill = lookupSkill(id)!;
              return (
                (skill.power * (skill.hits ?? 1)) / skill.cost -
                player.deck.filter((entry) => entry === id).length
              );
            };
            return value(a.id) - value(b.id);
          })[0];
        if (candidate && engine.removeDeckCard(candidate.index, candidate.id)) {
          removals++;
          continue;
        }
      }
      const offers = state.shop!.offers.filter((offer) => !offer.sold);
      if (options.bot === "random") {
        if (rng() < 0.3) {
          const affordable = offers.filter((offer) => offer.price <= state.player!.gold - 10);
          if (affordable.length) {
            engine.buyOffer(affordable[Math.floor(rng() * affordable.length)].key);
            continue;
          }
        }
      } else {
        // 先看遗物（长期收益），再补最贵买得起的技能
        const relic = offers.find(
          (offer) => offer.type === "relic" && offer.price <= state.player!.gold - 20
        );
        if (relic) {
          engine.buyOffer(relic.key);
          continue;
        }
        const skills = offers
          .filter((offer) => offer.type === "skill" && offer.price <= state.player!.gold - 25)
          .sort((a, b) => b.price - a.price);
        if (skills.length) {
          engine.buyOffer(skills[0].key);
          continue;
        }
      }
      engine.leaveShop();
      continue;
    }
    if (state.phase === "quiz") {
      const quiz = state.quiz!;
      if (quiz.selected === null) {
        const question = quiz.questions[quiz.index];
        const correct = rng() < profile.quizCorrect;
        let answer = question.answerIndex;
        if (!correct) {
          const wrong = question.options.map((_, index) => index).filter((i) => i !== answer);
          answer = wrong[Math.floor(rng() * wrong.length)];
        }
        engine.answerQuizOption(answer);
      } else {
        engine.advanceQuiz();
      }
      continue;
    }
    // 未知相：安全退出
    return finish({ win: false, floor: maxFloor, turns, battles, timeout });
  }
  return finish({ win: false, floor: maxFloor, turns, battles, timeout });
}

export interface SimSummary {
  act: number;
  bot: BotId;
  label: string;
  runs: number;
  wins: number;
  winRate: number;
  avgFloor: number;
  avgTurnsPerBattle: number;
  avgBattles: number;
  timeouts: number;
  upgrades?: number;
  removals?: number;
  bossPhases?: number;
  newElites?: number;
  counterHits?: number;
  passiveHits?: number;
}

/** 幕级蒙特卡洛：种子流 = hash(baseSeed, act, runIndex)，全确定性可复现。 */
export function simulateAct(options: {
  act: number;
  bot: BotId;
  runs: number;
  baseSeed?: number;
  profile?: Partial<BotProfile>;
  ruleset?: ContentRuleset;
  buildVersion?: 1;
  encounterVersion?: 1;
  counterVersion?: 1;
  rosterVersion?: 1;
  character?: CharacterId;
  qteSource?: boolean;
}): SimSummary {
  const { act, bot, runs } = options;
  const baseSeed = options.baseSeed ?? 0x2026_0919;
  const profile = { ...BOTS[bot], ...options.profile };
  let wins = 0;
  let floorSum = 0;
  let turnsSum = 0;
  let battlesSum = 0;
  let timeouts = 0;
  let upgrades = 0;
  let removals = 0;
  let bossPhases = 0;
  let newElites = 0;
  let counterHits = 0;
  let passiveHits = 0;
  for (let index = 0; index < runs; index += 1) {
    const seed = (baseSeed + act * 0x1b873593 + index * 0x9e3779b9) >>> 0;
    const result = simulateCampaign({
      act,
      seed,
      bot,
      profile: options.profile,
      ruleset: options.ruleset,
      buildVersion: options.buildVersion,
      encounterVersion: options.encounterVersion,
      counterVersion: options.counterVersion,
      rosterVersion: options.rosterVersion,
      character: options.character,
      qteSource: options.qteSource
    });
    if (result.win) wins += 1;
    floorSum += result.floor;
    turnsSum += result.turns;
    battlesSum += result.battles;
    if (result.timeout) timeouts += 1;
    upgrades += result.upgrades ?? 0;
    removals += result.removals ?? 0;
    bossPhases += result.bossPhases ?? 0;
    newElites += result.newElites ?? 0;
    counterHits += result.counterHits ?? 0;
    passiveHits += result.passiveHits ?? 0;
  }
  return {
    act,
    bot,
    label: profile.label,
    runs,
    wins,
    winRate: wins / runs,
    avgFloor: floorSum / runs,
    avgTurnsPerBattle: battlesSum ? turnsSum / battlesSum : 0,
    avgBattles: battlesSum / runs,
    timeouts,
    ...(options.buildVersion === 1 ? { upgrades, removals } : {}),
    ...(options.encounterVersion === 1 ? { bossPhases, newElites } : {}),
    ...(options.counterVersion === 1 ? { counterHits } : {}),
    ...(options.rosterVersion === 1 ? { passiveHits } : {})
  };
}
