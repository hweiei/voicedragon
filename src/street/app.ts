/** 街坊卡牌 · 界面层：模板字符串渲染 + 事件委托。 */
import { CARDS, type CardDef, EVENTS, NPCS, RELICS } from "./data";
import {
  type MapNode,
  ROWS,
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
  startCombat
} from "./engine";
import { MicSession, speakCantonese } from "./voice";
import "./style.css";

type Screen = "title" | "map" | "battle" | "reward" | "shop" | "rest" | "event" | "lose" | "win";
interface Ui {
  screen: Screen;
  run: Run | null;
  sel: number | null;
  toast: string;
  float: { text: string; cls: string } | null;
  reward: string[];
  rewardGold: number;
  adUsed: boolean;
  shop: { cards: string[]; relic: string | null; bought: string[] };
  event: { idx: number; card?: string; done: boolean };
  recording: boolean;
  lastTake: { score: number | null; user: number[]; tpl: number[] } | null;
  revived: boolean;
}

const SAVE = "street-run-v1";
const root = document.getElementById("app") as HTMLElement;
const ui: Ui = {
  screen: "title",
  run: null,
  sel: null,
  toast: "",
  float: null,
  reward: [],
  rewardGold: 0,
  adUsed: false,
  shop: { cards: [], relic: null, bought: [] },
  event: { idx: 0, done: false },
  recording: false,
  lastTake: null,
  revived: false
};
const mic = new MicSession();
const art = (f: string) => `${import.meta.env.BASE_URL}street/${f}`;
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

function save(): void {
  if (ui.run && ui.screen !== "lose" && ui.screen !== "win")
    localStorage.setItem(SAVE, JSON.stringify({ run: ui.run, screen: ui.screen }));
  else localStorage.removeItem(SAVE);
}
function load(): { run: Run; screen: Screen } | null {
  try {
    const raw = localStorage.getItem(SAVE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let toastTimer = 0;
function toast(msg: string): void {
  ui.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast = "";
    render();
  }, 2200);
}
function say(text: string, rate = 0.9): void {
  if (!speakCantonese(text, rate)) toast("呢部设备冇粤语语音，可以先睇粤拼跟读");
}

/* ---------- 组件 ---------- */
function hud(run: Run): string {
  const relics = run.relics
    .map(
      (r) =>
        `<button class="relic" data-act="relic" data-id="${r}" title="${esc(RELICS[r].name)}">${RELICS[r].glyph}</button>`
    )
    .join("");
  return `<div class="hud"><span class="pat">♥ 耐心 ${run.patience}/${run.maxPatience}</span><span class="gold">$ 港纸 ${run.gold}</span><span class="deckn">卡组 ${run.deck.length}</span></div><div class="relics">${relics}</div>`;
}

function cardHtml(
  id: string,
  opts: { idx?: number; sel?: boolean; run?: Run; act?: string; price?: number } = {}
): string {
  const c: CardDef = CARDS[id];
  const kindName = { persuade: "说服", calm: "稳住", skill: "技巧" }[c.kind];
  const pv = opts.run?.combat
    ? cardPreview(opts.run, c)
    : { persuade: c.persuade ?? 0, calm: c.calm ?? 0, answers: false };
  const fx: string[] = [];
  if (pv.persuade) fx.push(`说服 +${pv.persuade}`);
  if (pv.calm) fx.push(`稳住 ${pv.calm}`);
  if (c.draw) fx.push(`抽 ${c.draw} 张`);
  if (c.energy) fx.push(`底气 +${c.energy}`);
  const tagLine = pv.answers ? `<em class="ans">✓ 接得住</em>` : "";
  const afford = opts.run?.combat && c.cost > opts.run.combat.energy ? " poor" : "";
  const dataIdx = opts.idx !== undefined ? `data-idx="${opts.idx}"` : "";
  return `<button class="card ${c.kind}${opts.sel ? " sel" : ""}${pv.answers ? " hot" : ""}${afford}" data-act="${opts.act ?? "sel"}" data-id="${id}" ${dataIdx}>
    <span class="cost">${c.cost}</span><span class="ty">${kindName}${c.rarity === "rare" ? " ★" : ""}</span>
    <span class="ph">${esc(c.phrase)}</span><span class="jp">${c.jp}</span>
    <span class="ef">${fx.join("<br>")}${tagLine}</span>${opts.price !== undefined ? `<span class="price">$${opts.price}</span>` : ""}
  </button>`;
}

function curveSvg(user: number[], tpl: number[]): string {
  if (!tpl.length) return "";
  const all = [...user, ...tpl];
  const lo = Math.min(...all) - 1;
  const hi = Math.max(...all) + 1;
  const pts = (arr: number[]) =>
    arr
      .map(
        (v, i) =>
          `${((i / Math.max(1, arr.length - 1)) * 240).toFixed(1)},${(60 - ((v - lo) / (hi - lo)) * 56).toFixed(1)}`
      )
      .join(" ");
  return `<svg class="curve" viewBox="0 0 240 62"><polyline points="${pts(tpl)}" class="tpl"/>${user.length ? `<polyline points="${pts(user)}" class="usr"/>` : ""}</svg>`;
}

/* ---------- 各屏 ---------- */
function titleScreen(): string {
  const saved = load();
  return `<div class="screen title">
    <div class="logo"><span class="neon pink">龍</span></div>
    <h1>声震龙楼</h1><p class="tag">街坊卡牌 · 用粤语搞掂成条街</p>
    <div class="cast">${["auntie", "waiter", "taxi", "landlady"].map((n) => `<img src="${art(NPCS[n].img)}" alt="">`).join("")}</div>
    <div class="howto">
      <div><b>① 听</b>街坊头顶系佢下一句，点 ▶ 听</div>
      <div><b>② 出</b>揀一张粤语句子卡回应</div>
      <div><b>③ 讲</b>按住咪读出嚟，声调贴合就暴击 ×2</div>
    </div>
    ${saved ? `<button class="btn ok" data-act="resume">继续上一局</button>` : ""}
    <button class="btn ${saved ? "ghost" : "ok"}" data-act="new">开始行街</button>
    <p class="fine">原型版 · 录音只喺本机分析，唔上传 · 声调评分只睇音高走势，唔等于发音考试</p>
  </div>`;
}

function mapScreen(run: Run): string {
  const reach = reachable(run);
  const W = 300;
  const rowH = 78;
  const H = ROWS * rowH;
  const pos = (n: MapNode) => ({ x: 50 + n.col * 100, y: H - 40 - n.row * rowH });
  const lines = run.map
    .flatMap((n) =>
      n.next.map((id) => {
        const m = run.map.find((k) => k.id === id);
        if (!m) return "";
        const a = pos(n);
        const b = pos(m);
        const walked = run.visited.includes(n.id) && run.visited.includes(m.id);
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? "walked" : ""}"/>`;
      })
    )
    .join("");
  const npcGlyph: Record<string, string> = {
    auntie: "婶",
    waiter: "伙",
    taxi: "的",
    landlady: "婆"
  };
  const glyph = (n: MapNode) =>
    n.type === "fight"
      ? (npcGlyph[n.npc ?? ""] ?? "?")
      : { event: "?", shop: "士", rest: "糖", boss: "午市" }[
          n.type as "event" | "shop" | "rest" | "boss"
        ];
  const label = (n: MapNode) =>
    n.type === "fight" || n.type === "boss"
      ? NPCS[n.npc ?? "auntie"].name
      : { event: "奇遇", shop: "士多", rest: "糖水铺" }[n.type as "event" | "shop" | "rest"];
  const nodes = run.map
    .map((n) => {
      const p = pos(n);
      const cls = [
        n.type,
        reach.includes(n.id) ? "can" : "",
        run.visited.includes(n.id) ? "past" : "",
        run.at === n.id ? "here" : ""
      ].join(" ");
      return `<button class="mn ${cls}" style="left:${p.x}px;top:${p.y}px" data-act="go" data-id="${n.id}" ${reach.includes(n.id) ? "" : "disabled"}><span>${glyph(n)}</span><small>${label(n)}</small></button>`;
    })
    .join("");
  return `<div class="screen map">${hud(run)}
    <div class="maptitle"><small>第一章 · 茶餐厅一条街</small><div>午市前，搞掂成条街嘅街坊</div></div>
    <div class="mapwrap"><div class="mapbox" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}">${lines}</svg>${nodes}</div></div>
    <div class="legend"><span><b class="pink">婶</b>街坊</span><span><b class="cyan">?</b>奇遇</span><span><b class="amber">士</b>士多</span><span><b class="green">糖</b>糖水铺</span></div>
    <button class="link" data-act="deck">睇卡组（${run.deck.length}）</button>
  </div>`;
}

function battleScreen(run: Run): string {
  const c = run.combat;
  if (!c) return "";
  const npc = NPCS[c.npc];
  const intent = currentIntent(run);
  const pct = Math.round((c.progress / c.target) * 100);
  const patPct = Math.round((run.patience / run.maxPatience) * 100);
  const selCard = ui.sel !== null ? CARDS[c.hand[ui.sel]] : null;
  const answeredBadge = c.answered ? `<div class="answered">✓ 接住咗！呢句唔扣耐心</div>` : "";
  const hint = intent?.need
    ? `💡 佢「${intent.label}」→ 用带 ✓ 嘅句子卡接住，唔扣耐心、说服 ×1.5`
    : `💡 佢「${intent?.label}」→ 出「稳住」卡抵挡`;
  const n = c.hand.length;
  const hand = c.hand
    .map((id, i) => {
      const room = Math.min(430, window.innerWidth) - 110;
      const gap = n > 1 ? Math.min(74, room / (n - 1)) : 0;
      const rot = (i - (n - 1) / 2) * (n > 4 ? 4 : 6);
      const x = (i - (n - 1) / 2) * gap;
      return `<div class="slot" style="transform:translateX(${x}px) rotate(${rot}deg)">${cardHtml(id, { idx: i, sel: ui.sel === i, run })}</div>`;
    })
    .join("");
  const take = ui.lastTake;
  const takeBox = take
    ? `<div class="take ${take.score === null ? "" : take.score >= 70 ? "good" : "mid"}"><div><b>${take.score === null ? "收音唔够清楚" : take.score >= 70 ? `声调贴合 ${take.score} · 暴击！` : `声调 ${take.score} · 普通效果`}</b><small>${take.score === null ? "按普通效果出咗" : "青线＝目标走势　粉线＝你把声"}</small></div>${curveSvg(take.user, take.tpl)}</div>`
    : "";
  const micbar = selCard
    ? `<div class="microw">
        <button class="micbar${ui.recording ? " rec" : ""}" data-act="mic" ${MicSession.supported ? "" : "disabled"}>
          <svg width="22" height="28" viewBox="0 0 34 44"><rect x="9" y="2" width="16" height="26" rx="8" fill="#fff"/><path d="M3 20 a14 14 0 0 0 28 0" stroke="#fff" stroke-width="3.4" fill="none"/><path d="M17 34v8" stroke="#fff" stroke-width="3.4"/></svg>
          <div><b>${ui.recording ? "讲紧……松手出牌" : `按住读「${esc(selCard.phrase)}」`}</b><small>${MicSession.supported ? "声调贴合 → 暴击 ×2" : "需要 HTTPS 先用到咪"}</small></div>
        </button>
        <div class="side"><button class="mini" data-act="hear" data-id="${selCard.id}">▶ 听</button><button class="mini" data-act="tap">直接出</button></div>
      </div>`
    : `<div class="microw idle">揀一张卡 → 按住咪读出嚟</div>`;
  return `<div class="screen battle">
    <div class="relics top">${run.relics.map((r) => `<button class="relic" data-act="relic" data-id="${r}">${RELICS[r].glyph}</button>`).join("")}<span class="turn">第 ${c.turn} 回合</span></div>
    <div class="scene${npc.boss ? " boss" : ""}${c.enraged ? " rage" : ""}">
      <div class="neon sign">${npc.sign}</div>
      <div class="intent"><button class="play" data-act="hearIntent">▶</button><b>${esc(intent?.line ?? "")}</b><small class="gloss" data-act="gloss">${esc(intent?.gloss ?? "")}</small><small>意图：${intent?.label}　<span class="loss">耐心 −${intent?.loss}</span></small></div>
      <img class="npc" src="${art(npc.img)}" alt="${npc.name}">
      ${answeredBadge}
      ${ui.float ? `<div class="float ${ui.float.cls}">${ui.float.text}</div>` : ""}
      <div class="meter npcm"><span class="t">${npc.name} · 说服</span><span class="b"><i style="width:${pct}%"></i></span><span class="v">${c.progress}/${c.target}</span></div>
    </div>
    <div class="hint">${hint}</div>
    <div class="me"><div class="mana">${c.energy}<small>底气</small></div>
      <div class="meter"><span class="t pink">我的耐心</span><span class="b pat"><i style="width:${patPct}%"></i></span><span class="v">${run.patience}</span></div>
      ${c.block ? `<div class="block">🛡 ${c.block}</div>` : ""}
      <button class="endturn" data-act="end">结束回合</button></div>
    ${takeBox}
    <div class="hand">${hand}</div>
    ${micbar}
    <div class="piles">抽牌堆 ${c.draw.length} · 弃牌堆 ${c.discard.length}</div>
  </div>`;
}

function rewardScreen(run: Run): string {
  const c = run.combat;
  const npc = c ? NPCS[c.npc] : NPCS.auntie;
  const cards = ui.reward.map((id) => cardHtml(id, { act: "pick" })).join("");
  const ad = ui.adUsed
    ? ""
    : `<button class="adpick" data-act="ad"><span class="tv">▶</span>看段广告<br>多开 1 张<small>原型：唔会真播</small></button>`;
  return `<div class="screen reward">
    <img class="winimg" src="${art(npc.img)}" alt="">
    <div class="quote">「${esc(npc.win)}」</div>
    <div class="win">${npc.name} · 被你说服</div>
    <div class="loot"><span class="amber">$ +${ui.rewardGold}</span><span class="cyan">开口 ${c?.spoken ?? 0} 句</span><span class="pink">暴击 ${c?.crits ?? 0} 次</span></div>
    <div class="pickt">选一张句子卡加入卡组</div>
    <div class="pick">${cards}${ad}</div>
    <button class="btn ghost" data-act="skip">唔要，继续行街</button>
  </div>`;
}

function shopScreen(run: Run): string {
  const s = ui.shop;
  const cards = s.cards
    .map((id) =>
      s.bought.includes(id)
        ? `<div class="sold">已买</div>`
        : cardHtml(id, { act: "buy", price: CARDS[id].rarity === "rare" ? 45 : 25 })
    )
    .join("");
  const relic =
    s.relic && !s.bought.includes(s.relic)
      ? `<button class="relicshop" data-act="buyRelic"><span class="relic big">${RELICS[s.relic].glyph}</span><div><b>${RELICS[s.relic].name}</b><small>${RELICS[s.relic].desc}</small></div><span class="price">$60</span></button>`
      : "";
  return `<div class="screen shop">${hud(run)}<h2 class="amber">士多 · 买句子，买密码</h2><div class="pick wrap">${cards}</div>${relic}
    <button class="btn ghost" data-act="leave">行出去</button></div>`;
}

function restScreen(run: Run): string {
  return `<div class="screen rest">${hud(run)}<h2 class="green">糖水铺 · 坐低抖下</h2>
    <button class="choice" data-act="heal"><b>饮碗红豆沙</b><small>耐心 +12</small></button>
    <div class="gradt">或者：揀一句你已经识讲嘅，<b>毕业</b>离开卡组（卡组更精）</div>
    <div class="pick wrap">${[...new Set(run.deck)].map((id) => cardHtml(id, { act: "grad" })).join("")}</div></div>`;
}

function eventScreen(run: Run): string {
  const ev = EVENTS[ui.event.idx];
  let body = "";
  if (ev.reward === "card" && ui.event.card)
    body = `<div class="pick">${cardHtml(ui.event.card, { act: "evCard" })}</div><small class="dim">点张卡收下（点 ▶ 可以听）</small>`;
  if (ev.reward === "gold")
    body = `<button class="choice" data-act="evOk"><b>收下</b><small>港纸 +20</small></button>`;
  if (ev.reward === "heal")
    body = `<button class="choice" data-act="evOk"><b>饮埋佢</b><small>耐心 +8</small></button>`;
  return `<div class="screen event">${hud(run)}<h2 class="cyan">奇遇 · ${ev.title}</h2><p class="evtext">${ev.text}</p>${body}
    ${ev.reward === "card" && ui.event.card ? `<button class="mini wide" data-act="hear" data-id="${ui.event.card}">▶ 听老伯讲</button>` : ""}</div>`;
}

function endScreen(win: boolean, run: Run): string {
  return `<div class="screen end">
    <img class="winimg" src="${art(win ? "boss.png" : "auntie.png")}" alt="">
    <h2 class="${win ? "amber" : "pink"}">${win ? "午市都搞掂！成条街都识你" : "耐心用晒……"}</h2>
    <p class="dim">${win ? "第一章完成。你用粤语说服咗成条街。" : "唔紧要，讲错先会进步。"}</p>
    <div class="loot"><span class="cyan">卡组 ${run.deck.length} 张</span><span class="green">毕业 ${run.graduated.length} 句</span></div>
    ${!win && !ui.revived ? `<button class="btn ad" data-act="revive">▶ 看段广告 · 深呼吸再嚟过<small>原型：唔会真播</small></button>` : ""}
    <button class="btn ok" data-act="new">再行一次</button>
  </div>`;
}

/* ---------- 流程 ---------- */
function goNode(id: string): void {
  const run = ui.run;
  if (!run) return;
  const node = run.map.find((n) => n.id === id);
  if (!node) return;
  run.at = id;
  run.visited.push(id);
  ui.sel = null;
  ui.lastTake = null;
  if (node.type === "fight" || node.type === "boss") {
    startCombat(run, node.npc ?? "auntie");
    ui.screen = "battle";
  } else if (node.type === "shop") {
    ui.shop = { cards: rewardChoices(run, 4), relic: relicOffer(run), bought: [] };
    ui.screen = "shop";
  } else if (node.type === "rest") ui.screen = "rest";
  else {
    const r = nextRand(run);
    const idx = Math.floor(r() * EVENTS.length);
    ui.event = {
      idx,
      card: EVENTS[idx].reward === "card" ? rewardChoices(run, 1)[0] : undefined,
      done: false
    };
    ui.screen = "event";
  }
}

function afterWin(): void {
  const run = ui.run;
  if (!run?.combat) return;
  const boss = NPCS[run.combat.npc].boss;
  if (boss) {
    ui.screen = "win";
    return;
  }
  ui.rewardGold = 12 + Math.floor(nextRand(run)() * 10);
  run.gold += ui.rewardGold;
  ui.reward = rewardChoices(run);
  ui.adUsed = false;
  ui.screen = "reward";
}

function flash(text: string, cls: string): void {
  ui.float = { text, cls };
  setTimeout(() => {
    ui.float = null;
    render();
  }, 1100);
}

function doPlay(crit: boolean, spoke: boolean): void {
  const run = ui.run;
  if (!run || ui.sel === null) return;
  const res = playCard(run, ui.sel, crit, spoke);
  if (!res.ok) {
    toast(res.reason ?? "出唔到");
    return;
  }
  ui.sel = null;
  const parts = [];
  if (res.persuade) parts.push(`说服 +${res.persuade}`);
  if (res.calm) parts.push(`🛡 ${res.calm}`);
  flash(
    `${res.crit ? "暴击！" : ""}${res.answered ? "接住！" : ""}${parts.join(" ")}`,
    res.crit ? "crit" : "norm"
  );
  if (res.won)
    setTimeout(() => {
      afterWin();
      save();
      render();
    }, 700);
}

async function micDown(): Promise<void> {
  const run = ui.run;
  if (!run?.combat || ui.sel === null || ui.recording) return;
  const card = CARDS[run.combat.hand[ui.sel]];
  if (card.cost > run.combat.energy) {
    toast("底气唔够");
    return;
  }
  try {
    ui.recording = true;
    render();
    await mic.start();
  } catch {
    ui.recording = false;
    toast("开唔到咪：请允许麦克风，或者用「直接出」");
    render();
  }
}

async function micUp(): Promise<void> {
  const run = ui.run;
  if (!ui.recording || !run?.combat || ui.sel === null) return;
  ui.recording = false;
  const card = CARDS[run.combat.hand[ui.sel]];
  const take = await mic.stop(card.jp);
  if (take.durationMs < 350) {
    toast("按住讲完先松手");
    render();
    return;
  }
  const score = take.detail?.score ?? null;
  ui.lastTake = { score, user: take.detail?.userCurve ?? [], tpl: take.detail?.template ?? [] };
  doPlay(score !== null && score >= 70, true);
  render();
}

function onClick(e: Event): void {
  const el = (e.target as HTMLElement).closest("[data-act]") as HTMLElement | null;
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id ?? "";
  const run = ui.run;
  switch (act) {
    case "new":
      ui.run = newRun();
      ui.revived = false;
      ui.screen = "map";
      break;
    case "resume": {
      const s = load();
      if (s) {
        ui.run = s.run;
        ui.screen = s.screen === "battle" && !s.run.combat ? "map" : s.screen;
        if (["reward", "shop", "event"].includes(ui.screen)) ui.screen = "map";
      }
      break;
    }
    case "go":
      goNode(id);
      break;
    case "relic":
      toast(`${RELICS[id].name}：${RELICS[id].desc}`);
      break;
    case "deck":
      if (run) toast(`卡组：${run.deck.map((d) => CARDS[d].phrase).join("、")}`);
      break;
    case "sel": {
      const idx = Number(el.dataset.idx);
      if (ui.screen !== "battle") break;
      ui.sel = ui.sel === idx ? null : idx;
      if (ui.sel !== null && run?.combat) say(CARDS[run.combat.hand[idx]].phrase);
      break;
    }
    case "hear":
      say(CARDS[id].phrase, 0.85);
      return;
    case "hearIntent": {
      const it = run ? currentIntent(run) : null;
      if (it) say(it.line);
      return;
    }
    case "tap":
      doPlay(false, false);
      break;
    case "end": {
      if (!run?.combat) break;
      ui.sel = null;
      ui.lastTake = null;
      const r = endTurn(run);
      if (r.lost) ui.screen = "lose";
      else {
        flash(
          r.answered ? "接住咗，冇扣耐心" : r.loss ? `耐心 −${r.loss}` : "稳住晒！",
          r.loss ? "hurt" : "norm"
        );
        if (r.enragedNow) toast("部长姐：「仲有排啊！」（Boss 加速，意图更重）");
      }
      break;
    }
    case "pick":
      if (run) run.deck.push(id);
      ui.screen = "map";
      toast(`「${CARDS[id].phrase}」加入卡组`);
      break;
    case "skip":
    case "leave":
      ui.screen = "map";
      break;
    case "ad":
      if (run) {
        ui.adUsed = true;
        ui.reward.push(rewardChoices(run, 1)[0]);
        toast("（广告位占位：正式版喺度播激励视频）");
      }
      break;
    case "revive":
      if (run?.combat) {
        ui.revived = true;
        run.patience = Math.round(run.maxPatience / 2);
        ui.screen = "battle";
        toast("深呼吸……耐心回返一半（广告位占位）");
      }
      break;
    case "buy": {
      if (!run) break;
      const price = CARDS[id].rarity === "rare" ? 45 : 25;
      if (run.gold < price) {
        toast("港纸唔够");
        break;
      }
      run.gold -= price;
      run.deck.push(id);
      ui.shop.bought.push(id);
      break;
    }
    case "buyRelic":
      if (!run || !ui.shop.relic) break;
      if (run.gold < 60) {
        toast("港纸唔够");
        break;
      }
      run.gold -= 60;
      run.relics.push(ui.shop.relic);
      ui.shop.bought.push(ui.shop.relic);
      break;
    case "heal":
      if (run) run.patience = Math.min(run.maxPatience, run.patience + 12);
      ui.screen = "map";
      break;
    case "grad":
      if (run) {
        const i = run.deck.indexOf(id);
        if (i >= 0 && run.deck.length > 5) {
          run.deck.splice(i, 1);
          run.graduated.push(id);
          toast(`🎓「${CARDS[id].phrase}」毕业！`);
          ui.screen = "map";
        } else toast("卡组最少要留 5 张");
      }
      break;
    case "evCard":
      if (run) run.deck.push(id);
      ui.screen = "map";
      break;
    case "evOk": {
      if (!run) break;
      const ev = EVENTS[ui.event.idx];
      if (ev.reward === "gold") run.gold += 20;
      if (ev.reward === "heal") run.patience = Math.min(run.maxPatience, run.patience + 8);
      ui.screen = "map";
      break;
    }
    default:
      return;
  }
  save();
  render();
}

function render(): void {
  const run = ui.run;
  let html = "";
  if (ui.screen === "title" || !run) html = titleScreen();
  else if (ui.screen === "map") html = mapScreen(run);
  else if (ui.screen === "battle") html = battleScreen(run);
  else if (ui.screen === "reward") html = rewardScreen(run);
  else if (ui.screen === "shop") html = shopScreen(run);
  else if (ui.screen === "rest") html = restScreen(run);
  else if (ui.screen === "event") html = eventScreen(run);
  else html = endScreen(ui.screen === "win", run);
  root.innerHTML = `<div class="phone">${html}${ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : ""}</div>`;
}

root.addEventListener("click", onClick);
root.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest('[data-act="mic"]')) {
    e.preventDefault();
    void micDown();
  }
});
window.addEventListener("pointerup", () => void micUp());
window.addEventListener("pointercancel", () => void micUp());
if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();
render();
