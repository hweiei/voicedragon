/**
 * 学堂（quiz）：四种题型 —— 四选一意思、听音选句、砌句、跟读。
 * 题目按「优先复习低熟练度 / 到期卡」从章节卡组里抽，四选一的干扰项来自同章节。
 * 只依赖 CARDS 与传入的随机源，方便测试与页面共用。
 */
import { CARDS } from "./data";

export type Quiz =
  /** 睇句子，拣啱嘅普通话意思 */
  | { type: "mean"; card: string; prompt: string; opts: string[]; right: number }
  /** 听示范音，拣啱嘅句子（opts 为卡 id） */
  | { type: "listen"; card: string; opts: string[]; right: number }
  /** 用词块砌返原句：tokens 系答案次序，tiles 系打乱后嘅展示次序 */
  | { type: "order"; card: string; tokens: string[]; tiles: string[] }
  /** 开口跟读，粤拼声调分 ≥60 算啱 */
  | { type: "speak"; card: string };

/** 砌句题库：词块拼返去要等于「去标点后」嘅原句（构建测试会校验） */
const ORDER_BANK: Record<string, string[]> = {
  // 第一章
  naaicaa: ["我要", "一杯", "冻奶茶"],
  dangzan: ["等阵", "先"],
  pinji: ["算", "便宜啲", "啦"],
  lokce: ["喺呢度", "落车"],
  gaaifong: ["我哋", "系街坊", "嚟㗎"],
  wonggok: ["去", "旺角"],
  mhouji: ["唔好", "意思"],
  sengjat: ["我", "成日", "嚟㗎"],
  // 第二章
  saidin88: ["沙田", "坐", "八十八号车"],
  maangong: ["我未识讲", "唔该你", "慢慢讲"],
  meibaance: ["尾班车", "几时", "走"],
  saamgodis: ["麻烦你", "我哋三个", "去海洋公园"],
  hongloengfan: ["你", "行两分钟", "就去到"],
  jungbatdaatung: ["我", "用", "八达通"],
  mhaiban: ["唔系", "呢班车"],
  gonsigan: ["我", "赶时间", "呀"],
  // 第三章
  zebou6syun1: ["可唔可以", "借阵", "部钻"],
  saiseng: ["细声啲啦", "有人", "瞓紧"],
  gaautin: ["搞掂咗喇", "唔使", "惊"],
  jam2caa4: ["得闲", "饮杯茶", "先啦"],
  bungei: ["部机", "坏咗", "好耐㖎"],
  gaap3cin2: ["大家", "夹啲钱", "整部机啦"]
};

/** 句子去掉标点（跟 ORDER_BANK 校验同一口径） */
export function stripPunct(t: string): string {
  return t.replace(/[，。！？、；：,.!?;:]/g, "");
}

/** 有砌句题库条目的卡 id */
export function orderableIds(pool: string[]): string[] {
  return pool.filter((id) => ORDER_BANK[id]?.length >= 2);
}

/** 某卡的砌句词块（无题库条目时返回 undefined） */
export function orderTokens(id: string): string[] | undefined {
  return ORDER_BANK[id];
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 从 pool 抽 n 张不重复嘅卡（pool 前面嘅优先级高） */
function pickCards(pool: string[], n: number, rand: () => number): string[] {
  return shuffle(pool, rand).slice(0, n);
}

/**
 * 出一铺题：优先低熟练度 / 到期嘅卡（idsByPriority 已排好序）。
 * 题型轮换：先保证有砌句（如果池入面有），再补听音、四选一、跟读。
 */
export function makeQuizSet(poolIds: string[], rand: () => number, n = 3): Quiz[] {
  const pool = poolIds.filter((id) => id in CARDS);
  const cards = pickCards(pool, n, rand);
  const types: Quiz["type"][] = ["listen", "mean", "speak", "order"];
  const out: Quiz[] = [];
  for (const [k, id] of cards.entries()) {
    const canOrder = ORDER_BANK[id]?.length >= 2;
    let type = types[k % types.length];
    if (type === "order" && !canOrder) type = "mean";
    if (k === 0 && canOrder && type !== "order") {
      // 第一题尽量系砌句，令到章首课有「亲手组合」嘅感觉
      const t = type;
      type = "order";
      types[k % types.length] = t;
    }
    if (type === "order") {
      const tokens = ORDER_BANK[id];
      out.push({ type: "order", card: id, tokens, tiles: shuffle(tokens, rand) });
    } else if (type === "speak") {
      out.push({ type: "speak", card: id });
    } else if (type === "listen") {
      const decoys = pickCards(
        pool.filter((x) => x !== id),
        3,
        rand
      );
      const opts = shuffle([id, ...decoys], rand);
      out.push({ type: "listen", card: id, opts, right: opts.indexOf(id) });
    } else {
      const right = CARDS[id].meaning;
      const decoys = pickCards(
        [...new Set(pool.filter((x) => x !== id).map((x) => CARDS[x].meaning))].filter(
          (m) => m !== right
        ),
        3,
        rand
      );
      const opts = shuffle([right, ...decoys], rand);
      out.push({
        type: "mean",
        card: id,
        prompt: CARDS[id].phrase,
        opts,
        right: opts.indexOf(right)
      });
    }
  }
  return out;
}

/** 到期/生疏优先嘅出题池：本章卡按「无记录→到期→等级低」排序 */
export function quizPool(
  chapter: number,
  mastery: Record<string, { xp: number; last: number }>,
  now: number
): string[] {
  const score = (id: string): number => {
    const e = mastery[id];
    if (!e) return 0;
    const idleDays = (now - e.last) / 864e5;
    return 1 + idleDays + (6 - Math.min(5, e.xp / 8));
  };
  return Object.values(CARDS)
    .filter((c) => (c.chapter ?? 1) <= chapter)
    .map((c) => c.id)
    .sort((a, b) => score(b) - score(a));
}

/** 判分：order 传拣选嘅 tiles 下标序列，mean/listen 传选项下标；speak 由调用方判分数 */
export function gradeAnswer(q: Quiz, ans: number | number[]): boolean {
  if (q.type === "mean" || q.type === "listen") return ans === q.right;
  if (q.type === "order") {
    const seq = (ans as number[]).map((i) => q.tiles[i]);
    return seq.length === q.tokens.length && seq.join("") === q.tokens.join("");
  }
  return false;
}
