// 声震龙楼 · 微信小游戏版 —— S1 骨架 + S2 Canvas 渲染层
import { GameEngine, NODE_META } from './js/engine.js';
import { getSkill, MAX_FLOOR } from './js/data.js';
import { saveGame, loadGame, hasSave } from './js/storage.js';
import { setKeepScreenOn, vibrate } from './js/platform.js';

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const sys = wx.getSystemInfoSync();
const DPR = Math.min(sys.pixelRatio || 2, 3);
const VW = 390, VH = 844;
canvas.width = VW * DPR; canvas.height = VH * DPR;
ctx.scale(DPR, DPR);

const engine = new GameEngine();
let regions = [];
let toast = null;

const saved = loadGame();
if (saved && saved.state && saved.state.phase !== 'title') engine.load(saved.state);
setKeepScreenOn();
wx.onHide(() => { try { saveGame(engine.state); } catch (e) {} });

function C(x) { return x; }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function bg() { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#141a22'); g.addColorStop(1, '#0c1015'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
function txt(s, x, y, size, color, bold) { ctx.fillStyle = color || '#e8e2d0'; ctx.font = (bold ? 'bold ' : '') + size + 'px sans-serif'; ctx.fillText(s, x, y); }
function wrap(s, x, y, maxW, size, color, lh) { ctx.font = size + 'px sans-serif'; ctx.fillStyle = color || '#e8e2d0'; let line = '', yy = y; for (const ch of s) { if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, yy); line = ch; yy += (lh || size + 6); } else line += ch; } ctx.fillText(line, x, yy); return yy + (lh || size + 6); }
function btn(id, label, x, y, w, h, tone, arg) {
  const tones = { gold: ['#c9a227', '#1a1503'], red: ['#a63d40', '#fdf0ef'], green: ['#3f7d54', '#eef7f0'], blue: ['#3d6ea6', '#eef3fb'], violet: ['#6b5ca5', '#f0edfa'], dark: ['#2a3440', '#d7dee6'] };
  const [fill, fg] = tones[tone] || tones.dark;
  ctx.fillStyle = fill; rr(x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = fg; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + h / 2 + 6); ctx.textAlign = 'left';
  regions.push({ x, y, w, h, action: id, arg });
}
function hpbar(x, y, w, cur, max, color) { ctx.fillStyle = '#262e38'; rr(x, y, w, 10, 5); ctx.fill(); ctx.fillStyle = color || '#a63d40'; if (cur > 0) { rr(x, y, Math.max(6, w * Math.min(1, cur / max)), 10, 5); ctx.fill(); } }
function topbar(title, sub) {
  ctx.fillStyle = '#0a0d11'; ctx.fillRect(0, 0, VW, 64);
  txt(title, 20, 30, 19, '#e8e2d0', true);
  if (sub) txt(sub, 20, 52, 13, '#8b95a1');
  const p = engine.state.player;
  if (p) { txt('气 ' + p.hp + '/' + p.maxHp, VW - 150, 30, 14, '#e08585', true); txt('银 ' + p.gold, VW - 150, 52, 13, '#c9a227'); hpbar(VW - 66, 22, 48, p.hp, p.maxHp); }
}
function noticeArea() { if (toast) { ctx.fillStyle = 'rgba(201,162,39,.15)'; rr(16, VH - 74, VW - 32, 44, 10); ctx.fill(); txt(toast, 30, VH - 46, 14, '#c9a227'); } }

function renderTitle() {
  txt('声震龙楼', 20, 240, 46, '#e8e2d0', true);
  txt('粤语声攻 · 十层 Roguelike', 22, 282, 16, '#c9a227');
  txt('以声为刃，登塔震龙。', 22, 312, 14, '#8b95a1');
  btn('new-run', '开始新旅程', 60, 420, 270, 58, 'gold');
  if (hasSave()) btn('continue-run', '继续上次进度', 60, 496, 270, 58, 'green');
  txt('v2.0 minigame', 20, VH - 30, 12, '#5a6470');
}
function renderTower() {
  const s = engine.state; const p = s.player;
  topbar('第 ' + s.floor + ' / ' + MAX_FLOOR + ' 层 · ' + engine.getFloorName(), '声韵 ' + p.voiceMastery + ' · 均分 ' + engine.getAverageVoiceScore());
  let y = 96;
  (s.floorOptions || []).forEach(op => {
    const m = NODE_META[op.type] || {};
    ctx.fillStyle = '#1c242e'; rr(20, y, VW - 40, 96, 14); ctx.fill();
    ctx.fillStyle = m.tone === 'gold' ? '#c9a227' : m.tone === 'red' ? '#a63d40' : m.tone === 'violet' ? '#6b5ca5' : '#3f7d54';
    rr(36, y + 20, 52, 52, 10); ctx.fill();
    ctx.fillStyle = '#101418'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(m.mark || '?', 62, y + 54); ctx.textAlign = 'left';
    txt(m.label || op.label || op.type, 104, y + 36, 18, '#e8e2d0', true);
    txt(m.hint || '', 104, y + 62, 13, '#8b95a1');
    regions.push({ x: 20, y, w: VW - 40, h: 96, action: 'choose-floor', arg: op.id });
    y += 110;
  });
}
function renderBattle() {
  const s = engine.state; const c = s.combat; const e = c.enemy;
  topbar('街巷战 · 回合 ' + c.turn, '灵力 ' + c.energy + '/3');
  ctx.fillStyle = '#241a1c'; rr(20, 84, VW - 40, 92, 14); ctx.fill();
  txt(e.name + (e.weakness ? '（弱' + e.weakness + '）' : ''), 36, 112, 17, '#e08585', true);
  hpbar(36, 126, VW - 96, e.hp, e.maxHp);
  txt(e.hp + '/' + e.maxHp, 36, 158, 13, '#c7ccd3');
  const it = engine.getIntentPreview();
  txt('意图：' + (it ? it.label + ' ' + it.detail : '—'), 150, 158, 13, '#c9a227');
  let y = 196;
  c.hand.forEach(card => {
    const sk = getSkill(card.id);
    const usable = engine.canUseSkill(card.id);
    ctx.fillStyle = usable ? '#1f2a36' : '#161c23'; rr(20, y, VW - 40, 64, 12); ctx.fill();
    txt(sk ? sk.name : card.id, 34, y + 27, 16, usable ? '#e8e2d0' : '#5a6470', true);
    txt('耗 ' + (sk ? sk.cost : '?') + ' · ' + (sk ? (sk.type || '') : ''), 34, y + 50, 12, '#8b95a1');
    regions.push({ x: 20, y, w: VW - 40, h: 64, action: 'play-skill', arg: card.id });
    y += 72;
  });
  btn('placeholder-voice', '📣 喊招（暂用占位评分）', 20, VH - 148, VW - 40, 46, 'violet');
  btn('end-turn', '结束回合', 20, VH - 92, VW - 40, 46, 'dark');
  const log = (c.log || []).slice(0, 2);
  log.forEach((l, i) => txt(l, 20, VH - 200 + i * 0, 0, '#000'));
}
function renderReward() {
  const s = engine.state; const r = s.reward;
  topbar('战利品', '+' + r.gold + ' 银两');
  txt('习得一式新招：', 22, 116, 16);
  let y = 140;
  (r.choices || []).forEach(id => {
    const sk = getSkill(id);
    ctx.fillStyle = '#1c242e'; rr(20, y, VW - 40, 84, 14); ctx.fill();
    txt(sk ? sk.name : id, 36, y + 34, 17, '#c9a227', true);
    txt(sk && sk.hint ? sk.hint : '', 36, y + 60, 12, '#8b95a1');
    regions.push({ x: 20, y, w: VW - 40, h: 84, action: 'choose-reward', arg: id });
    y += 96;
  });
  btn('skip-reward', '都不学，继续', 60, y + 8, 270, 48, 'dark');
}
function renderEvent() {
  const s = engine.state; const ev = s.event;
  topbar('奇遇 · ' + ev.name);
  const endY = wrap(ev.text || '', 24, 116, VW - 48, 15, '#d7dee6');
  let y = Math.max(endY + 18, 200);
  (ev.choices || []).forEach(ch => {
    ctx.fillStyle = '#1c242e'; rr(20, y, VW - 40, 60, 12); ctx.fill();
    txt(ch.label, 36, y + 36, 15);
    regions.push({ x: 20, y, w: VW - 40, h: 60, action: 'choose-event', arg: ch.id });
    y += 72;
  });
  if (ev.resolved) { ctx.fillStyle = '#1a2330'; rr(20, y, VW - 40, 80, 12); ctx.fill(); wrap(ev.outcome || '', 34, y + 28, VW - 68, 14, '#c9a227'); btn('leave-event', '离开', 20, y + 96, VW - 40, 46, 'dark'); }
}
function renderRest() {
  topbar('歇脚处');
  btn('rest-heal', '疗伤（回复30%气血）', 40, 160, 310, 56, 'green');
  btn('rest-practice', '练声（声韵+3）', 40, 232, 310, 56, 'blue');
  btn('rest-fortify', '强身（气血上限+5）', 40, 304, 310, 56, 'gold');
}
function renderShop() {
  const s = engine.state; const sh = s.shop;
  topbar('夜市', '银两 ' + s.player.gold);
  let y = 96;
  (sh.offers || []).forEach(o => {
    if (o.sold) { ctx.fillStyle = '#131920'; rr(20, y, VW - 40, 72, 12); ctx.fill(); txt('已售', 36, y + 40, 14, '#5a6470'); }
    else {
      const nm = o.type === 'skill' ? (getSkill(o.id) || {}).name : o.id;
      ctx.fillStyle = '#1c242e'; rr(20, y, VW - 40, 72, 12); ctx.fill();
      txt((o.type === 'skill' ? '招式' : o.type === 'item' ? '道具' : '遗物') + ' · ' + nm, 36, y + 30, 15, '#e8e2d0', true);
      txt(o.price + ' 银两', 36, y + 54, 13, '#c9a227');
      regions.push({ x: 20, y, w: VW - 40, h: 72, action: 'buy-offer', arg: o.key });
    }
    y += 84;
  });
  btn('leave-shop', '离开夜市', 60, y + 6, 270, 48, 'dark');
}
function renderEnd(victory) {
  const s = engine.state; const sum = engine.getRunSummary();
  topbar(victory ? '声震龙楼！' : '力竭而止');
  txt(victory ? '第十层之巅，你的声浪震彻全城。' : '这一程到此为止。', 22, 130, 15, '#d7dee6');
  const rows = [['到达层数', sum.floor], ['胜敌', sum.enemies], ['强敌', sum.elites], ['平均评分', sum.averageScore], ['最佳评分', sum.bestScore], ['输出', sum.damage], ['习得', sum.skills]];
  let y = 180;
  rows.forEach(([k, v]) => { txt(String(k), 40, y, 15, '#8b95a1'); txt(String(v), VW - 60, y, 17, '#e8e2d0', true); y += 40; });
  btn('new-run', '再来一局', 60, y + 16, 270, 54, 'gold');
  btn('show-title', '回到标题', 60, y + 84, 270, 48, 'dark');
}

function render() {
  regions = [];
  bg();
  const s = engine.state;
  switch (s.phase) {
    case 'title': renderTitle(); break;
    case 'tower': renderTower(); break;
    case 'battle': renderBattle(); break;
    case 'reward': renderReward(); break;
    case 'event': renderEvent(); break;
    case 'rest': renderRest(); break;
    case 'shop': renderShop(); break;
    case 'victory': renderEnd(true); break;
    case 'defeat': renderEnd(false); break;
  }
  noticeArea();
}

function act(a, arg) {
  toast = null;
  switch (a) {
    case 'new-run': engine.startNew(); break;
    case 'continue-run': { const sv = loadGame(); if (sv) engine.load(sv.state); break; }
    case 'show-title': engine.showTitle(); break;
    case 'choose-floor': engine.chooseFloorOption(arg); break;
    case 'play-skill': {
      if (!engine.canUseSkill(arg)) { toast = '灵力不足或时机不对。'; render(); return; }
      const score = 55 + Math.floor(Math.random() * 41);
      const r = engine.resolveSkill(arg, score, { source: 'placeholder' });
      if (r) toast = '评分 ' + r.score + '（占位）· ' + (r.tier ? r.tier.label : '');
      break;
    }
    case 'placeholder-voice': { toast = '语音识别待接入（S3）。点卡牌用占位评分出招。'; break; }
    case 'end-turn': engine.endTurn(); break;
    case 'choose-reward': engine.chooseReward(arg || null); break;
    case 'skip-reward': engine.chooseReward(null); break;
    case 'choose-event': engine.resolveEvent(arg); break;
    case 'leave-event': engine.leaveEvent(); break;
    case 'rest-heal': engine.rest('heal'); break;
    case 'rest-practice': engine.rest('practice'); break;
    case 'rest-fortify': engine.rest('fortify'); break;
    case 'buy-offer': engine.buyOffer(arg); break;
    case 'leave-shop': engine.leaveShop(); break;
  }
  if (engine.state.notice) { toast = engine.state.notice; engine.state.notice = null; }
  render();
}

let dbg = null;
wx.onTouchStart(e => {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!t) return;
  const rx = t.clientX / sys.windowWidth, ry = t.clientY / sys.windowHeight;
  dbg = { x: rx * VW, y: ry * VH, raw: Math.round(t.clientX) + 'x' + Math.round(t.clientY) + ' win:' + Math.round(sys.windowWidth) + 'x' + Math.round(sys.windowHeight) + ' canvas:' + canvas.width + 'x' + canvas.height };
  let hit = null;
  for (const r of regions) { if (rx * VW >= r.x && rx * VW <= r.x + r.w && ry * VH >= r.y && ry * VH <= r.y + r.h) { hit = r; break; } }
  if (hit) { vibrate('light'); act(hit.action, hit.arg); } else { render(); }
  if (dbg) { ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dbg.x - 14, dbg.y); ctx.lineTo(dbg.x + 14, dbg.y); ctx.moveTo(dbg.x, dbg.y - 14); ctx.lineTo(dbg.x, dbg.y + 14); ctx.stroke(); txt(dbg.raw, 16, VH - 12, 11, '#ff3355'); }
});
engine.subscribe(() => render());
render();