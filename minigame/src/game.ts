/**
 * 声震龙楼 · 小游戏版主循环。
 * 规则 / 数据 / 档案校验 / 声调评分全部复用网页版（src/street、src/core），这里只负责画面与交互。
 */
import { PitchTracker } from "../../src/adapters/voice/pitch-tracker";
import { scoreToneContour } from "../../src/core/tone";
import { CHAPTERS, chapterUnlocked } from "../../src/street/chapters";
import { CARDS, type CardDef, EVENTS, NPCS, RELICS } from "../../src/street/data";
import {
  type Run,
  cardPreview,
  currentIntent,
  endTurn,
  newRun,
  nextRand,
  playCard,
  reachable,
  relicOffer,
  rewardChoices,
  startCombat,
  startReview
} from "../../src/street/engine";
import {
  LEVEL_NAMES,
  type MasteryEvent,
  applyDecay,
  bonusTable,
  dueCards,
  gainXp,
  levelBonus,
  levelOf
} from "../../src/street/mastery";
import {
  type Profile,
  freshProfile,
  noteCards,
  noteScore,
  restoreProfile
} from "../../src/street/profile";
import { type Quiz, gradeAnswer, makeQuizSet, quizPool } from "../../src/street/school";
import { audioPath } from "./audio-manifest";
import { C, MONO, Painter } from "./draw";
import type { Platform } from "./platform";

type Screen =
  | "home"
  | "map"
  | "battle"
  | "reward"
  | "shop"
  | "rest"
  | "event"
  | "win"
  | "lose"
  | "codex"
  | "npcs"
  | "settings"
  | "chapters"
  | "school";

const RUN_KEY = "street-run-v1";
const PROF_KEY = "street-profile-v1";
const REMOVE_PRICE = 50;
const RELIC_PRICE = 60;
const HOME_CAST = ["auntie", "boss", "waiter"] as const;

interface State {
  screen: Screen;
  run: Run | null;
  sel: number | null;
  reward: string[];
  rewardGold: number;
  adUsed: boolean;
  revived: boolean;
  shop: {
    cards: string[];
    relic: string | null;
    bought: string[];
    removing: boolean;
    removed: boolean;
  };
  event: { idx: number; card?: string };
  recording: boolean;
  lastScore: number | null;
  talk: { id: string; until: number } | null;
  float: { text: string; color: string; t0: number } | null;
  busy: boolean;
  /** 听力挑战：本回合台词是否已揭开 */
  revealed: boolean;
  codexPage: number;
  /** 本场对话里升级的句子 */
  levelUps: { id: string; lv: number }[];
  /** 学堂答题状态 */
  school: SchoolState | null;
}

interface SchoolState {
  /** lesson = 章首课（开局前）；node = 地图学堂节点 */
  mode: "lesson" | "node";
  quiz: Quiz[];
  idx: number;
  right: number;
  /** 砌句题：已拣嘅词块下标 */
  selTok: number[];
  fb: { ok: boolean; txt: string } | null;
}

export function startGame(p: Platform): void {
  const g = new Painter(p);
  const W = p.width;
  const H = p.height;
  const top = p.safeTop;
  let prof: Profile = loadProfile();
  let tracker: PitchTracker | null = null;
  let recStart = 0;
  let holding = false;
  let recMode: "battle" | "school" = "battle";
  let downRegion: string | null = null;

  const s: State = {
    screen: "home",
    run: null,
    sel: null,
    reward: [],
    rewardGold: 0,
    adUsed: false,
    revived: false,
    shop: { cards: [], relic: null, bought: [], removing: false, removed: false },
    event: { idx: 0 },
    recording: false,
    lastScore: null,
    talk: null,
    float: null,
    busy: false,
    revealed: false,
    codexPage: 0,
    levelUps: [],
    school: null
  };
  applyDecay(prof.mastery, Date.now());
  saveProf();

  /* ---------- 存档 ---------- */
  function loadProfile(): Profile {
    try {
      return restoreProfile(JSON.parse(p.getItem(PROF_KEY) ?? "null"));
    } catch {
      return freshProfile();
    }
  }
  function saveProf(): void {
    p.setItem(PROF_KEY, JSON.stringify(prof));
  }
  function saveRun(): void {
    if (!s.run || s.screen === "win" || s.screen === "lose") {
      p.setItem(RUN_KEY, "");
      return;
    }
    // 士多 / 奇遇状态一并存档，刷新不能重复刷
    p.setItem(
      RUN_KEY,
      JSON.stringify({
        run: s.run,
        screen: s.screen,
        shop: s.shop,
        event: s.event,
        reward: s.reward
      })
    );
  }
  function loadRun(): boolean {
    try {
      const raw = JSON.parse(p.getItem(RUN_KEY) ?? "null");
      if (!raw?.run?.map || !Array.isArray(raw.run.deck)) return false;
      if (!raw.run.deck.every((id: unknown) => typeof id === "string" && id in CARDS)) return false;
      s.run = raw.run as Run;
      s.screen = (["map", "battle", "reward", "shop", "rest", "event"] as Screen[]).includes(
        raw.screen
      )
        ? raw.screen
        : "map";
      if (raw.shop) s.shop = raw.shop;
      if (raw.event) s.event = raw.event;
      if (Array.isArray(raw.reward)) s.reward = raw.reward.filter((id: string) => id in CARDS);
      if (s.screen === "battle" && !s.run.combat) s.screen = "map";
      return true;
    } catch {
      return false;
    }
  }
  const hasSave = () => Boolean(p.getItem(RUN_KEY));

  /* ---------- 声音 ---------- */
  function hear(key: string): void {
    const path = audioPath(key);
    if (!path || !p.playAudio(path, prof.settings.rate)) p.toast("示范录音制作中，先睇粤拼跟读");
  }
  function cardKey(id: string) {
    return `c-${id}`;
  }
  function intentKey(npc: string, idx: number) {
    return `n-${npc}-${idx % NPCS[npc].intents.length}`;
  }

  /* ---------- 通用部件 ---------- */
  const KIND = {
    persuade: { label: "说服", color: C.pink },
    calm: { label: "稳住", color: C.cyan },
    skill: { label: "技巧", color: C.violet }
  };
  function effectText(c: CardDef, pv?: { persuade: number; calm: number }): string {
    const out: string[] = [];
    const per = pv?.persuade ?? c.persuade;
    const calm = pv?.calm ?? c.calm;
    if (per) out.push(`说服 +${per}`);
    if (calm) out.push(`稳住 ${calm}`);
    if (c.draw) out.push(`抽 ${c.draw} 张`);
    if (c.energy) out.push(`底气 +${c.energy}`);
    return out.join(" ");
  }

  function drawCard(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    o: {
      sel?: boolean;
      poor?: boolean;
      answers?: boolean;
      price?: number;
      eff?: string;
      act?: string;
      idx?: number;
    } = {}
  ): void {
    const c = CARDS[id];
    const k = KIND[c.kind];
    const border = o.answers ? C.ok : o.sel ? C.amber : C.line;
    if (o.sel) g.glow(C.amber, 16, () => g.rr(x, y, w, h, 10, C.panel));
    g.rr(x, y, w, h, 10, o.answers ? "#12301f" : C.panel, border, o.sel || o.answers ? 2 : 1);
    g.text(k.label, x + 8, y + 16, { size: 11, color: k.color, weight: "bold" });
    const lv = levelOf(prof.mastery[id]?.xp ?? 0);
    for (let i = 0; i < 5; i++) {
      g.ctx.beginPath();
      g.ctx.arc(x + w - 8 - (4 - i) * 7, y + 12, 2.6, 0, Math.PI * 2);
      g.ctx.fillStyle = i < lv ? C.amber : "#343a66";
      g.ctx.fill();
    }
    // 费用徽章
    g.ctx.beginPath();
    g.ctx.arc(x + 4, y + 4, 11, 0, Math.PI * 2);
    g.ctx.fillStyle = C.amber;
    g.ctx.fill();
    g.text(String(c.cost), x + 4, y + 9, {
      size: 13,
      weight: "bold",
      color: C.ink,
      align: "center"
    });
    const ph = g.wrap(c.phrase, x + 8, y + 36, w - 14, 19, { size: 16, weight: "bold" }, 2);
    const jpLines = Math.max(1, Math.floor((h - 30 - (40 + ph)) / 12));
    g.wrap(c.jp, x + 8, y + 40 + ph, w - 12, 12, { size: 10, color: C.pink, font: MONO }, jpLines);
    g.ctx.fillStyle = C.line;
    g.ctx.fillRect(x + 8, y + h - 26, w - 16, 1);
    g.text(o.eff ?? effectText(c), x + 8, y + h - 10, { size: 11, color: C.text });
    if (o.answers)
      g.text("✓", x + w - 8, y + h - 10, { size: 13, color: C.ok, align: "right", weight: "bold" });
    if (o.poor) g.rr(x, y, w, h, 10, "rgba(11,13,26,.55)");
    if (o.price !== undefined) {
      g.rr(x + w / 2 - 22, y + h - 9, 44, 18, 9, C.amber);
      g.text(`$${o.price}`, x + w / 2, y + h + 4, {
        size: 12,
        weight: "bold",
        color: C.ink,
        align: "center"
      });
    }
    if (o.act) g.region(x, y, w, h, o.act, o.idx !== undefined ? String(o.idx) : id);
  }

  /** 卡牌网格：返回占用高度 */
  function cardGrid(
    ids: string[],
    y: number,
    act: string,
    extra?: (id: string) => { price?: number }
  ): number {
    const cols = 3;
    const gap = 10;
    const cw = Math.min(104, (W - 32 - gap * (cols - 1)) / cols);
    const ch = cw * 1.32;
    const rows = Math.ceil(ids.length / cols);
    ids.forEach((id, i) => {
      const r = Math.floor(i / cols);
      const inRow = Math.min(cols, ids.length - r * cols);
      const x0 = (W - (inRow * cw + (inRow - 1) * gap)) / 2;
      drawCard(id, x0 + (i % cols) * (cw + gap), y + r * (ch + 18), cw, ch, {
        act,
        ...(extra?.(id) ?? {})
      });
    });
    return rows * (ch + 18);
  }

  function hud(run: Run): number {
    const y = top;
    g.text(`♥ 耐心 ${run.patience}/${run.maxPatience}`, 14, y + 16, {
      size: 14,
      color: C.pink,
      weight: "bold"
    });
    g.text(`$ 港纸 ${run.gold}`, W / 2, y + 16, {
      size: 14,
      color: C.amber,
      weight: "bold",
      align: "center"
    });
    g.text(`卡组 ${run.deck.length}`, W - 14, y + 16, {
      size: 14,
      color: C.cyan,
      weight: "bold",
      align: "right"
    });
    let x = 14;
    for (const r of run.relics) {
      const def = RELICS[r];
      if (!def) continue;
      g.rr(x, y + 26, 26, 26, 6, "rgba(155,123,255,.15)", C.violet);
      g.text(def.glyph, x + 13, y + 44, {
        size: 13,
        color: C.violet,
        align: "center",
        weight: "bold"
      });
      g.region(x, y + 26, 26, 26, "relic", r);
      x += 32;
    }
    return y + 60;
  }

  function title(t: string, y: number, color: string): void {
    g.text(t, W / 2, y, { size: 20, weight: "bold", color, align: "center" });
  }

  /* ---------- 各屏 ---------- */
  function homeScreen(t: number): void {
    const heroH = Math.round(Math.min(H * (H < 720 ? 0.33 : 0.4), W * 0.78));
    g.cover(p.loadImage("street/bg/cafe.jpg"), 0, 0, W, heroH);
    g.vfade(0, heroH * 0.45, W, heroH * 0.55 + 1, "rgba(11,13,26,0)", C.bg);
    // 品牌
    g.glow(C.pink, 12, () => g.rr(14, top, 38, 38, 9, "rgba(11,13,26,.6)", C.pink, 2));
    g.text("龍", 33, top + 27, { size: 22, weight: "900", color: C.pink, align: "center" });
    g.text("声震龙楼", 60, top + 18, { size: 17, weight: "bold" });
    const dueN = dueCards(prof.mastery, Date.now(), 99).length;
    g.text(
      dueN
        ? `街坊篇 · 已通关 ${prof.cleared.length} / ${CHAPTERS.length} 区 · 今日温习 ${dueN} 句`
        : `街坊篇 · 已通关 ${prof.cleared.length} / ${CHAPTERS.length} 区`,
      60,
      top + 35,
      { size: 12, color: dueN ? C.amber : "#cfd3f5" }
    );
    // 霓虹招牌（「茶」字接触不良）
    const nx = W - 46;
    g.glow(C.cyan, 12, () => g.rr(nx, top, 32, 96, 7, "rgba(11,13,26,.55)", C.cyan, 2));
    const flick = t % 4500 > 900 && t % 4500 < 1050;
    ["龍", "樓", "茶", "記"].forEach((ch, i) => {
      const on = !(i === 2 && flick);
      g.glow(on ? C.pink : "transparent", on ? 10 : 0, () =>
        g.text(ch, nx + 16, top + 22 + i * 22, {
          size: 18,
          weight: "900",
          color: on ? "#ffe9f1" : "#6b5360",
          align: "center"
        })
      );
    });
    // 街坊（可点）
    const heights = [heroH * 0.42, heroH * 0.5, heroH * 0.42];
    const slotW = Math.min(130, W / 3);
    HOME_CAST.forEach((id, i) => {
      const bob = Math.sin(t / 500 + i) * 3;
      const x = W / 2 + (i - 1) * slotW * 0.92 - slotW / 2;
      const h = heights[i];
      const y = heroH - h - 6 + bob;
      g.img(p.loadImage(`street/${NPCS[id].img}`), x, y, slotW, h, "bottom");
      g.region(x + slotW * 0.15, y, slotW * 0.7, h, "talk", id);
      if (s.talk?.id === id && s.talk.until > t) {
        const line = NPCS[id].intents[0].line;
        const tw = Math.min(W - 24, g.measure(line, 14, "bold") + 20);
        const bx = Math.max(12, Math.min(W - 12 - tw, x + slotW / 2 - tw / 2));
        const by = y - 34;
        g.rr(bx, by + 3, tw, 28, 12, C.pink);
        g.rr(bx, by, tw, 28, 12, "#fff");
        g.text(line, bx + tw / 2, by + 19, {
          size: 14,
          weight: "bold",
          color: C.ink,
          align: "center"
        });
      }
    });
    g.text("点街坊，听佢讲句", W - 12, heroH - 10, { size: 12, color: "#cfd3f5", align: "right" });

    let y = heroH + 30;
    g.text("用粤语，搞掂成条街", W / 2, y, { size: 24, weight: "900", align: "center" });
    y += 24;
    g.text("听懂街坊讲乜 → 出啱句子 → 开口讲出嚟", W / 2, y, {
      size: 13,
      color: C.cyan,
      align: "center"
    });
    // 街道进度
    y += 22;
    const stops = Object.values(NPCS).filter((n) => !n.hidden);
    const stepW = (W - 32) / stops.length;
    stops.forEach((n, i) => {
      const cx = 16 + stepW * (i + 0.5);
      const st = prof.beaten[n.id] ? "done" : prof.met.includes(n.id) ? "met" : "";
      if (i > 0) {
        g.ctx.setLineDash([4, 4]);
        g.ctx.strokeStyle = C.dim;
        g.ctx.beginPath();
        g.ctx.moveTo(cx - stepW + 26, y + 12);
        g.ctx.lineTo(cx - 26, y + 12);
        g.ctx.stroke();
        g.ctx.setLineDash([]);
      }
      const tw = g.measure(n.sign, 12) + 12;
      const fill = st === "done" ? C.amber : undefined;
      const col = st === "done" ? C.ink : st === "met" ? C.cyan : C.dim;
      g.rr(
        cx - tw / 2,
        y,
        tw,
        24,
        6,
        fill,
        st === "done" ? C.amber : st === "met" ? C.cyan : C.line
      );
      g.text(n.sign, cx, y + 17, { size: 12, color: col, align: "center" });
    });
    // 今日一句
    y += 36;
    const d = CARDS[dailyCard()];
    g.rr(16, y, W - 32, 70, 14, "rgba(255,79,139,.12)", "rgba(255,79,139,.5)");
    g.text("今日一句", 28, y + 18, { size: 12, color: C.pink });
    g.text(d.phrase, 28, y + 40, { size: 18, weight: "bold" });
    g.text(`${d.jp}  ·  ${d.meaning}`, 28, y + 59, { size: 11, color: C.dim });
    g.glow(C.pink, 10, () => {
      g.ctx.beginPath();
      g.ctx.arc(W - 44, y + 35, 17, 0, Math.PI * 2);
      g.ctx.fillStyle = C.pink;
      g.ctx.fill();
    });
    g.text("▶", W - 43, y + 41, { size: 14, color: "#fff", align: "center" });
    g.region(16, y, W - 32, 70, "hearCard", d.id);
    // 统计
    y += 82;
    const stats: [string, string][] = [
      [String(prof.runs), "行街"],
      [String(prof.wins), "通关"],
      [String(prof.spoken), "开口"],
      [`${prof.seen.length}/${Object.keys(CARDS).length}`, "识得"]
    ];
    const sw = (W - 32 - 24) / 4;
    stats.forEach(([v, l], i) => {
      const x = 16 + i * (sw + 8);
      g.rr(x, y, sw, 50, 10, C.panel, C.line);
      g.text(v, x + sw / 2, y + 23, { size: 17, weight: "bold", color: C.amber, align: "center" });
      g.text(l, x + sw / 2, y + 41, { size: 12, color: C.dim, align: "center" });
    });
    y += 62;
    const saved = hasSave();
    const bh = 50;
    if (saved) {
      const half = (W - 42) / 2;
      g.button(16, y, half, bh, "继续上一局", "resume", "", "ok");
      g.button(26 + half, y, half, bh, "重新开一局", "new", "", "ghost");
    } else g.button(16, y, W - 32, bh, "开始行街", "new", "", "ok");
    y += bh + 12;
    const menu: [string, string, string, string][] = [
      ["卡", "句子图鉴", `${prof.seen.length} / ${Object.keys(CARDS).length}`, "codex"],
      [
        "坊",
        "街坊录",
        `${prof.met.length} / ${Object.values(NPCS).filter((n) => !n.hidden).length}`,
        "npcs"
      ],
      ["设", "设置", prof.settings.listen ? "听力挑战开" : `语速 ${prof.settings.rate}`, "settings"]
    ];
    const mw = (W - 32 - 16) / 3;
    const colors = [C.pink, C.cyan, C.amber];
    menu.forEach(([ico, label, sub, act], i) => {
      const x = 16 + i * (mw + 8);
      g.rr(x, y, mw, 56, 12, C.panel, C.line);
      g.rr(x + 10, y + 14, 28, 28, 7, undefined, colors[i], 1.5);
      g.text(ico, x + 24, y + 33, { size: 14, weight: "bold", color: colors[i], align: "center" });
      g.text(label, x + 46, y + 26, { size: 14, weight: "bold" });
      g.text(sub, x + 46, y + 44, { size: 11, color: C.dim });
      g.region(x, y, mw, 56, act);
    });
    y += 56 + 16;
    if (y < H - 16)
      g.text("录音只喺本机分析，唔上传 · 声调分只睇音高走势", W / 2, Math.min(H - 14, y + 4), {
        size: 11,
        color: C.dim,
        align: "center"
      });
  }

  function schoolJudge(ok: boolean): void {
    const st = s.school;
    if (!st || st.fb) return;
    const q = st.quiz[st.idx];
    st.fb = { ok, txt: ok ? "啱晒！" : "米啱，仲要练下" };
    if (ok) {
      st.right += 1;
      const up = gainXp(prof.mastery, q.card, ["quiz"], Date.now());
      if (up.after > up.before) p.toast(`「${CARDS[q.card].phrase}」熟练度升到 Lv${up.after}`);
    }
    saveProf();
    s.busy = true;
    setTimeout(() => {
      s.busy = false;
      if (!s.school) return;
      s.school.fb = null;
      s.school.idx += 1;
      s.school.selTok = [];
    }, 800);
  }

  function schoolPick(i: number): void {
    const st = s.school;
    if (!st || st.fb) return;
    const q = st.quiz[st.idx];
    if (q && (q.type === "mean" || q.type === "listen")) schoolJudge(i === q.right);
  }

  function schoolTok(i: number): void {
    const st = s.school;
    if (!st || st.fb) return;
    const q = st.quiz[st.idx];
    if (!q || q.type !== "order" || st.selTok.includes(i)) return;
    st.selTok.push(i);
    if (st.selTok.length === q.tokens.length) schoolJudge(gradeAnswer(q, st.selTok));
  }

  function finishSchool(): void {
    const st = s.school;
    if (!st) return;
    const run = s.run;
    if (st.mode === "node" && run && st.right === st.quiz.length && st.quiz.length > 0) {
      run.gold += 20;
      run.patience = Math.min(run.maxPatience, run.patience + 4);
      p.toast("满分！$20 奖学金 · 耐心 +4");
      saveRun();
    }
    s.school = null;
    s.screen = "map";
  }

  function schoolScreen(): void {
    const st = s.school;
    if (!st) return;
    let y = backBar(st.mode === "lesson" ? "章首课 · 新街區開學" : "学堂 · 温故知新");
    const n = st.quiz.length;
    g.text(`第 ${Math.min(st.idx + 1, n)} / ${n} 题 · 啱咗 ${st.right}`, 16, y + 12, {
      size: 12,
      color: C.dim
    });
    for (let i = 0; i < n; i++) {
      g.ctx.beginPath();
      g.ctx.arc(W - 16 - (n - i) * 16, y + 8, 5, 0, Math.PI * 2);
      g.ctx.fillStyle = i < st.idx ? C.ok : "#262a4a";
      g.ctx.fill();
    }
    y += 28;
    if (st.idx >= n) {
      const full = st.right === n;
      g.rr(16, y, W - 32, 150, 14, C.panel, full ? C.amber : C.line, 2);
      g.text(full ? "满分！学堂阿师递来奖励" : "今日学问有进步", W / 2, y + 34, {
        size: 17,
        weight: "bold",
        align: "center"
      });
      g.text(
        st.mode === "node"
          ? full
            ? "$20 奖学金 · 耐心 +4 · 啱嘅句加 2 经验"
            : `啱 ${st.right}/${n}，每题加 2 熟练经验`
          : `识听识讲就开学堂，啱 ${st.right}/${n} 题`,
        W / 2,
        y + 62,
        { size: 13, color: C.dim, align: "center" }
      );
      g.button(W / 2 - 80, y + 88, 160, 48, "继续行街", "schDone", "", "ok");
      if (st.fb) st.fb = null;
      return;
    }
    const q = st.quiz[st.idx];
    const card = CARDS[q.card];
    g.rr(16, y, W - 32, 108, 14, "rgba(255,79,139,.08)", C.pink, 2);
    const ask =
      q.type === "mean"
        ? "呢句咩意思？"
        : q.type === "listen"
          ? "听音，边句系呢句？"
          : q.type === "order"
            ? "拣词块砌返原句"
            : "开口读顺佢（≥60 分算啱）";
    g.text(ask, 30, y + 22, { size: 12, color: C.pink, weight: "bold" });
    if (q.type === "listen") {
      g.glow(C.pink, 10, () =>
        g.rr(W / 2 - 30, y + 34, 60, 60, 30, "rgba(255,79,139,.2)", C.pink, 2)
      );
      g.text("🔊", W / 2, y + 74, { size: 26, align: "center" });
      g.region(W / 2 - 30, y + 34, 60, 60, "schHear", q.card);
      g.text(s.recording ? "听紧…" : "再听一次都冇问题", W / 2, y + 102, {
        size: 11,
        color: C.dim,
        align: "center"
      });
    } else {
      g.text(card.phrase, W / 2, y + 58, {
        size: q.type === "mean" ? 24 : 22,
        weight: "900",
        align: "center"
      });
      g.text(card.jp, W / 2, y + 82, { size: 12, color: C.cyan, align: "center", font: MONO });
      g.rr(W - 78, y + 12, 50, 30, 15, "rgba(39,225,214,.15)", C.cyan);
      g.text("听", W - 53, y + 32, { size: 14, weight: "bold", color: C.cyan, align: "center" });
      g.region(W - 78, y + 12, 50, 30, "schHear", q.card);
    }
    y += 120;
    if (q.type === "mean" || q.type === "listen") {
      const opts = q.type === "mean" ? q.opts : q.opts.map((id) => CARDS[id].phrase);
      opts.forEach((t, i) => {
        g.button(16, y + i * 54, W - 32, 46, t, "schOpt", String(i), "ghost");
      });
    } else if (q.type === "order") {
      const tw = (W - 32 - (q.tokens.length - 1) * 8) / q.tokens.length;
      q.tokens.forEach((_, i) => {
        const sel = st.selTok[i];
        g.rr(
          16 + i * (tw + 8),
          y,
          tw,
          40,
          8,
          sel === undefined ? "#171a33" : "rgba(61,220,132,.15)",
          sel === undefined ? C.line : C.ok
        );
        g.text(sel === undefined ? "？" : q.tokens[sel], 16 + i * (tw + 8) + tw / 2, y + 26, {
          size: 15,
          weight: "bold",
          color: sel === undefined ? C.dim : C.text,
          align: "center"
        });
      });
      let cy = y + 56;
      let cx = 16;
      q.tiles.forEach((t, i) => {
        if (st.selTok.includes(i)) return;
        const w2 = g.measure(t, 15, "bold") + 22;
        if (cx + w2 > W - 16) {
          cx = 16;
          cy += 46;
        }
        g.rr(cx, cy, w2, 38, 10, C.amber);
        g.text(t, cx + w2 / 2, cy + 25, {
          size: 15,
          weight: "bold",
          color: C.ink,
          align: "center"
        });
        g.region(cx, cy, w2, 38, "schTok", String(i));
        cx += w2 + 8;
      });
    } else {
      const rec = s.recording;
      g.glow(rec ? C.pink : "transparent", rec ? 18 : 0, () =>
        g.rr(16, y, W - 32, 56, 14, rec ? C.pink : C.amber)
      );
      g.text(rec ? "🎙 读紧…松手交卷" : "🎙 按住读一次", W / 2, y + 28, {
        size: 16,
        weight: "bold",
        color: rec ? C.ink : C.ink,
        align: "center"
      });
      g.region(16, y, W - 32, 56, "mic", "", true);
      g.button(16, y + 66, W - 32, 40, "未识读，跳过（计答错）", "schSkip", "", "ghost");
    }
    if (st.fb) {
      g.ctx.fillStyle = "rgba(11,13,26,.55)";
      g.ctx.fillRect(0, y - 200, W, 260);
      g.text(st.fb.ok ? "✓" : "✗", W / 2 - 60, y - 90, {
        size: 54,
        weight: "900",
        color: st.fb.ok ? C.ok : C.pink,
        align: "center"
      });
      g.text(st.fb.txt, W / 2 + 30, y - 100, { size: 15, weight: "bold", align: "center" });
    }
  }

  function chaptersScreen(): void {
    let y = backBar("揀街区");
    const rh = Math.min(96, (H - y - 16) / CHAPTERS.length - 8);
    for (const ch of CHAPTERS) {
      const open = chapterUnlocked(ch.id, prof.cleared);
      const done = prof.cleared.includes(ch.id);
      g.ctx.save();
      g.rr(16, y, W - 32, rh, 12);
      g.ctx.clip();
      g.cover(p.loadImage(`street/${ch.bg}`), 16, y, W - 32, rh);
      g.ctx.fillStyle = open ? "rgba(11,13,26,.55)" : "rgba(11,13,26,.82)";
      g.ctx.fillRect(16, y, W - 32, rh);
      g.ctx.restore();
      g.rr(
        16,
        y,
        W - 32,
        rh,
        12,
        undefined,
        done ? C.amber : open ? C.cyan : "#262a4a",
        open ? 2 : 1
      );
      g.text(ch.label, 30, y + 22, { size: 12, color: open ? C.cyan : C.dim, weight: "bold" });
      g.text(ch.title, 30, y + 46, { size: 18, weight: "900", color: open ? C.text : "#6b7196" });
      g.text(ch.focus, 30, y + rh - 14, { size: 11, color: open ? "#cfd3f5" : "#4d5378" });
      const tag = done ? "✓ 已通关" : open ? "开始 ›" : ch.ready ? "🔒 通关上一区" : "制作中";
      const tw = g.measure(tag, 12, "bold") + 18;
      g.rr(W - 28 - tw, y + 12, tw, 24, 12, done ? C.amber : open ? C.ok : "rgba(38,42,74,.9)");
      g.text(tag, W - 28 - tw / 2, y + 28, {
        size: 12,
        weight: "bold",
        color: done || open ? C.ink : C.dim,
        align: "center"
      });
      g.region(16, y, W - 32, rh, "startChapter", String(ch.id));
      y += rh + 8;
    }
  }

  function backBar(t: string): number {
    g.text("‹ 返回", 16, top + 20, { size: 15, color: C.cyan });
    g.region(8, top, 80, 32, "back");
    g.text(t, W / 2, top + 20, { size: 17, weight: "bold", align: "center" });
    return top + 44;
  }

  const CODEX_PER_PAGE = 10;
  function codexScreen(): void {
    let y = backBar("句子图鉴");
    g.text("点句子听示范 · 最佳声调分只计开口出牌", W / 2, y, {
      size: 12,
      color: C.dim,
      align: "center"
    });
    y += 14;
    const ids = Object.keys(CARDS);
    const pages = Math.ceil(ids.length / CODEX_PER_PAGE);
    s.codexPage = Math.min(s.codexPage, pages - 1);
    const shown = ids.slice(s.codexPage * CODEX_PER_PAGE, (s.codexPage + 1) * CODEX_PER_PAGE);
    const cw = (W - 42) / 2;
    const rows = Math.ceil(shown.length / 2);
    const chh = Math.min(84, (H - y - 80) / rows - 8);
    shown.forEach((id, i) => {
      const x = 16 + (i % 2) * (cw + 10);
      const yy = y + Math.floor(i / 2) * (chh + 8);
      const c = CARDS[id];
      const seen = prof.seen.includes(id);
      g.rr(x, yy, cw, chh, 10, seen ? C.panel : "rgba(22,26,51,.5)", seen ? C.line : "#1f2344");
      if (!seen) {
        g.text("？？？", x + 12, yy + 28, { size: 16, weight: "bold", color: C.dim });
        g.text("行街时遇到先解锁", x + 12, yy + 48, { size: 11, color: "#4d5378" });
        return;
      }
      g.text(c.phrase, x + 10, yy + 24, { size: 15, weight: "bold" });
      g.text(c.jp, x + 10, yy + 40, { size: 10, color: C.pink, font: MONO });
      g.text(c.meaning, x + 10, yy + 56, { size: 11, color: C.dim });
      const best = prof.best[id];
      const mlv = levelOf(prof.mastery[id]?.xp ?? 0);
      g.text(`Lv${mlv} ${LEVEL_NAMES[mlv]}`, x + cw - 10, yy + chh - 8, {
        size: 11,
        color: mlv >= 3 ? C.amber : C.dim,
        align: "right"
      });
      g.text(best === undefined ? "未开口" : `最佳 ${best}`, x + 10, yy + chh - 8, {
        size: 11,
        color: best !== undefined && best >= 70 ? C.ok : C.dim
      });
      g.text("▶", x + cw - 14, yy + 20, { size: 12, color: C.cyan, align: "center" });
      g.region(x, yy, cw, chh, "hearCard", id);
    });
    const py = H - 56;
    if (s.codexPage > 0) g.button(16, py, 90, 40, "‹ 上页", "page", "-1", "ghost");
    g.text(`${s.codexPage + 1} / ${pages}`, W / 2, py + 26, {
      size: 13,
      color: C.dim,
      align: "center"
    });
    if (s.codexPage < pages - 1) g.button(W - 106, py, 90, 40, "下页 ›", "page", "1", "ghost");
  }

  function npcsScreen(): void {
    let y = backBar("街坊录");
    const list = Object.values(NPCS).filter((n) => !n.hidden);
    const rh = Math.min(104, (H - y - 20) / list.length - 8);
    for (const n of list) {
      const met = prof.met.includes(n.id);
      g.ctx.save();
      g.rr(16, y, W - 32, rh, 12);
      g.ctx.clip();
      if (met) {
        g.cover(p.loadImage(`street/${n.bg}`), 16, y, W - 32, rh);
        g.ctx.fillStyle = "rgba(11,13,26,.72)";
        g.ctx.fillRect(16, y, W - 32, rh);
        g.img(p.loadImage(`street/${n.img}`), W - 16 - rh * 1.2, y + 4, rh * 1.2, rh - 4, "bottom");
      } else {
        g.ctx.fillStyle = "rgba(22,26,51,.6)";
        g.ctx.fillRect(16, y, W - 32, rh);
      }
      g.ctx.restore();
      g.rr(16, y, W - 32, rh, 12, undefined, met ? C.line : "#1f2344");
      if (met) {
        g.text(n.name, 28, y + 26, { size: 16, weight: "bold" });
        g.text(`「${n.intents[0].line}」`, 28, y + 48, { size: 12, color: C.cyan });
        const beaten = prof.beaten[n.id] ?? 0;
        g.text(beaten ? `说服咗 ${beaten} 次` : "未说服过", 28, y + rh - 12, {
          size: 12,
          color: beaten ? C.amber : C.dim
        });
        g.region(16, y, W - 32, rh, "talkNpc", n.id);
      } else {
        g.text("？？？", 28, y + 30, { size: 16, weight: "bold", color: C.dim });
        g.text("喺街上遇到先会记低", 28, y + 52, { size: 12, color: "#4d5378" });
      }
      y += rh + 8;
    }
  }

  function settingsScreen(): void {
    let y = backBar("设置") + 6;
    const row = (label: string, sub: string, on: boolean, act: string) => {
      g.rr(16, y, W - 32, 62, 12, C.panel, C.line);
      g.text(label, 28, y + 26, { size: 15, weight: "bold" });
      g.text(sub, 28, y + 46, { size: 11, color: C.dim });
      g.rr(W - 76, y + 18, 48, 26, 13, on ? C.ok : "#2a2f55");
      g.ctx.beginPath();
      g.ctx.arc(on ? W - 41 : W - 63, y + 31, 10, 0, Math.PI * 2);
      g.ctx.fillStyle = "#fff";
      g.ctx.fill();
      g.region(16, y, W - 32, 62, act);
      y += 72;
    };
    row("听力挑战", "街坊台词先收埋，听完或者点开先睇到", prof.settings.listen, "togListen");
    row("揀卡自动读", "揀卡时自动播示范（有录音先会播）", prof.settings.autoSpeak, "togAuto");
    g.text("示范语速", 28, y + 18, { size: 15, weight: "bold" });
    y += 30;
    const rates = [0.8, 0.9, 1];
    const bw = (W - 32 - 16) / 3;
    rates.forEach((r, i) => {
      const on = Math.abs(prof.settings.rate - r) < 0.01;
      const x = 16 + i * (bw + 8);
      g.rr(x, y, bw, 42, 10, on ? C.cyan : C.panel, on ? C.cyan : C.line);
      g.text(r === 1 ? "正常" : `${r}×`, x + bw / 2, y + 27, {
        size: 14,
        weight: "bold",
        color: on ? C.ink : C.text,
        align: "center"
      });
      g.region(x, y, bw, 42, "rate", String(r));
    });
    y += 64;
    g.button(16, y, W - 32, 46, "清除图鉴、街坊录同统计", "wipe", "", "ghost");
    y += 66;
    g.wrap(
      "录音只喺手机本地分析音高，唔会上传、唔会保存。声调分只睇音高走势，唔等于发音考试。",
      16,
      y,
      W - 32,
      18,
      { size: 12, color: C.dim },
      3
    );
  }

  function mapScreen(run: Run, t: number): void {
    const y0 = hud(run);
    title("揀路行街", y0 + 14, C.cyan);
    const areaTop = y0 + 40;
    const areaBot = H - 30;
    const rows = Math.max(...run.map.map((n) => n.row)) + 1;
    const rowH = (areaBot - areaTop) / rows;
    const pos = (n: { row: number; col: number }) => ({
      x: W / 2 + (n.col - 1) * Math.min(110, W * 0.28),
      y: areaBot - rowH * (n.row + 0.5)
    });
    const can = new Set(reachable(run));
    // 连线
    for (const n of run.map) {
      const a = pos(n);
      for (const nid of n.next) {
        const m = run.map.find((x) => x.id === nid);
        if (!m) continue;
        const b = pos(m);
        const walked = run.visited.includes(n.id) && run.visited.includes(m.id);
        g.ctx.strokeStyle = walked ? C.amber : "rgba(138,145,180,.35)";
        g.ctx.lineWidth = walked ? 3 : 2;
        g.ctx.setLineDash(walked ? [] : [5, 5]);
        g.ctx.beginPath();
        g.ctx.moveTo(a.x, a.y);
        g.ctx.lineTo(b.x, b.y);
        g.ctx.stroke();
      }
    }
    g.ctx.setLineDash([]);
    const glyph: Record<string, string> = {
      event: "?",
      shop: "士",
      rest: "糖",
      boss: "午",
      review: "温",
      school: "学"
    };
    for (const n of run.map) {
      const { x, y } = pos(n);
      const r = n.type === "boss" ? 30 : 24;
      const on = can.has(n.id);
      const done = run.visited.includes(n.id);
      const color =
        n.type === "boss"
          ? C.pink
          : n.type === "shop"
            ? C.amber
            : n.type === "rest"
              ? C.ok
              : n.type === "event" || n.type === "review"
                ? C.violet
                : n.type === "school"
                  ? C.amber
                  : C.cyan;
      const pulse = on ? 8 + Math.sin(t / 250) * 6 : 0;
      g.glow(on ? color : "transparent", pulse, () => {
        g.ctx.beginPath();
        g.ctx.arc(x, y, r, 0, Math.PI * 2);
        g.ctx.fillStyle = done ? "#23284a" : C.panel;
        g.ctx.fill();
        g.ctx.lineWidth = on ? 3 : 1.5;
        g.ctx.strokeStyle = on ? color : done ? C.dim : C.line;
        g.ctx.stroke();
      });
      if ((n.type === "fight" || n.type === "boss") && n.npc) {
        g.ctx.save();
        g.ctx.beginPath();
        g.ctx.arc(x, y, r - 3, 0, Math.PI * 2);
        g.ctx.clip();
        g.img(p.loadImage(`street/${NPCS[n.npc].img}`), x - r, y - r + 2, r * 2, r * 2);
        g.ctx.restore();
        if (!on && !done) g.ctx.globalAlpha = 1;
      } else
        g.text(glyph[n.type] ?? "?", x, y + 7, {
          size: 20,
          weight: "bold",
          color,
          align: "center"
        });
      const label =
        n.type === "fight" || n.type === "boss"
          ? NPCS[n.npc ?? "auntie"].sign
          : {
              event: "奇遇",
              shop: "士多",
              rest: "糖水铺",
              review: "温习",
              school: "学堂"
            }[n.type as "event"];
      g.text(label, x, y + r + 15, { size: 12, color: on ? C.text : C.dim, align: "center" });
      if (on) g.region(x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 26, "go", n.id);
    }
  }

  function battleScreen(run: Run, t: number): void {
    const c = run.combat;
    if (!c) return;
    const npc = NPCS[c.npc];
    const intent = currentIntent(run);
    const y0 = top;
    g.text(`第 ${c.turn} 回合`, W - 14, y0 + 16, { size: 13, color: C.dim, align: "right" });
    let x = 14;
    for (const r of run.relics) {
      const def = RELICS[r];
      if (!def) continue;
      g.rr(x, y0 + 2, 26, 26, 6, "rgba(155,123,255,.15)", C.violet);
      g.text(def.glyph, x + 13, y0 + 20, {
        size: 13,
        color: C.violet,
        align: "center",
        weight: "bold"
      });
      g.region(x, y0 + 2, 26, 26, "relic", r);
      x += 32;
    }
    // 场景
    const sx = 12;
    const sy = y0 + 36;
    const sw = W - 24;
    const sh = Math.round(Math.min(sw * 0.8, H * 0.38));
    g.ctx.save();
    g.rr(sx, sy, sw, sh, 16);
    g.ctx.clip();
    g.cover(p.loadImage(`street/${npc.bg}`), sx, sy, sw, sh);
    g.vfade(sx, sy + sh * 0.55, sw, sh * 0.45, "rgba(11,13,26,0)", "rgba(11,13,26,.8)");
    const bob = Math.sin(t / 600) * 3;
    g.img(
      p.loadImage(`street/${npc.img}`),
      sx + sw * 0.38,
      sy + sh * 0.12 + bob,
      sw * 0.6,
      sh * 0.8,
      "bottom"
    );
    g.ctx.restore();
    g.rr(sx, sy, sw, sh, 16, undefined, c.enraged ? C.pink : C.line, c.enraged ? 2 : 1);
    // 意图气泡
    if (intent) {
      const bw = Math.min(sw * 0.56, 220);
      const bx = sx + 10;
      const by = sy + 12;
      g.rr(bx, by + 3, bw, 80, 12, C.pink);
      g.rr(bx, by, bw, 80, 12, "#fff");
      const hidden = prof.settings.listen && !s.revealed;
      if (hidden) {
        g.text("🎧 听力挑战", bx + 10, by + 24, { size: 15, weight: "bold", color: C.ink });
        g.text("先听佢讲乜，再出牌", bx + 10, by + 46, { size: 12, color: "#6b6f8e" });
        g.text("点一下揭开文字", bx + 10, by + 66, { size: 11, color: C.pink });
      } else
        g.wrap(
          intent.line,
          bx + 10,
          by + 22,
          bw - 40,
          18,
          { size: 15, weight: "bold", color: C.ink },
          2
        );
      if (!hidden) {
        g.text(intent.gloss, bx + 10, by + 58, { size: 11, color: "#6b6f8e" });
        g.text(`意图：${intent.label}`, bx + 10, by + 73, { size: 11, color: "#6b6f8e" });
      }
      g.text(`耐心 -${intent.loss}`, bx + bw - 10, by + 73, {
        size: 11,
        color: C.pink,
        align: "right",
        weight: "bold"
      });
      g.ctx.beginPath();
      g.ctx.arc(bx + bw - 16, by + 16, 12, 0, Math.PI * 2);
      g.ctx.fillStyle = C.pink;
      g.ctx.fill();
      g.text("▶", bx + bw - 15, by + 21, { size: 11, color: "#fff", align: "center" });
      g.region(bx, by, bw, 80, "hearIntent");
    }
    g.text(`${npc.name} · 说服`, sx + 10, sy + sh - 12, { size: 12, color: "#cfd3f5" });
    g.bar(sx + 110, sy + sh - 20, sw - 170, 8, c.progress, c.target, C.pink);
    g.text(`${c.progress}/${c.target}`, sx + sw - 10, sy + sh - 12, {
      size: 12,
      weight: "bold",
      align: "right"
    });

    // 提示 + 底气 + 耐心
    let y = sy + sh + 20;
    const need = intent?.need;
    const tip = c.answered
      ? "✓ 呢回合已经接住咗"
      : need
        ? `💡 佢「${intent?.label}」→ 用带 ✓ 嘅句子卡接住，唔扣耐心、说服 ×1.5`
        : "💡 呢句冇得接，出稳住卡顶住";
    g.wrap(tip, 16, y, W - 32, 16, { size: 12, color: C.cyan }, 2);
    y += 26;
    g.glow(C.amber, 12, () => {
      g.ctx.beginPath();
      g.ctx.arc(40, y + 22, 24, 0, Math.PI * 2);
      g.ctx.fillStyle = C.amber;
      g.ctx.fill();
    });
    g.text(String(c.energy), 40, y + 26, {
      size: 20,
      weight: "900",
      color: C.ink,
      align: "center"
    });
    g.text("底气", 40, y + 39, { size: 9, color: C.ink, align: "center" });
    g.text("我的耐心", 74, y + 26, { size: 11, color: C.pink });
    g.bar(128, y + 17, W - 128 - 120, 10, run.patience, run.maxPatience, C.cyan);
    if (c.block) g.text(`🛡${c.block}`, W - 108, y + 27, { size: 12, color: C.cyan });
    g.button(W - 100, y + 2, 86, 40, "结束回合", "end", "", "ghost");

    // 手牌
    y += 60;
    const n = c.hand.length;
    const cw = Math.min(92, (W - 20) / Math.max(n, 3.6));
    const ch = Math.min(cw * 1.9, H - y - 112);
    const span = Math.min(W - 24, n * cw + (n - 1) * 6);
    const step = n > 1 ? (span - cw) / (n - 1) : 0;
    const hx0 = (W - span) / 2;
    c.hand.forEach((id, i) => {
      if (i === s.sel) return;
      const card = CARDS[id];
      const pv = cardPreview(run, card);
      drawCard(id, hx0 + i * step, y + 10, cw, ch, {
        poor: card.cost > c.energy,
        answers: pv.answers,
        eff: effectText(card, pv),
        act: "sel",
        idx: i
      });
    });
    if (s.sel !== null && c.hand[s.sel]) {
      const i = s.sel;
      const card = CARDS[c.hand[i]];
      const pv = cardPreview(run, card);
      drawCard(c.hand[i], hx0 + i * step, y - 8, cw, ch, {
        sel: true,
        answers: pv.answers,
        eff: effectText(card, pv),
        act: "sel",
        idx: i
      });
    }
    y += ch + 24;
    // 出牌操作
    if (s.sel !== null) {
      const bw = (W - 42) / 2;
      g.button(16, y, bw, 50, "直接出", "tap", "", "ghost", "效果 ×1");
      const rec = s.recording;
      g.rr(26 + bw, y + 4, bw, 50, 14, "rgba(0,0,0,.35)");
      g.glow(rec ? C.pink : "transparent", rec ? 18 : 0, () =>
        g.rr(26 + bw, y, bw, 50, 14, rec ? C.pink : C.amber)
      );
      g.text(rec ? "🎙 讲紧…松手出牌" : "🎙 按住读出嚟", 26 + bw + bw / 2, y + 23, {
        size: 15,
        weight: "bold",
        color: C.ink,
        align: "center"
      });
      g.text("声调贴合 ×2 暴击", 26 + bw + bw / 2, y + 40, {
        size: 11,
        color: C.ink,
        align: "center"
      });
      g.region(26 + bw, y, bw, 50, "mic", "", true);
    } else
      g.text("揀一张卡 → 按住咪读出嚟", W / 2, y + 28, { size: 13, color: C.dim, align: "center" });
    if (s.lastScore !== null)
      g.text(`上一句声调 ${s.lastScore} 分`, W / 2, Math.min(H - 10, y + 72), {
        size: 12,
        color: s.lastScore >= 70 ? C.ok : C.dim,
        align: "center"
      });
    g.text(`抽牌堆 ${c.draw.length} · 弃牌堆 ${c.discard.length}`, W / 2, H - 12, {
      size: 11,
      color: C.dim,
      align: "center"
    });
    // 飘字
    if (s.float) {
      const k = (t - s.float.t0) / 1100;
      if (k > 1) s.float = null;
      else {
        g.ctx.globalAlpha = 1 - k;
        g.glow(s.float.color, 14, () =>
          g.text(s.float?.text ?? "", W / 2, sy + sh * 0.55 - k * 40, {
            size: 24,
            weight: "900",
            color: s.float?.color,
            align: "center"
          })
        );
        g.ctx.globalAlpha = 1;
      }
    }
  }

  function rewardScreen(run: Run): void {
    let y = hud(run);
    const c = run.combat;
    title("街坊畀你讲服咗！", y + 16, C.amber);
    y += 44;
    g.text(`$ +${s.rewardGold}   开口 ${c?.spoken ?? 0} 句   暴击 ${c?.crits ?? 0} 次`, W / 2, y, {
      size: 13,
      color: C.cyan,
      align: "center"
    });
    y += 20;
    if (s.levelUps.length) {
      const txt = s.levelUps.map((l) => `${CARDS[l.id].phrase} Lv${l.lv}`).join("、");
      g.wrap(`熟练度提升：${txt}`, 16, y, W - 32, 17, { size: 13, color: C.amber }, 2);
      y += 20;
    }
    g.text("选一张句子卡加入卡组", W / 2, y, { size: 13, color: C.dim, align: "center" });
    y += 20;
    y += cardGrid(s.reward, y + 6, "pick");
    if (!s.adUsed && p.adAvailable("extraCard")) {
      g.button(
        16,
        y + 6,
        W - 32,
        50,
        "▶ 看段广告 · 多一张备选",
        "adCard",
        "",
        "amber",
        "看完先有，唔看唔影响进度"
      );
      y += 66;
    }
    g.button(16, y + 8, W - 32, 46, "唔要，继续行街", "skip", "", "ghost");
  }

  function shopScreen(run: Run): void {
    let y = hud(run);
    title("士多 · 买句子，买密码", y + 16, C.amber);
    y += 34;
    const sh = s.shop;
    const left = sh.cards.filter((id) => !sh.bought.includes(id));
    y += cardGrid(left, y, "buy", (id) => ({ price: CARDS[id].rarity === "rare" ? 45 : 25 }));
    if (sh.relic && !sh.bought.includes(sh.relic)) {
      const r = RELICS[sh.relic];
      g.rr(16, y, W - 32, 60, 12, "rgba(155,123,255,.1)", C.violet);
      g.text(r.glyph, 40, y + 38, { size: 22, color: C.violet, align: "center", weight: "bold" });
      g.text(r.name, 66, y + 24, { size: 15, weight: "bold" });
      g.wrap(r.desc, 66, y + 42, W - 150, 14, { size: 11, color: C.dim }, 2);
      g.rr(W - 76, y + 20, 48, 20, 10, C.amber);
      g.text(`$${RELIC_PRICE}`, W - 52, y + 35, {
        size: 12,
        weight: "bold",
        color: C.ink,
        align: "center"
      });
      g.region(16, y, W - 32, 60, "buyRelic");
      y += 70;
    }
    if (sh.removed) {
      g.text("今日已经请走一张卡", W / 2, y + 22, { size: 13, color: C.dim, align: "center" });
      y += 36;
    } else {
      g.rr(
        16,
        y,
        W - 32,
        54,
        12,
        sh.removing ? "rgba(39,225,214,.16)" : "rgba(39,225,214,.07)",
        C.cyan,
        sh.removing ? 2 : 1
      );
      g.text("剪", 40, y + 35, { size: 20, color: C.cyan, align: "center", weight: "bold" });
      g.text("请走一张卡", 66, y + 23, { size: 15, weight: "bold" });
      g.text("卡组越精，好句越易抽到", 66, y + 41, { size: 11, color: C.dim });
      g.rr(W - 76, y + 17, 48, 20, 10, C.amber);
      g.text(`$${REMOVE_PRICE}`, W - 52, y + 32, {
        size: 12,
        weight: "bold",
        color: C.ink,
        align: "center"
      });
      g.region(16, y, W - 32, 54, "removeMode");
      y += 64;
    }
    if (sh.removing) {
      g.text(`揀一张请走（现有 ${run.deck.length} 张，最少留 5 张）`, W / 2, y + 4, {
        size: 12,
        color: C.cyan,
        align: "center"
      });
      y += 14 + cardGrid([...new Set(run.deck)], y + 16, "remove");
    }
    g.button(16, Math.min(H - 58, y + 8), W - 32, 46, "行出去", "leave", "", "ghost");
  }

  function restScreen(run: Run): void {
    let y = hud(run);
    title("糖水铺 · 坐低抖下", y + 16, C.ok);
    y += 34;
    g.button(16, y, W - 32, 54, "饮碗红豆沙", "heal", "", "ok", "耐心 +12");
    y += 72;
    g.wrap(
      "或者：揀一句你已经识讲嘅，毕业离开卡组（卡组更精）",
      16,
      y,
      W - 32,
      17,
      { size: 13, color: C.dim },
      2
    );
    y += 30;
    cardGrid([...new Set(run.deck)], y, "grad");
  }

  function eventScreen(run: Run): void {
    let y = hud(run);
    const ev = EVENTS[s.event.idx] ?? EVENTS[0];
    title(ev.title, y + 20, C.violet);
    y += 50;
    y += g.wrap(ev.text, 24, y, W - 48, 22, { size: 15 }, 5) + 12;
    if (ev.reward === "card" && s.event.card) {
      const cw = 110;
      drawCard(s.event.card, (W - cw) / 2, y, cw, cw * 1.32, { act: "evCard" });
      y += cw * 1.32 + 20;
      g.button(16, y, W - 32, 46, "多谢，唔使喇", "leave", "", "ghost");
    } else {
      g.button(
        16,
        y,
        W - 32,
        50,
        ev.reward === "gold" ? "收下 $20" : "饮完继续行（耐心 +8）",
        "evOk",
        "",
        "ok"
      );
    }
  }

  function endScreen(run: Run | null, win: boolean): void {
    const im = p.loadImage(`street/${win ? "boss.png" : "auntie.png"}`);
    g.img(im, W / 2 - 90, top + 30, 180, 190, "bottom");
    let y = top + 262;
    title(win ? "午市都搞掂！成条街都识你" : "耐心用晒……", y, win ? C.amber : C.pink);
    y += 28;
    g.text(win ? "第一章完成。你用粤语说服咗成条街。" : "唔紧要，讲错先会进步。", W / 2, y, {
      size: 14,
      color: C.dim,
      align: "center"
    });
    y += 28;
    if (run)
      g.text(`卡组 ${run.deck.length} 张 · 毕业 ${run.graduated.length} 句`, W / 2, y, {
        size: 13,
        color: C.cyan,
        align: "center"
      });
    y += 24;
    if (!win && !s.revived && run?.combat && p.adAvailable("revive")) {
      g.button(
        16,
        y,
        W - 32,
        54,
        "▶ 看段广告 · 深呼吸再嚟过",
        "revive",
        "",
        "amber",
        "耐心回返一半，每局限一次"
      );
      y += 68;
    }
    g.button(16, y, W - 32, 50, "再行一次", "new", "", "ok");
    y += 62;
    g.button(16, y, W - 32, 46, "返回主页", "home", "", "ghost");
  }

  /* ---------- 流程 ---------- */
  function dailyCard(): string {
    const d = new Date();
    const key = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
    const pool = Object.keys(CARDS).filter((id) => CARDS[id].rarity !== "starter");
    return pool[((key * 2654435761) % pool.length) >>> 0] ?? Object.keys(CARDS)[0];
  }

  function goNode(id: string): void {
    const run = s.run;
    const node = run?.map.find((n) => n.id === id);
    if (!run || !node) return;
    run.at = id;
    run.visited.push(id);
    s.sel = null;
    s.lastScore = null;
    if (node.type === "fight" || node.type === "boss") {
      startCombat(run, node.npc ?? "auntie");
      s.revealed = false;
      s.levelUps = [];
      if (node.npc && !prof.met.includes(node.npc)) prof.met.push(node.npc);
      saveProf();
      s.screen = "battle";
    } else if (node.type === "shop") {
      s.shop = {
        cards: rewardChoices(run, 4),
        relic: relicOffer(run),
        bought: [],
        removing: false,
        removed: false
      };
      s.screen = "shop";
    } else if (node.type === "rest") s.screen = "rest";
    else if (node.type === "school") {
      s.school = {
        mode: "node",
        quiz: makeQuizSet(
          quizPool(run.chapter ?? 1, prof.mastery, Date.now()).slice(0, 12),
          nextRand(run)
        ),
        idx: 0,
        right: 0,
        selTok: [],
        fb: null
      };
      s.screen = "school";
    } else if (node.type === "review") {
      const due = dueCards(prof.mastery, Date.now(), 6);
      if (due.length < 2) {
        run.patience = Math.min(run.maxPatience, run.patience + 6);
        s.run = run;
        s.screen = "map";
        p.toast("无嘢好温习，饮啖茶先（耐心 +6）");
      } else {
        startReview(run, due);
        s.revealed = false;
        s.levelUps = [];
        s.screen = "battle";
      }
    } else {
      const idx = Math.floor(nextRand(run)() * EVENTS.length);
      s.event = { idx, card: EVENTS[idx].reward === "card" ? rewardChoices(run, 1)[0] : undefined };
      s.screen = "event";
    }
  }

  function afterWin(): void {
    const run = s.run;
    if (!run?.combat) return;
    const npc = NPCS[run.combat.npc];
    prof.beaten[npc.id] = (prof.beaten[npc.id] ?? 0) + 1;
    if (npc.boss) {
      prof.wins += 1;
      const chId = run.chapter ?? 1;
      if (!prof.cleared.includes(chId)) prof.cleared.push(chId);
      saveProf();
      s.screen = "win";
      return;
    }
    saveProf();
    s.rewardGold = 12 + Math.floor(nextRand(run)() * 10);
    run.gold += s.rewardGold;
    s.reward = rewardChoices(run);
    s.adUsed = false;
    s.screen = "reward";
  }

  function doPlay(crit: boolean, spoke: boolean, score: number | null = null): void {
    const run = s.run;
    if (!run?.combat || s.sel === null) return;
    const cardId = run.combat.hand[s.sel];
    const res = playCard(run, s.sel, crit, spoke);
    if (!res.ok) {
      p.toast(res.reason ?? "出唔到");
      return;
    }
    s.sel = null;
    // 熟练度：出牌 +1，接住 +2，读得准 +3，暴击 +4
    const evs: MasteryEvent[] = ["play"];
    if (res.answered) evs.push("answer");
    if (score !== null && score >= 60) evs.push("spoke");
    if (res.crit) evs.push("crit");
    const up = gainXp(prof.mastery, cardId, evs, Date.now());
    saveProf();
    if (up.after > up.before) {
      s.levelUps = s.levelUps.filter((l) => l.id !== cardId).concat({ id: cardId, lv: up.after });
      run.bonus = { ...(run.bonus ?? {}), [cardId]: levelBonus(up.after) };
      p.toast(`「${CARDS[cardId].phrase}」熟练度升到 Lv${up.after}`);
    }
    const parts: string[] = [];
    if (res.persuade) parts.push(`说服 +${res.persuade}`);
    if (res.calm) parts.push(`稳住 ${res.calm}`);
    s.float = {
      text: `${res.crit ? "暴击！" : ""}${res.answered ? "接住！" : ""}${parts.join(" ")}`,
      color: res.crit ? C.amber : C.ok,
      t0: p.now()
    };
    if (res.won) {
      s.busy = true;
      setTimeout(() => {
        s.busy = false;
        afterWin();
        saveRun();
      }, 700);
    }
  }

  async function micDown(): Promise<void> {
    const run = s.run;
    if (s.recording) return;
    let card: CardDef | null = null;
    recMode = "battle";
    if (s.screen === "school" && s.school && !s.school.fb) {
      const q = s.school.quiz[s.school.idx];
      if (!q || q.type !== "speak") return;
      recMode = "school";
      card = CARDS[q.card];
    } else if (run?.combat && s.sel !== null) {
      card = CARDS[run.combat.hand[s.sel]];
      if (card.cost > run.combat.energy) {
        p.toast("底气唔够");
        return;
      }
    }
    if (!card) return;
    tracker = new PitchTracker();
    s.recording = true;
    recStart = p.now();
    try {
      await p.startRecord((pcm, rate) => tracker?.push(pcm, rate));
    } catch {
      s.recording = false;
      if (recMode === "school") p.toast("咪开唔到，食日再练（计答错）");
      else
        p.confirm("开唔到咪", "要开口出牌需要录音权限。可以去设置打开，或者先用「直接出」。").then(
          (ok) => {
            if (ok && p.name === "wx") wx.openSetting();
          }
        );
    }
  }

  function micUp(): void {
    const run = s.run;
    if (!s.recording) return;
    s.recording = false;
    p.stopRecord();
    if (recMode === "school") {
      const st = s.school;
      const q = st?.quiz[st.idx];
      if (p.now() - recStart < 350 || !tracker || !q || !st) {
        tracker = null;
        p.toast("按住讲完先松手");
        return;
      }
      const detail = scoreToneContour(tracker.frames, CARDS[q.card].jp);
      tracker = null;
      const sc = detail?.score ?? null;
      s.lastScore = sc === null ? null : Math.round(sc);
      if (sc === null) {
        p.toast("听唔清，食日再试");
        return;
      }
      noteScore(prof, q.card, sc);
      saveProf();
      schoolJudge(sc >= 60);
      return;
    }
    if (!run?.combat || s.sel === null) return;
    const card = CARDS[run.combat.hand[s.sel]];
    if (p.now() - recStart < 350 || !tracker) {
      p.toast("按住讲完先松手");
      return;
    }
    const detail = scoreToneContour(tracker.frames, card.jp);
    tracker = null;
    const score = detail?.score ?? null;
    s.lastScore = score === null ? null : Math.round(score);
    noteScore(prof, card.id, score);
    saveProf();
    if (score === null) p.toast("听唔清，照出（效果 ×1）");
    doPlay(score !== null && score >= 70, true, score);
  }

  async function handle(act: string, id: string): Promise<void> {
    const run = s.run;
    switch (act) {
      case "new":
        s.screen = "chapters";
        break;
      case "startChapter": {
        const chId = Number(id);
        if (!chapterUnlocked(chId, prof.cleared)) {
          p.toast(
            CHAPTERS.find((c) => c.id === chId)?.ready ? "通关上一区先解锁" : "呢区制作紧，敬请期待"
          );
          break;
        }
        s.run = newRun(Date.now() % 1_000_000, chId);
        s.run.bonus = bonusTable(prof.mastery);
        s.revived = false;
        s.levelUps = [];
        if (!prof.taught.includes(chId)) {
          prof.taught.push(chId);
          const starter = CHAPTERS.find((c) => c.id === chId)?.starter ?? [];
          s.school = {
            mode: "lesson",
            quiz: makeQuizSet(starter, Math.random, 3),
            idx: 0,
            right: 0,
            selTok: [],
            fb: null
          };
          s.screen = "school";
        } else s.screen = "map";
        prof.runs += 1;
        saveProf();
        break;
      }
      case "resume":
        if (!loadRun()) p.toast("存档读唔到，开过新一局啦");
        break;
      case "back":
        s.screen = "home";
        break;
      case "home":
        s.screen = "home";
        s.run = null;
        p.setItem(RUN_KEY, "");
        p.showInterstitial();
        break;
      case "talk":
        s.talk = { id, until: p.now() + 2600 };
        hear(intentKey(id, 0));
        break;
      case "codex":
      case "npcs":
      case "settings":
        s.screen = act;
        s.codexPage = 0;
        break;
      case "page":
        s.codexPage = Math.max(0, s.codexPage + Number(id));
        break;
      case "talkNpc":
        if (NPCS[id]) hear(intentKey(id, 0));
        break;
      case "togListen":
        prof.settings.listen = !prof.settings.listen;
        saveProf();
        break;
      case "togAuto":
        prof.settings.autoSpeak = !prof.settings.autoSpeak;
        saveProf();
        break;
      case "rate":
        prof.settings.rate = Number(id);
        saveProf();
        break;
      case "wipe":
        if (await p.confirm("清除档案", "确定清除图鉴、街坊录同统计？当前一局唔受影响。")) {
          prof = freshProfile();
          saveProf();
          p.toast("档案已清除");
        }
        break;
      case "schOpt":
        schoolPick(Number(id));
        break;
      case "schTok":
        schoolTok(Number(id));
        break;
      case "schSkip":
        schoolJudge(false);
        break;
      case "schHear":
        if (id) hear(cardKey(id));
        break;
      case "schDone":
        finishSchool();
        break;
      case "hearCard":
        hear(cardKey(id));
        break;
      case "hearIntent":
        if (run?.combat) {
          s.revealed = true;
          hear(intentKey(run.combat.npc, run.combat.intentIndex));
        }
        break;
      case "relic":
        if (RELICS[id]) p.toast(`${RELICS[id].name}：${RELICS[id].desc}`);
        break;
      case "go":
        goNode(id);
        break;
      case "sel": {
        const i = Number(id);
        s.sel = s.sel === i ? null : i;
        if (s.sel !== null && prof.settings.autoSpeak && run?.combat) {
          const path = audioPath(cardKey(run.combat.hand[s.sel]));
          if (path) p.playAudio(path, prof.settings.rate);
        }
        break;
      }
      case "tap":
        doPlay(false, false);
        break;
      case "mic":
        await micDown();
        break;
      case "end": {
        if (!run?.combat) break;
        s.sel = null;
        const r = endTurn(run);
        s.revealed = false;
        if (r.lost) {
          s.screen = "lose";
          break;
        }
        s.float = {
          text: r.answered ? "接住咗，冇扣耐心" : r.loss ? `耐心 -${r.loss}` : "顶住咗！",
          color: r.loss ? C.pink : C.cyan,
          t0: p.now()
        };
        if (r.enragedNow) p.toast("午市高峰：老板开始急！");
        break;
      }
      case "pick":
        if (!run) break;
        run.deck.push(id);
        noteCards(prof, [id]);
        saveProf();
        s.screen = "map";
        break;
      case "skip":
      case "leave":
        s.screen = "map";
        break;
      case "adCard": {
        if (!run || s.adUsed) break;
        const r = await p.showRewarded("extraCard");
        if (r === "rewarded") {
          s.adUsed = true;
          const extra = rewardChoices(run, 6).find((c) => !s.reward.includes(c));
          if (extra) s.reward.push(extra);
        } else if (r === "skipped") p.toast("要睇完先有奖励");
        else p.toast("暂时冇广告，唔紧要");
        break;
      }
      case "revive": {
        if (!run?.combat || s.revived) break;
        const r = await p.showRewarded("revive");
        if (r === "rewarded") {
          s.revived = true;
          run.patience = Math.round(run.maxPatience / 2);
          s.screen = "battle";
        } else if (r === "skipped") p.toast("要睇完先可以复活");
        else p.toast("暂时冇广告，唔紧要");
        break;
      }
      case "buy": {
        if (!run) break;
        const price = CARDS[id].rarity === "rare" ? 45 : 25;
        if (run.gold < price) {
          p.toast("港纸唔够");
          break;
        }
        run.gold -= price;
        run.deck.push(id);
        s.shop.bought.push(id);
        noteCards(prof, [id]);
        saveProf();
        break;
      }
      case "buyRelic":
        if (!run || !s.shop.relic) break;
        if (run.gold < RELIC_PRICE) {
          p.toast("港纸唔够");
          break;
        }
        run.gold -= RELIC_PRICE;
        run.relics.push(s.shop.relic);
        s.shop.bought.push(s.shop.relic);
        break;
      case "removeMode":
        if (!run || s.shop.removed) break;
        if (run.gold < REMOVE_PRICE) {
          p.toast("港纸唔够");
          break;
        }
        s.shop.removing = !s.shop.removing;
        break;
      case "remove": {
        if (!run || !s.shop.removing || s.shop.removed) break;
        const at = run.deck.indexOf(id);
        if (at < 0 || run.deck.length <= 5) {
          p.toast("卡组最少要留 5 张");
          break;
        }
        run.gold -= REMOVE_PRICE;
        run.deck.splice(at, 1);
        s.shop.removed = true;
        s.shop.removing = false;
        p.toast(`「${CARDS[id].phrase}」执包袱走人`);
        break;
      }
      case "heal":
        if (run) run.patience = Math.min(run.maxPatience, run.patience + 12);
        s.screen = "map";
        break;
      case "grad": {
        if (!run) break;
        const i = run.deck.indexOf(id);
        if (i >= 0 && run.deck.length > 5) {
          run.deck.splice(i, 1);
          run.graduated.push(id);
          p.toast(`「${CARDS[id].phrase}」毕业！`);
          s.screen = "map";
        } else p.toast("卡组最少要留 5 张");
        break;
      }
      case "evCard":
        if (!run) break;
        run.deck.push(id);
        noteCards(prof, [id]);
        saveProf();
        s.screen = "map";
        break;
      case "evOk": {
        if (!run) break;
        const ev = EVENTS[s.event.idx];
        if (ev?.reward === "gold") run.gold += 20;
        else run.patience = Math.min(run.maxPatience, run.patience + 8);
        s.screen = "map";
        break;
      }
    }
    if (run?.combat && s.screen === "battle") noteCards(prof, run.combat.hand);
    saveRun();
  }

  /* ---------- 输入 & 主循环 ---------- */
  p.onTouch(
    (x, y) => {
      const r = g.hit(x, y);
      downRegion = r ? `${r.act}|${r.id}` : null;
      if (r?.hold && !s.busy) {
        holding = true;
        void handle(r.act, r.id);
      }
    },
    (x, y) => {
      if (holding) {
        holding = false;
        micUp();
        saveRun();
        return;
      }
      const r = g.hit(x, y);
      if (!r || s.busy || downRegion !== `${r.act}|${r.id}`) return;
      void handle(r.act, r.id);
    }
  );

  function frame(): void {
    const t = p.now();
    g.begin();
    const run = s.run;
    if (s.screen === "school") schoolScreen();
    else if (s.screen === "chapters") chaptersScreen();
    else if (s.screen === "codex") codexScreen();
    else if (s.screen === "npcs") npcsScreen();
    else if (s.screen === "settings") settingsScreen();
    else if (s.screen === "home" || !run) homeScreen(t);
    else if (s.screen === "map") mapScreen(run, t);
    else if (s.screen === "battle") battleScreen(run, t);
    else if (s.screen === "reward") rewardScreen(run);
    else if (s.screen === "shop") shopScreen(run);
    else if (s.screen === "rest") restScreen(run);
    else if (s.screen === "event") eventScreen(run);
    else endScreen(run, s.screen === "win");
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 调试钩子（仅网页预览）：自动化测试读取状态
  if (p.name === "web")
    (globalThis as unknown as { __street: { s: State; g: Painter } }).__street = { s, g };
}
