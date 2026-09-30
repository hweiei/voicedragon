import { CHAPTERS, chapterUnlocked } from "../../../src/street/chapters";
import { CARDS, EVENTS, NPCS, RELICS } from "../../../src/street/data";
import { dueCards } from "../../../src/street/mastery";
/** 屏幕模块（H-01 阶段4.2 自 game.ts 迁出）。仅经 GameCtx 访问状态与平台。 */
import { assetPath } from "../audio-manifest";
import { C, MONO } from "../draw";
import type { GameCtx } from "./ctx";
import { HOME_CAST, backBar, cardGrid, drawCard, effectText, hear, hud, title } from "./shared";

export function homeScreen(gc: GameCtx, t: number): void {
  const heroH = Math.round(Math.min(gc.H * (gc.H < 720 ? 0.33 : 0.4), gc.W * 0.78));
  gc.g.cover(gc.p.loadImage(assetPath("street/bg/cafe.jpg")), 0, 0, gc.W, heroH);
  gc.g.vfade(0, heroH * 0.45, gc.W, heroH * 0.55 + 1, "rgba(11,13,26,0)", C.bg);
  // 品牌
  gc.g.glow(C.pink, 12, () => gc.g.rr(14, gc.top, 38, 38, 9, "rgba(11,13,26,.6)", C.pink, 2));
  gc.g.text("龍", 33, gc.top + 27, { size: 22, weight: "900", color: C.pink, align: "center" });
  gc.g.text("声震龙楼", 60, gc.top + 18, { size: 17, weight: "bold" });
  const dueN = dueCards(gc.prof.mastery, Date.now(), 99).length;
  gc.g.text(
    dueN
      ? `街坊篇 · 已通关 ${gc.prof.cleared.length} / ${CHAPTERS.length} 区 · 今日温习 ${dueN} 句`
      : `街坊篇 · 已通关 ${gc.prof.cleared.length} / ${CHAPTERS.length} 区`,
    60,
    gc.top + 35,
    { size: 12, color: dueN ? C.amber : "#cfd3f5" }
  );
  // 霓虹招牌（「茶」字接触不良）
  const nx = gc.W - 46;
  gc.g.glow(C.cyan, 12, () => gc.g.rr(nx, gc.top, 32, 96, 7, "rgba(11,13,26,.55)", C.cyan, 2));
  const flick = t % 4500 > 900 && t % 4500 < 1050;
  ["龍", "樓", "茶", "記"].forEach((ch, i) => {
    const on = !(i === 2 && flick);
    gc.g.glow(on ? C.pink : "transparent", on ? 10 : 0, () =>
      gc.g.text(ch, nx + 16, gc.top + 22 + i * 22, {
        size: 18,
        weight: "900",
        color: on ? "#ffe9f1" : "#6b5360",
        align: "center"
      })
    );
  });
  // 街坊（可点）
  const heights = [heroH * 0.42, heroH * 0.5, heroH * 0.42];
  const slotW = Math.min(130, gc.W / 3);
  HOME_CAST.forEach((id, i) => {
    const bob = Math.sin(t / 500 + i) * 3;
    const x = gc.W / 2 + (i - 1) * slotW * 0.92 - slotW / 2;
    const h = heights[i];
    const y = heroH - h - 6 + bob;
    gc.g.img(gc.p.loadImage(assetPath(`street/${NPCS[id].img}`)), x, y, slotW, h, "bottom");
    gc.g.region(x + slotW * 0.15, y, slotW * 0.7, h, "talk", id);
    if (gc.s.talk?.id === id && gc.s.talk.until > t) {
      const line = NPCS[id].intents[0].line;
      const tw = Math.min(gc.W - 24, gc.g.measure(line, 14, "bold") + 20);
      const bx = Math.max(12, Math.min(gc.W - 12 - tw, x + slotW / 2 - tw / 2));
      const by = y - 34;
      gc.g.rr(bx, by + 3, tw, 28, 12, C.pink);
      gc.g.rr(bx, by, tw, 28, 12, "#fff");
      gc.g.text(line, bx + tw / 2, by + 19, {
        size: 14,
        weight: "bold",
        color: C.ink,
        align: "center"
      });
    }
  });
  gc.g.text("点街坊，听佢讲句", gc.W - 12, heroH - 10, {
    size: 12,
    color: "#cfd3f5",
    align: "right"
  });

  let y = heroH + 30;
  gc.g.text("用粤语，搞掂成条街", gc.W / 2, y, { size: 24, weight: "900", align: "center" });
  y += 24;
  gc.g.text("听懂街坊讲乜 → 出啱句子 → 开口讲出嚟", gc.W / 2, y, {
    size: 13,
    color: C.cyan,
    align: "center"
  });
  // 街道进度
  y += 22;
  const stops = Object.values(NPCS).filter((n) => !n.hidden);
  const stepW = (gc.W - 32) / stops.length;
  stops.forEach((n, i) => {
    const cx = 16 + stepW * (i + 0.5);
    const st = gc.prof.beaten[n.id] ? "done" : gc.prof.met.includes(n.id) ? "met" : "";
    if (i > 0) {
      gc.g.ctx.setLineDash([4, 4]);
      gc.g.ctx.strokeStyle = C.dim;
      gc.g.ctx.beginPath();
      gc.g.ctx.moveTo(cx - stepW + 26, y + 12);
      gc.g.ctx.lineTo(cx - 26, y + 12);
      gc.g.ctx.stroke();
      gc.g.ctx.setLineDash([]);
    }
    const tw = gc.g.measure(n.sign, 12) + 12;
    const fill = st === "done" ? C.amber : undefined;
    const col = st === "done" ? C.ink : st === "met" ? C.cyan : C.dim;
    gc.g.rr(
      cx - tw / 2,
      y,
      tw,
      24,
      6,
      fill,
      st === "done" ? C.amber : st === "met" ? C.cyan : C.line
    );
    gc.g.text(n.sign, cx, y + 17, { size: 12, color: col, align: "center" });
  });
  // 今日一句
  y += 36;
  const d = CARDS[dailyCard(gc)];
  gc.g.rr(16, y, gc.W - 32, 70, 14, "rgba(255,79,139,.12)", "rgba(255,79,139,.5)");
  gc.g.text("今日一句", 28, y + 18, { size: 12, color: C.pink });
  gc.g.text(d.phrase, 28, y + 40, { size: 18, weight: "bold" });
  gc.g.text(`${d.jp}  ·  ${d.meaning}`, 28, y + 59, { size: 11, color: C.dim });
  gc.g.glow(C.pink, 10, () => {
    gc.g.ctx.beginPath();
    gc.g.ctx.arc(gc.W - 44, y + 35, 17, 0, Math.PI * 2);
    gc.g.ctx.fillStyle = C.pink;
    gc.g.ctx.fill();
  });
  gc.g.text("▶", gc.W - 43, y + 41, { size: 14, color: "#fff", align: "center" });
  gc.g.region(16, y, gc.W - 32, 70, "hearCard", d.id);
  // 统计
  y += 82;
  const stats: [string, string][] = [
    [String(gc.prof.runs), "行街"],
    [String(gc.prof.wins), "通关"],
    [String(gc.prof.spoken), "开口"],
    [`${gc.prof.seen.length}/${Object.keys(CARDS).length}`, "识得"]
  ];
  const sw = (gc.W - 32 - 24) / 4;
  stats.forEach(([v, l], i) => {
    const x = 16 + i * (sw + 8);
    gc.g.rr(x, y, sw, 50, 10, C.panel, C.line);
    gc.g.text(v, x + sw / 2, y + 23, { size: 17, weight: "bold", color: C.amber, align: "center" });
    gc.g.text(l, x + sw / 2, y + 41, { size: 12, color: C.dim, align: "center" });
  });
  y += 62;
  const saved = gc.hasSave();
  const bh = 50;
  if (saved) {
    const half = (gc.W - 42) / 2;
    gc.g.button(16, y, half, bh, "继续上一局", "resume", "", "ok");
    gc.g.button(26 + half, y, half, bh, "重新开一局", "new", "", "ghost");
  } else gc.g.button(16, y, gc.W - 32, bh, "开始行街", "new", "", "ok");
  y += bh + 12;
  const menu: [string, string, string, string][] = [
    ["卡", "句子图鉴", `${gc.prof.seen.length} / ${Object.keys(CARDS).length}`, "codex"],
    [
      "坊",
      "街坊录",
      `${gc.prof.met.length} / ${Object.values(NPCS).filter((n) => !n.hidden).length}`,
      "npcs"
    ],
    [
      "设",
      "设置",
      gc.prof.settings.listen ? "听力挑战开" : `语速 ${gc.prof.settings.rate}`,
      "settings"
    ]
  ];
  const mw = (gc.W - 32 - 16) / 3;
  const colors = [C.pink, C.cyan, C.amber];
  menu.forEach(([ico, label, sub, act], i) => {
    const x = 16 + i * (mw + 8);
    gc.g.rr(x, y, mw, 56, 12, C.panel, C.line);
    gc.g.rr(x + 10, y + 14, 28, 28, 7, undefined, colors[i], 1.5);
    gc.g.text(ico, x + 24, y + 33, { size: 14, weight: "bold", color: colors[i], align: "center" });
    gc.g.text(label, x + 46, y + 26, { size: 14, weight: "bold" });
    gc.g.text(sub, x + 46, y + 44, { size: 11, color: C.dim });
    gc.g.region(x, y, mw, 56, act);
  });
  y += 56 + 16;
  if (y < gc.H - 16)
    gc.g.text(
      "录音只喺本机分析，唔上传 · 声调分只睇音高走势",
      gc.W / 2,
      Math.min(gc.H - 14, y + 4),
      {
        size: 11,
        color: C.dim,
        align: "center"
      }
    );
}

export function dailyCard(gc: GameCtx): string {
  const d = new Date();
  const key = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  const pool = Object.keys(CARDS).filter((id) => CARDS[id].rarity !== "starter");
  return pool[((key * 2654435761) % pool.length) >>> 0] ?? Object.keys(CARDS)[0];
}
