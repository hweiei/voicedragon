import { CHAPTERS, chapterUnlocked } from "../../../src/street/chapters";
import { CARDS, EVENTS, NPCS, RELICS } from "../../../src/street/data";
import { LEVEL_NAMES, levelOf } from "../../../src/street/mastery";
import { assetPath } from "../audio-manifest";
/** 屏幕模块（H-01 阶段4.2 自 game.ts 迁出）。仅经 GameCtx 访问状态与平台。 */
import { C, MONO } from "../draw";
import type { GameCtx } from "./ctx";
import { backBar, cardGrid, drawCard, effectText, hear, hud, title } from "./shared";
const CODEX_PER_PAGE = 10;

export function chaptersScreen(gc: GameCtx): void {
  let y = backBar(gc, "揀街区");
  const rh = Math.min(96, (gc.H - y - 16) / CHAPTERS.length - 8);
  for (const ch of CHAPTERS) {
    const open = chapterUnlocked(ch.id, gc.prof.cleared);
    const done = gc.prof.cleared.includes(ch.id);
    gc.g.ctx.save();
    gc.g.rr(16, y, gc.W - 32, rh, 12);
    gc.g.ctx.clip();
    gc.g.cover(gc.p.loadImage(assetPath(`street/${ch.bg}`)), 16, y, gc.W - 32, rh);
    gc.g.ctx.fillStyle = open ? "rgba(11,13,26,.55)" : "rgba(11,13,26,.82)";
    gc.g.ctx.fillRect(16, y, gc.W - 32, rh);
    gc.g.ctx.restore();
    gc.g.rr(
      16,
      y,
      gc.W - 32,
      rh,
      12,
      undefined,
      done ? C.amber : open ? C.cyan : "#262a4a",
      open ? 2 : 1
    );
    gc.g.text(ch.label, 30, y + 22, { size: 12, color: open ? C.cyan : C.dim, weight: "bold" });
    gc.g.text(ch.title, 30, y + 46, { size: 18, weight: "900", color: open ? C.text : "#6b7196" });
    gc.g.text(ch.focus, 30, y + rh - 14, { size: 11, color: open ? "#cfd3f5" : "#4d5378" });
    const tag = done ? "✓ 已通关" : open ? "开始 ›" : ch.ready ? "🔒 通关上一区" : "制作中";
    const tw = gc.g.measure(tag, 12, "bold") + 18;
    gc.g.rr(gc.W - 28 - tw, y + 12, tw, 24, 12, done ? C.amber : open ? C.ok : "rgba(38,42,74,.9)");
    gc.g.text(tag, gc.W - 28 - tw / 2, y + 28, {
      size: 12,
      weight: "bold",
      color: done || open ? C.ink : C.dim,
      align: "center"
    });
    gc.g.region(16, y, gc.W - 32, rh, "startChapter", String(ch.id));
    y += rh + 8;
  }
}

export function codexScreen(gc: GameCtx): void {
  let y = backBar(gc, "句子图鉴");
  gc.g.text("点句子听示范 · 最佳声调分只计开口出牌", gc.W / 2, y, {
    size: 12,
    color: C.dim,
    align: "center"
  });
  y += 14;
  const ids = Object.keys(CARDS);
  const pages = Math.ceil(ids.length / CODEX_PER_PAGE);
  gc.s.codexPage = Math.min(gc.s.codexPage, pages - 1);
  const shown = ids.slice(gc.s.codexPage * CODEX_PER_PAGE, (gc.s.codexPage + 1) * CODEX_PER_PAGE);
  const cw = (gc.W - 42) / 2;
  const rows = Math.ceil(shown.length / 2);
  const chh = Math.min(84, (gc.H - y - 80) / rows - 8);
  shown.forEach((id, i) => {
    const x = 16 + (i % 2) * (cw + 10);
    const yy = y + Math.floor(i / 2) * (chh + 8);
    const c = CARDS[id];
    const seen = gc.prof.seen.includes(id);
    gc.g.rr(x, yy, cw, chh, 10, seen ? C.panel : "rgba(22,26,51,.5)", seen ? C.line : "#1f2344");
    if (!seen) {
      gc.g.text("？？？", x + 12, yy + 28, { size: 16, weight: "bold", color: C.dim });
      gc.g.text("行街时遇到先解锁", x + 12, yy + 48, { size: 11, color: "#4d5378" });
      return;
    }
    gc.g.text(c.phrase, x + 10, yy + 24, { size: 15, weight: "bold" });
    gc.g.text(c.jp, x + 10, yy + 40, { size: 10, color: C.pink, font: MONO });
    gc.g.text(c.meaning, x + 10, yy + 56, { size: 11, color: C.dim });
    const best = gc.prof.best[id];
    const mlv = levelOf(gc.prof.mastery[id]?.xp ?? 0);
    gc.g.text(`Lv${mlv} ${LEVEL_NAMES[mlv]}`, x + cw - 10, yy + chh - 8, {
      size: 11,
      color: mlv >= 3 ? C.amber : C.dim,
      align: "right"
    });
    gc.g.text(best === undefined ? "未开口" : `最佳 ${best}`, x + 10, yy + chh - 8, {
      size: 11,
      color: best !== undefined && best >= 70 ? C.ok : C.dim
    });
    gc.g.text("▶", x + cw - 14, yy + 20, { size: 12, color: C.cyan, align: "center" });
    gc.g.region(x, yy, cw, chh, "hearCard", id);
  });
  const py = gc.H - 56;
  if (gc.s.codexPage > 0) gc.g.button(16, py, 90, 40, "‹ 上页", "page", "-1", "ghost");
  gc.g.text(`${gc.s.codexPage + 1} / ${pages}`, gc.W / 2, py + 26, {
    size: 13,
    color: C.dim,
    align: "center"
  });
  if (gc.s.codexPage < pages - 1)
    gc.g.button(gc.W - 106, py, 90, 40, "下页 ›", "page", "1", "ghost");
}

export function npcsScreen(gc: GameCtx): void {
  let y = backBar(gc, "街坊录");
  const list = Object.values(NPCS).filter((n) => !n.hidden);
  const rh = Math.min(104, (gc.H - y - 20) / list.length - 8);
  for (const n of list) {
    const met = gc.prof.met.includes(n.id);
    gc.g.ctx.save();
    gc.g.rr(16, y, gc.W - 32, rh, 12);
    gc.g.ctx.clip();
    if (met) {
      gc.g.cover(gc.p.loadImage(assetPath(`street/${n.bg}`)), 16, y, gc.W - 32, rh);
      gc.g.ctx.fillStyle = "rgba(11,13,26,.72)";
      gc.g.ctx.fillRect(16, y, gc.W - 32, rh);
      gc.g.img(
        gc.p.loadImage(assetPath(`street/${n.img}`)),
        gc.W - 16 - rh * 1.2,
        y + 4,
        rh * 1.2,
        rh - 4,
        "bottom"
      );
    } else {
      gc.g.ctx.fillStyle = "rgba(22,26,51,.6)";
      gc.g.ctx.fillRect(16, y, gc.W - 32, rh);
    }
    gc.g.ctx.restore();
    gc.g.rr(16, y, gc.W - 32, rh, 12, undefined, met ? C.line : "#1f2344");
    if (met) {
      gc.g.text(n.name, 28, y + 26, { size: 16, weight: "bold" });
      gc.g.text(`「${n.intents[0].line}」`, 28, y + 48, { size: 12, color: C.cyan });
      const beaten = gc.prof.beaten[n.id] ?? 0;
      gc.g.text(beaten ? `说服咗 ${beaten} 次` : "未说服过", 28, y + rh - 12, {
        size: 12,
        color: beaten ? C.amber : C.dim
      });
      gc.g.region(16, y, gc.W - 32, rh, "talkNpc", n.id);
    } else {
      gc.g.text("？？？", 28, y + 30, { size: 16, weight: "bold", color: C.dim });
      gc.g.text("喺街上遇到先会记低", 28, y + 52, { size: 12, color: "#4d5378" });
    }
    y += rh + 8;
  }
}

export function settingsScreen(gc: GameCtx): void {
  let y = backBar(gc, "设置") + 6;
  const row = (label: string, sub: string, on: boolean, act: string) => {
    gc.g.rr(16, y, gc.W - 32, 62, 12, C.panel, C.line);
    gc.g.text(label, 28, y + 26, { size: 15, weight: "bold" });
    gc.g.text(sub, 28, y + 46, { size: 11, color: C.dim });
    gc.g.rr(gc.W - 76, y + 18, 48, 26, 13, on ? C.ok : "#2a2f55");
    gc.g.ctx.beginPath();
    gc.g.ctx.arc(on ? gc.W - 41 : gc.W - 63, y + 31, 10, 0, Math.PI * 2);
    gc.g.ctx.fillStyle = "#fff";
    gc.g.ctx.fill();
    gc.g.region(16, y, gc.W - 32, 62, act);
    y += 72;
  };
  row("听力挑战", "街坊台词先收埋，听完或者点开先睇到", gc.prof.settings.listen, "togListen");
  row("揀卡自动读", "揀卡时自动播示范（有录音先会播）", gc.prof.settings.autoSpeak, "togAuto");
  row("音乐与音效", "五声音阶程序化配乐，零音频文件、唔耗流量", !gc.prof.settings.mute, "togMute");
  gc.g.text("示范语速", 28, y + 18, { size: 15, weight: "bold" });
  y += 30;
  const rates = [0.8, 0.9, 1];
  const bw = (gc.W - 32 - 16) / 3;
  rates.forEach((r, i) => {
    const on = Math.abs(gc.prof.settings.rate - r) < 0.01;
    const x = 16 + i * (bw + 8);
    gc.g.rr(x, y, bw, 42, 10, on ? C.cyan : C.panel, on ? C.cyan : C.line);
    gc.g.text(r === 1 ? "正常" : `${r}×`, x + bw / 2, y + 27, {
      size: 14,
      weight: "bold",
      color: on ? C.ink : C.text,
      align: "center"
    });
    gc.g.region(x, y, bw, 42, "rate", String(r));
  });
  y += 64;
  gc.g.button(16, y, gc.W - 32, 46, "清除图鉴、街坊录同统计", "wipe", "", "ghost");
  y += 66;
  gc.g.wrap(
    "录音只喺手机本地分析音高，唔会上传、唔会保存。声调分只睇音高走势，唔等于发音考试。",
    16,
    y,
    gc.W - 32,
    18,
    { size: 12, color: C.dim },
    3
  );
}
