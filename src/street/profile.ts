/** 跨局档案：图鉴、街坊录、设置。只存聚合数据，不存录音。 */
import { CHAPTERS } from "./chapters";
import { CARDS, NPCS } from "./data";
import type { MasteryEntry } from "./mastery";

export interface Settings {
  /** 听力挑战：街坊台词先隐藏，听完 / 点一下先显示 */
  listen: boolean;
  /** 示范语速 */
  rate: number;
  /** 出牌时自动读一次卡面 */
  autoSpeak: boolean;
}

export interface Profile {
  /** 2：新增熟练度与章节进度（v1 自动迁移） */
  version: 2;
  runs: number;
  wins: number;
  /** 见过（拥有过）的卡 */
  seen: string[];
  /** 每张卡最好的声调分 */
  best: Record<string, number>;
  /** 开口次数 */
  spoken: number;
  met: string[];
  /** 每位街坊被说服次数 */
  beaten: Record<string, number>;
  settings: Settings;
  /** 每句熟练度 */
  mastery: Record<string, MasteryEntry>;
  /** 已通关章节 */
  cleared: number[];
}

const KEY = "street-profile-v1";

export function freshProfile(): Profile {
  return {
    version: 2,
    runs: 0,
    wins: 0,
    seen: [],
    best: {},
    spoken: 0,
    met: [],
    beaten: {},
    settings: { listen: false, rate: 0.9, autoSpeak: true },
    mastery: {},
    cleared: []
  };
}

/** 严格白名单恢复：未知卡 / 街坊 / 非法数值一律丢弃。 */
export function restoreProfile(raw: unknown): Profile {
  const p = freshProfile();
  if (!raw || typeof raw !== "object") return p;
  const r = raw as Partial<Profile>;
  const n = (v: unknown, max = 1e6) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0;
  p.runs = n(r.runs);
  p.wins = Math.min(p.runs, n(r.wins));
  p.spoken = n(r.spoken);
  p.seen = Array.isArray(r.seen)
    ? [...new Set(r.seen.filter((id) => typeof id === "string" && id in CARDS))]
    : [];
  p.met = Array.isArray(r.met)
    ? [...new Set(r.met.filter((id) => typeof id === "string" && id in NPCS))]
    : [];
  for (const [id, v] of Object.entries(r.best ?? {})) if (id in CARDS) p.best[id] = n(v, 100);
  for (const [id, v] of Object.entries(r.beaten ?? {})) if (id in NPCS) p.beaten[id] = n(v);
  const now = Date.now();
  if (r.mastery && typeof r.mastery === "object") {
    for (const [id, e] of Object.entries(r.mastery)) {
      if (!(id in CARDS) || !e || typeof e !== "object") continue;
      const xp = (e as MasteryEntry).xp;
      const last = (e as MasteryEntry).last;
      if (typeof xp !== "number" || !Number.isFinite(xp) || xp < 0) continue;
      if (typeof last !== "number" || !Number.isFinite(last) || last <= 0) continue;
      p.mastery[id] = { xp: Math.min(60, Math.floor(xp)), last: Math.min(last, now) };
    }
  }
  const ids = new Set(CHAPTERS.map((c) => c.id));
  p.cleared = Array.isArray(r.cleared)
    ? [...new Set(r.cleared.filter((c): c is number => typeof c === "number" && ids.has(c)))]
    : [];
  // v1 迁移：通关过 Boss 的旧档，视为第 1 章已通关
  if (p.wins > 0 && !p.cleared.includes(1)) p.cleared.push(1);
  const s = r.settings;
  if (s && typeof s === "object") {
    p.settings.listen = s.listen === true;
    p.settings.autoSpeak = s.autoSpeak !== false;
    if (typeof s.rate === "number" && s.rate >= 0.6 && s.rate <= 1.2) p.settings.rate = s.rate;
  }
  return p;
}

export function loadProfile(): Profile {
  try {
    return restoreProfile(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return freshProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 隐私模式等写入失败时静默 */
  }
}

export function noteCards(p: Profile, ids: string[]): void {
  for (const id of ids) if (!p.seen.includes(id)) p.seen.push(id);
}

export function noteScore(p: Profile, id: string, score: number | null): void {
  p.spoken += 1;
  if (score !== null) p.best[id] = Math.max(p.best[id] ?? 0, Math.round(score));
}
