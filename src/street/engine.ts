/** 街坊卡牌引擎：纯状态 + 纯函数（零 DOM），种子随机可复现。 */
import { chapterOf } from "./chapters";
import { CARDS, type CardDef, type Intent, NPCS, type NpcDef, RELICS } from "./data";

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type NodeType = "fight" | "event" | "shop" | "rest" | "boss" | "review" | "school";
export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: NodeType;
  npc?: string;
  next: string[];
}

export const ROWS = 6; // 0..4 普通，5 = Boss

export function genMap(rand: () => number, chapter = 1): MapNode[] {
  const ch = chapterOf(chapter);
  const nodes: MapNode[] = [];
  const rows: MapNode[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const cols = r === 0 ? [1] : r === ROWS - 1 ? [1] : pickCols(rand);
    rows.push(
      cols.map((c) => {
        const type: NodeType = r === ROWS - 1 ? "boss" : r === 0 ? "fight" : rollType(rand, r);
        const node: MapNode = { id: `${r}-${c}`, row: r, col: c, type, next: [] };
        if (type === "fight") node.npc = pickNpc(rand, r, ch.npcsEarly, ch.npcsLate);
        if (type === "boss") node.npc = ch.boss;
        nodes.push(node);
        return node;
      })
    );
  }
  // 第 2 行固定放一个「温习地摊」：把到期要复习的句子拿来打一局
  const rv = [rows[2], rows[1], rows[3]].flat().find((n) => n.type === "fight") ?? rows[2]?.[0];
  if (rv) {
    rv.type = "review";
    rv.npc = undefined;
  }
  // 第 1 行固定放一间「学堂」：本章重点句先温故知新（唔同温习地摊争粒位）
  const sc = rows[1]?.find((n) => n.type === "fight" && n !== rv) ?? rows[1]?.find((n) => n !== rv);
  if (sc) {
    sc.type = "school";
    sc.npc = undefined;
  }
  for (let r = 0; r < ROWS - 1; r++) {
    for (const n of rows[r]) {
      const near = rows[r + 1].filter((m) => Math.abs(m.col - n.col) <= 1);
      n.next = (near.length ? near : rows[r + 1]).map((m) => m.id);
    }
    // 保证下一行每个节点都有来路
    for (const m of rows[r + 1]) {
      if (!rows[r].some((n) => n.next.includes(m.id))) {
        const closest = [...rows[r]].sort(
          (a, b) => Math.abs(a.col - m.col) - Math.abs(b.col - m.col)
        )[0];
        closest.next.push(m.id);
      }
    }
  }
  return nodes;
}

function pickCols(rand: () => number): number[] {
  const opts = [
    [0, 2],
    [0, 1, 2],
    [0, 1],
    [1, 2],
    [0, 1, 2]
  ];
  return opts[Math.floor(rand() * opts.length)];
}
function rollType(rand: () => number, row: number): NodeType {
  const x = rand();
  if (row === 4) return x < 0.55 ? "rest" : "fight";
  if (x < 0.55) return "fight";
  if (x < 0.75) return "event";
  if (x < 0.9) return "shop";
  return "rest";
}
function pickNpc(rand: () => number, row: number, early: string[], late: string[]): string {
  const pool = row >= 3 ? late : early;
  return pool[Math.floor(rand() * pool.length)];
}

export interface Combat {
  npc: string;
  progress: number;
  target: number;
  turn: number;
  energy: number;
  maxEnergy: number;
  block: number;
  draw: string[];
  hand: string[];
  discard: string[];
  intentIndex: number;
  /** 本回合已接住意图 */
  answered: boolean;
  enraged: boolean;
  log: string[];
  crits: number;
  spoken: number;
}

export interface Run {
  seed: number;
  patience: number;
  maxPatience: number;
  gold: number;
  deck: string[];
  relics: string[];
  map: MapNode[];
  at: string | null;
  visited: string[];
  combat: Combat | null;
  graduated: string[];
  counter: number;
  /** 章节（旧存档缺省为 1） */
  chapter?: number;
  /** 熟练度加成：卡 id → 说服/稳住加值（开局时由档案算出） */
  bonus?: Record<string, number>;
}

export function newRun(seed = Date.now() % 1_000_000, chapter = 1): Run {
  const rand = rng(seed);
  const ch = chapterOf(chapter);
  return {
    seed,
    patience: 40,
    maxPatience: 40,
    gold: 30,
    deck: [...ch.starter],
    relics: ["dung"],
    map: genMap(rand, ch.id),
    at: null,
    visited: [],
    combat: null,
    graduated: [],
    counter: 1,
    chapter: ch.id
  };
}

export function nextRand(run: Run): () => number {
  run.counter += 1;
  return rng(run.seed * 7919 + run.counter * 104729);
}

export function reachable(run: Run): string[] {
  if (!run.at) return run.map.filter((n) => n.row === 0).map((n) => n.id);
  return run.map.find((n) => n.id === run.at)?.next ?? [];
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function startCombat(run: Run, npcId: string): Combat {
  const npc = NPCS[npcId];
  const rand = nextRand(run);
  const c: Combat = {
    npc: npcId,
    progress: 0,
    target: npc.target,
    turn: 0,
    energy: 0,
    maxEnergy: 3,
    block: 0,
    draw: shuffle(run.deck, rand),
    hand: [],
    discard: [],
    intentIndex: Math.floor(rand() * npc.intents.length),
    answered: false,
    enraged: false,
    log: [npc.intro],
    crits: 0,
    spoken: 0
  };
  run.combat = c;
  beginTurn(run);
  return c;
}

/** 温习局：手牌 = 到期句子，打这些卡会重置各自的复习计时 */
export function startReview(run: Run, cards: string[]): Combat {
  const c = startCombat(run, "recap");
  c.target = 14 + cards.length * 4;
  c.draw = [];
  c.discard = [];
  c.hand = cards.slice(0, 5);
  return c;
}

function drawCards(run: Run, n: number): void {
  const c = run.combat;
  if (!c) return;
  for (let i = 0; i < n; i++) {
    if (!c.draw.length) {
      if (!c.discard.length) return;
      c.draw = shuffle(c.discard, nextRand(run));
      c.discard = [];
    }
    const card = c.draw.pop();
    if (card) c.hand.push(card);
  }
}

export function beginTurn(run: Run): void {
  const c = run.combat;
  if (!c) return;
  c.turn += 1;
  c.energy = c.maxEnergy + (c.turn === 1 && run.relics.includes("dung") ? 1 : 0);
  c.block = 0;
  c.answered = false;
  drawCards(run, 5);
}

export function currentIntent(run: Run): Intent | null {
  const c = run.combat;
  if (!c) return null;
  const npc = NPCS[c.npc];
  const base = npc.intents[c.intentIndex % npc.intents.length];
  return c.enraged ? { ...base, loss: base.loss + 2 } : base;
}

/** 句子是否含入声 / m 尾，用于密码卡加成（仅看粤拼）。 */
export function hasRusheng(jp: string): boolean {
  return jp.split(/\s+/).some((s) => /[ptk]\d$/.test(s));
}
export function hasMTail(jp: string): boolean {
  // 排除独立鼻音「唔 m4」，只算韵尾 -m（gam3、jam2）
  return jp.split(/\s+/).some((s) => /^[a-z]+m\d$/.test(s));
}

export interface PlayResult {
  ok: boolean;
  reason?: string;
  persuade: number;
  calm: number;
  answered: boolean;
  crit: boolean;
  won: boolean;
}

export function cardPreview(
  run: Run,
  card: CardDef
): { persuade: number; calm: number; answers: boolean } {
  const intent = currentIntent(run);
  let persuade = card.persuade ?? 0;
  let calm = card.calm ?? 0;
  if (persuade && run.relics.includes("rusheng") && hasRusheng(card.jp)) persuade += 2;
  if (calm && run.relics.includes("mtail") && hasMTail(card.jp)) calm += 2;
  if (persuade && run.relics.includes("zorelic") && card.phrase.includes("咗")) persuade += 2;
  if (calm && run.relics.includes("ganrelic") && card.phrase.includes("紧")) calm += 2;
  if (persuade && run.relics.includes("sikfan") && card.phrase.includes("识")) persuade += 2;
  if (calm && run.relics.includes("hoifan") && card.phrase.includes("可")) calm += 2;
  if (calm && run.relics.includes("jan2relic") && card.phrase.includes("因")) calm += 2;
  if (persuade && run.relics.includes("bei2relic") && card.phrase.includes("比")) persuade += 2;
  const mb = run.bonus?.[card.id] ?? 0;
  if (mb && persuade) persuade += mb;
  else if (mb && calm) calm += mb;
  const answers = Boolean(
    intent?.need && card.tags?.includes(intent.need) && !run.combat?.answered
  );
  if (answers) persuade = Math.round(persuade * 1.5);
  return { persuade, calm, answers };
}

/** 打出手牌第 index 张。crit = 开口声调贴合（效果 ×2）。 */
export function playCard(run: Run, index: number, crit: boolean, spoke: boolean): PlayResult {
  const c = run.combat;
  const fail = (reason: string): PlayResult => ({
    ok: false,
    reason,
    persuade: 0,
    calm: 0,
    answered: false,
    crit: false,
    won: false
  });
  if (!c) return fail("冇对话");
  const id = c.hand[index];
  const card = id ? CARDS[id] : undefined;
  if (!card) return fail("冇呢张卡");
  if (card.cost > c.energy) return fail("底气唔够");
  const pv = cardPreview(run, card);
  const mult = crit ? 2 : 1;
  const persuade = pv.persuade * mult;
  const calm = pv.calm * mult;
  c.energy -= card.cost;
  c.progress = Math.min(c.target, c.progress + persuade);
  c.block += calm;
  if (pv.answers) c.answered = true;
  if (card.draw) drawCards(run, card.draw);
  if (card.energy) c.energy += card.energy;
  c.hand.splice(index, 1);
  c.discard.push(id);
  if (crit) c.crits += 1;
  if (spoke) c.spoken += 1;
  const won = c.progress >= c.target;
  return { ok: true, persuade, calm, answered: pv.answers, crit, won };
}

export interface EndTurnResult {
  loss: number;
  answered: boolean;
  lost: boolean;
  enragedNow: boolean;
}

export function endTurn(run: Run): EndTurnResult {
  const c = run.combat;
  if (!c) return { loss: 0, answered: false, lost: false, enragedNow: false };
  const intent = currentIntent(run);
  let loss = 0;
  if (intent && !c.answered) loss = Math.max(0, intent.loss - c.block);
  run.patience = Math.max(0, run.patience - loss);
  c.discard.push(...c.hand);
  c.hand = [];
  let enragedNow = false;
  const npc: NpcDef = NPCS[c.npc];
  if (npc.boss && !c.enraged && c.progress >= c.target / 2) {
    c.enraged = true;
    enragedNow = true;
  }
  const answered = c.answered;
  c.intentIndex = (c.intentIndex + 1 + Math.floor(nextRand(run)() * 2)) % npc.intents.length;
  const lost = run.patience <= 0;
  if (!lost) beginTurn(run);
  return { loss, answered, lost, enragedNow };
}

export function rewardChoices(run: Run, n = 3): string[] {
  const rand = nextRand(run);
  const chapter = run.chapter ?? 1;
  const pool = Object.values(CARDS).filter(
    (c) => c.rarity !== "starter" && (c.chapter ?? 1) <= chapter
  );
  const picks: string[] = [];
  while (picks.length < n && picks.length < pool.length) {
    const weightRare = rand() < 0.18;
    const sub = pool.filter(
      (c) => (weightRare ? c.rarity === "rare" : c.rarity === "common") && !picks.includes(c.id)
    );
    const from = sub.length ? sub : pool.filter((c) => !picks.includes(c.id));
    picks.push(from[Math.floor(rand() * from.length)].id);
  }
  return picks;
}

export function relicOffer(run: Run): string | null {
  const left = Object.keys(RELICS).filter((r) => !run.relics.includes(r));
  if (!left.length) return null;
  return left[Math.floor(nextRand(run)() * left.length)];
}
