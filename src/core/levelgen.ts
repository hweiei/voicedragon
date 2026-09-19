/**
 * P2 闯关战役：分支地图生成器（核心层，纯函数）。
 *
 * 形状约束（STS 式 7×15 不规则网格，由 validateActMap 守护、契约测试直接复用）：
 * - 种子确定：同一种子必得同一张图（mulberry32 独立流，与引擎 LCG 互不干扰）；
 * - 首行起点 ≥ 2；Boss 顶点唯一且位于最后一行；
 * - 边只连相邻两行（下层 → 上层最近 3 列内的 1~2 个节点），任意两边不交叉；
 * - 除起点外每个节点至少一条入边，且全部节点自起点可达（生成即保证，另设防御性校验）；
 * - 类型分布：前 4 行不出强敌；倒数 3 行不设宝箱/问答（纯收益节点）。
 *
 * 同文件附：前线推进（availableNodeIds）与节点 ★ 评价规则（evaluateCombatStars），
 * 均为纯函数，70% 的 P2 玩法决策在 Vitest 里无头验证。
 */

import { ACT_MAP, STAR_THRESHOLDS } from "./config/balance";

export type MapNodeType =
  | "battle"
  | "event"
  | "rest"
  | "shop"
  | "elite"
  | "boss"
  | "treasure"
  | "quiz";

export interface ActNode {
  id: string;
  row: number;
  col: number;
  type: MapNodeType;
}

export interface ActEdge {
  from: string;
  to: string;
}

export interface ActMap {
  act: number;
  seed: number;
  rows: number;
  cols: number;
  nodes: ActNode[];
  edges: ActEdge[];
  startIds: string[];
  bossId: string;
}

// ─── 确定性随机流 ─────────────────────────────────────────────────────────────

/** mulberry32：体积小、周期够用的种子 PRNG（地图流与战斗流独立）。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffled<T>(rng: () => number, list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── 骨架：层格 → 连边 → 类型 ─────────────────────────────────────────────────

function buildSkeleton(rng: () => number): ActNode[][] {
  const { rows, cols, minStarts, maxStarts, minRowNodes, maxRowNodes } = ACT_MAP;
  const grid: ActNode[][] = [];
  for (let row = 0; row < rows; row += 1) {
    let count: number;
    let colPool: number[];
    if (row === rows - 1) {
      // Boss 顶点：独占一行，且不出现在最边列（观感与可达性）
      count = 1;
      colPool = [1, 2, 3, 4, 5];
    } else if (row === 0) {
      count = randInt(rng, minStarts, maxStarts);
      colPool = Array.from({ length: cols }, (_, col) => col);
    } else {
      count = randInt(rng, minRowNodes, maxRowNodes);
      colPool = Array.from({ length: cols }, (_, col) => col);
    }
    const chosen = shuffled(rng, colPool)
      .slice(0, count)
      .sort((a, b) => a - b);
    grid.push(
      chosen.map((col) => ({
        id: `r${row}c${col}`,
        row,
        col,
        type: "battle" as MapNodeType
      }))
    );
  }
  return grid;
}

function edgesCross(aCol: number, bCol: number, cCol: number, dCol: number): boolean {
  return (aCol - cCol) * (bCol - dCol) < 0;
}

function connectRows(rng: () => number, grid: ActNode[][]): ActEdge[] | null {
  const edges: ActEdge[] = [];
  const lastRow = grid.length - 1;

  for (let row = 0; row < lastRow; row += 1) {
    const sources = grid[row];
    const targets = grid[row + 1];
    const spanEdges: ActEdge[] = [];

    if (row === lastRow - 1) {
      // 顶点前一行：全部连向 Boss（单一汇点，不可能交叉）
      for (const source of sources) spanEdges.push({ from: source.id, to: targets[0].id });
      edges.push(...spanEdges);
      continue;
    }

    // 贪心连边：源从左到右，目标按列距排序尝试，拒绝交叉。
    for (const source of [...sources].sort((a, b) => a.col - b.col)) {
      const degree = rng() < 0.55 ? 1 : 2;
      const candidates = [...targets].sort(
        (a, b) => Math.abs(a.col - source.col) - Math.abs(b.col - source.col) || a.col - b.col
      );
      let made = 0;
      for (const target of candidates.slice(0, 3)) {
        if (made >= degree) break;
        const crosses = spanEdges.some((edge) => {
          const from = sources.find((node) => node.id === edge.from)!;
          const to = targets.find((node) => node.id === edge.to)!;
          return edgesCross(from.col, to.col, source.col, target.col);
        });
        if (crosses) continue;
        spanEdges.push({ from: source.id, to: target.id });
        made += 1;
      }
      if (made === 0) return null; // 极罕见：整段重roll
    }

    // 孤儿修复：保证上一层每个节点至少一条入边
    for (const target of targets) {
      if (spanEdges.some((edge) => edge.to === target.id)) continue;
      const candidates = [...sources].sort(
        (a, b) => Math.abs(a.col - target.col) - Math.abs(b.col - target.col) || a.col - b.col
      );
      let fixed = false;
      for (const source of candidates) {
        const crosses = spanEdges.some((edge) => {
          const from = sources.find((node) => node.id === edge.from)!;
          const to = targets.find((node) => node.id === edge.to)!;
          return edgesCross(from.col, to.col, source.col, target.col);
        });
        if (crosses) continue;
        spanEdges.push({ from: source.id, to: target.id });
        fixed = true;
        break;
      }
      if (!fixed) return null;
    }

    edges.push(...spanEdges);
  }
  return edges;
}

function assignTypes(rng: () => number, grid: ActNode[][]): void {
  const rows = grid.length;
  const bossRow = rows - 1;
  const prizeMaxRow = rows - ACT_MAP.prizeFreeRows - 1; // 倒数 3 行禁宝箱/问答
  grid[bossRow][0].type = "boss";

  const flat = grid.flat().filter((node) => node.type === "battle");
  const pool = shuffled(rng, flat);
  const take = (predicate: (node: ActNode) => boolean, count: number, type: MapNodeType) => {
    let placed = 0;
    for (const node of pool) {
      if (placed >= count) break;
      if (node.type !== "battle" || !predicate(node)) continue;
      node.type = type;
      placed += 1;
    }
    return placed;
  };

  // 关键节点先占坑（配额即最低保障；位置随机但类型规则由 validateActMap 守护）
  take((n) => n.row >= ACT_MAP.noEliteRows && n.row <= bossRow - 1, randInt(rng, 3, 5), "elite");
  take((n) => n.row >= 2 && n.row <= prizeMaxRow, randInt(rng, 2, 3), "treasure");
  take((n) => n.row >= 2 && n.row <= prizeMaxRow, randInt(rng, 2, 3), "quiz");
  take((n) => n.row >= 2 && n.row <= prizeMaxRow, 2, "shop");
  // P5：歇脚配额 3→4（15 行地图约 10+ 场战斗，3 处续航不足——平衡仿真结论）
  take((n) => n.row >= 1 && n.row <= bossRow - 1, 4, "rest");
  take((n) => n.row >= 1 && n.row <= bossRow - 1, randInt(rng, 3, 4), "event");
  // 其余保持 battle（首行因此必为战斗热身）
}

// ─── 生成入口与校验 ───────────────────────────────────────────────────────────

/**
 * 生成第一幕地图。尝试次数有界（形状/配额失败则换派生种子重roll），
 * 产物必过 validateActMap，调用方拿到的永远是合法图。
 */
export function generateActMap(seed: number, act = 1): ActMap {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const derived = (seed + attempt * 0x9e3779b9) >>> 0;
    const rng = mulberry32(derived);
    const grid = buildSkeleton(rng);
    const edges = connectRows(rng, grid);
    if (!edges) continue;
    assignTypes(rng, grid);
    const nodes = grid.flat();
    const map: ActMap = {
      act,
      seed,
      rows: ACT_MAP.rows,
      cols: ACT_MAP.cols,
      nodes,
      edges,
      startIds: grid[0].map((node) => node.id),
      bossId: grid[grid.length - 1][0].id
    };
    if (validateActMap(map).length === 0) return map;
  }
  throw new Error(`无法在种子 ${seed} 下生成合法战役地图`);
}

/** 形状与类型约束校验：返回违规描述列表（空数组 = 合法）。契约测试直接复用。 */
export function validateActMap(map: ActMap): string[] {
  const problems: string[] = [];
  const byId = new Map(map.nodes.map((node) => [node.id, node]));

  const starts = map.nodes.filter((node) => node.row === 0);
  if (starts.length < ACT_MAP.minStarts) problems.push(`起点不足 ${ACT_MAP.minStarts} 个`);
  if (starts.map((n) => n.id).join() !== [...map.startIds].sort().join()) {
    // startIds 应与首行一致（顺序无关）
    if (new Set(starts.map((n) => n.id)).size !== new Set(map.startIds).size) {
      problems.push("startIds 与首行节点不一致");
    }
  }

  const bosses = map.nodes.filter((node) => node.type === "boss");
  if (bosses.length !== 1) problems.push("Boss 节点不唯一");
  if (bosses[0] && bosses[0].row !== map.rows - 1) problems.push("Boss 不在顶点行");
  if (map.bossId !== bosses[0]?.id) problems.push("bossId 指向错误");

  const rowOf = new Map<number, number>();
  for (const node of map.nodes) rowOf.set(node.row, (rowOf.get(node.row) ?? 0) + 1);
  if (rowOf.get(map.rows - 1) !== 1) problems.push("顶点行应有且仅有一个节点");

  // 边：端点存在、相邻行、自下而上
  for (const edge of map.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      problems.push(`边 ${edge.from}→${edge.to} 端点缺失`);
      continue;
    }
    if (to.row !== from.row + 1) problems.push(`边 ${edge.from}→${edge.to} 跨行或反向`);
  }

  // 同一段层间任意两边不交叉
  for (let i = 0; i < map.edges.length; i += 1) {
    for (let j = i + 1; j < map.edges.length; j += 1) {
      const a = byId.get(map.edges[i].from)!;
      const b = byId.get(map.edges[i].to)!;
      const c = byId.get(map.edges[j].from)!;
      const d = byId.get(map.edges[j].to)!;
      if (a.row !== c.row) continue;
      if (edgesCross(a.col, b.col, c.col, d.col)) {
        problems.push(`边交叉：${a.id}→${b.id} 与 ${c.id}→${d.id}`);
      }
    }
  }

  // 入边与可达性
  const incoming = new Map<string, number>();
  for (const edge of map.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  for (const node of map.nodes) {
    if (node.row === 0) continue;
    if (!incoming.get(node.id)) problems.push(`节点 ${node.id} 无入边`);
  }
  const adjacency = new Map<string, string[]>();
  for (const edge of map.edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  }
  const seen = new Set<string>(map.startIds);
  const queue = [...map.startIds];
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of adjacency.get(id) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  for (const node of map.nodes) {
    if (!seen.has(node.id)) problems.push(`节点 ${node.id} 自起点不可达`);
  }

  // 类型分布
  const prizeMaxRow = map.rows - ACT_MAP.prizeFreeRows - 1;
  for (const node of map.nodes) {
    if (node.type === "elite" && node.row < ACT_MAP.noEliteRows) {
      problems.push(`强敌 ${node.id} 出现在前 ${ACT_MAP.noEliteRows} 行`);
    }
    if ((node.type === "treasure" || node.type === "quiz") && node.row > prizeMaxRow) {
      problems.push(`纯收益节点 ${node.id} 出现在倒数 ${ACT_MAP.prizeFreeRows} 行`);
    }
  }
  const countOf = (type: MapNodeType) => map.nodes.filter((n) => n.type === type).length;
  if (countOf("elite") < 3) problems.push("强敌不足 3 个");
  if (countOf("treasure") < 2) problems.push("宝箱不足 2 个");
  if (countOf("quiz") < 2) problems.push("问答不足 2 个");
  if (countOf("shop") < 2) problems.push("夜市不足 2 个");
  if (countOf("rest") < 3) problems.push("歇脚处不足 3 个");
  if (countOf("event") < 3) problems.push("奇遇不足 3 个");
  if (countOf("battle") < 10) problems.push("战斗节点过少（发展性不足）");

  return problems;
}

// ─── 前线推进 ─────────────────────────────────────────────────────────────────

export function nodeById(map: ActMap, id: string): ActNode | undefined {
  return map.nodes.find((node) => node.id === id);
}

export function childrenIds(map: ActMap, id: string): string[] {
  return map.edges.filter((edge) => edge.from === id).map((edge) => edge.to);
}

export function parentIds(map: ActMap, id: string): string[] {
  return map.edges.filter((edge) => edge.to === id).map((edge) => edge.from);
}

/**
 * 当前可到达（可选）节点：未清理 + 至少一个父节点已清理；未开局时为首行起点。
 * 该接口同时驱动 UI 高亮与引擎指令校验。
 */
export function availableNodeIds(map: ActMap, clearedIds: Iterable<string>): string[] {
  const cleared = clearedIds instanceof Set ? clearedIds : new Set(clearedIds);
  if (cleared.size === 0) return [...map.startIds];
  return map.nodes
    .filter((node) => !cleared.has(node.id))
    .filter((node) => parentIds(map, node.id).some((parent) => cleared.has(parent)))
    .map((node) => node.id);
}

// ─── 节点 ★ 评价（政府评分制） ────────────────────────────────────────────────

export interface CombatStarInput {
  victory: boolean;
  kind: "battle" | "elite" | "boss";
  /** 战斗总回合数 */
  turns: number;
  /** 本场战斗实际受到的生命伤害（护甲抵消不计） */
  damageTaken: number;
  /** 本场平均声韵（无语音判定时为 0） */
  averageScore: number;
}

export interface CombatStarBreakdown {
  total: number;
  noHit: boolean;
  voice: boolean;
  swift: boolean;
}

/** 战斗★评价：无伤 ★、平均声韵 ≥85 ★、限时内 ★。败北一律 0 星。 */
export function evaluateCombatStars(input: CombatStarInput): CombatStarBreakdown {
  if (!input.victory) return { total: 0, noHit: false, voice: false, swift: false };
  const noHit = input.damageTaken <= 0;
  const voice = input.averageScore >= STAR_THRESHOLDS.voiceAvg;
  const swift = input.turns <= STAR_THRESHOLDS.turnLimits[input.kind];
  return { total: (noHit ? 1 : 0) + (voice ? 1 : 0) + (swift ? 1 : 0), noHit, voice, swift };
}

/** 问答★评价：答对题数即星数（上限 3）。 */
export function starsForQuiz(correctCount: number): number {
  return Math.max(0, Math.min(3, correctCount));
}
