/**
 * 数值平衡模拟器：机器人按「能接招先接招，其余出最高说服/费比」的策略跑整局。
 * 用来离线评估胜率区间（目标 35%–55%），不参与运行时逻辑。
 */
import { CARDS } from "./data";
import {
  type Run,
  cardPreview,
  currentIntent,
  endTurn,
  newRun,
  playCard,
  reachable,
  rewardChoices,
  rng,
  startCombat
} from "./engine";

export interface SimResult {
  won: boolean;
  battles: number;
  turns: number;
  patienceLeft: number;
  deck: number;
}

/** skill = 0..1：听对街坊意图（接招）嘅概率，模拟玩家水平 */
export interface BotOpts {
  skill: number;
  rand: () => number;
}

/** 机器人打完一场对话；返回是否打赢、是否力竭 */
function botCombat(run: Run, bot: BotOpts): { won: boolean; alive: boolean } {
  let guard = 0;
  for (;;) {
    if (++guard > 60) return { won: false, alive: false };
    const c = run.combat;
    if (!c) return { won: false, alive: true };
    // 本回合出牌：skill 低 = 成日拣啱嘢（乱出），唔单止接唔住招
    for (;;) {
      const intent = currentIntent(run);
      const playable: number[] = [];
      for (let i = 0; i < c.hand.length; i++) {
        const card = CARDS[c.hand[i]];
        if (card && card.cost <= c.energy) playable.push(i);
      }
      if (!playable.length) break;
      let pick = -1;
      if (bot.rand() < 1 - bot.skill * 0.85) {
        pick = playable[Math.floor(bot.rand() * playable.length)];
      } else {
        let best = -1;
        for (const i of playable) {
          const card = CARDS[c.hand[i]];
          const pv = cardPreview(run, card);
          const score =
            (pv.answers && intent?.need ? 1000 : 0) + (pv.persuade * 2 + pv.calm) / (card.cost + 1);
          if (score > best) {
            best = score;
            pick = i;
          }
        }
      }
      if (pick < 0) break;
      const res = playCard(run, pick, false, false);
      if (!res.ok) break;
      if (res.won) return { won: true, alive: true };
    }
    const r = endTurn(run);
    if (r.lost || run.patience <= 0) return { won: false, alive: false };
  }
}

/** 跑一整局：地图按「第一个可达节点」走，赢了 Boss 即通关 */
export function simRun(seed: number, chapter = 1, skill = 0.5): SimResult {
  const run = newRun(seed, chapter);
  const bot: BotOpts = { skill, rand: rng(seed * 3 + 7) };
  let battles = 0;
  let turns = 0;
  for (;;) {
    const can = reachable(run);
    if (!can.length) break;
    const opts = can.map((id) => run.map.find((n) => n.id === id)).filter(Boolean) as NonNullable<
      ReturnType<typeof run.map.find>
    >[];
    // 行街要真打：优先战斗，其次 Boss 前排；学堂/温习/店铺行路而过
    const node =
      opts.find((n) => n.type === "fight") ?? opts.find((n) => n.type === "boss") ?? opts[0];
    if (!node) break;
    run.at = node.id;
    run.visited.push(node.id);
    if (node.type === "fight" || node.type === "boss") {
      startCombat(run, node.npc ?? "auntie");
      battles += 1;
      let guard = 0;
      let won = false;
      while (run.combat && ++guard < 40) {
        turns += 1;
        const out = botCombat(run, bot);
        if (!out.alive)
          return { won: false, battles, turns, patienceLeft: run.patience, deck: run.deck.length };
        if (out.won) {
          won = true;
          run.combat = null;
          break;
        }
        run.combat = null;
        break;
      }
      if (node.type === "boss")
        return { won, battles, turns, patienceLeft: run.patience, deck: run.deck.length };
      if (won) {
        const pick = rewardChoices(run, 3)[0];
        if (pick) run.deck.push(pick);
      }
    } else if (node.type === "rest") {
      run.patience = Math.min(run.maxPatience, run.patience + 12);
    } else if (node.type === "shop") {
      run.gold += 0; // 机器人唔识买嘢：忽略
    } else if (node.type === "review") {
      // 新档无熟练度记录 → 温习地摊冇嘢温，同 UI 一样回耐 +6
      run.patience = Math.min(run.maxPatience, run.patience + 6);
    } else if (node.type === "school") {
      // 学堂：机器人按 skill 答啱（全对先有奖，简化为唔影响状态）
    }
  }
  return { won: false, battles, turns, patienceLeft: run.patience, deck: run.deck.length };
}

/** 批量模拟：返回胜率与简单分布 */
export function simChapter(chapter: number, games: number, seed0 = 1, skill = 0.5) {
  let wins = 0;
  let turns = 0;
  let patience = 0;
  for (let i = 0; i < games; i++) {
    const r = simRun(seed0 + i * 7919, chapter, skill);
    if (r.won) {
      wins += 1;
      turns += r.turns;
      patience += r.patienceLeft;
    }
  }
  return {
    winRate: wins / games,
    avgTurnsOnWin: wins ? Math.round(turns / wins) : 0,
    avgPatienceOnWin: wins ? Math.round(patience / wins) : 0
  };
}
