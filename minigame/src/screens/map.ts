import { CARDS, EVENTS, NPCS, RELICS } from "../../../src/street/data";
/** 屏幕模块（H-01 阶段4.2 自 game.ts 迁出）。仅经 GameCtx 访问状态与平台。 */
import { type Run, reachable } from "../../../src/street/engine";
import { assetPath } from "../audio-manifest";
import { C, MONO } from "../draw";
import type { GameCtx } from "./ctx";
import { backBar, cardGrid, drawCard, effectText, hear, hud, title } from "./shared";

export function mapScreen(gc: GameCtx, run: Run, t: number): void {
  const y0 = hud(gc, run);
  title(gc, "揀路行街", y0 + 14, C.cyan);
  const areaTop = y0 + 40;
  const areaBot = gc.H - 30;
  const rows = Math.max(...run.map.map((n) => n.row)) + 1;
  const rowH = (areaBot - areaTop) / rows;
  const pos = (n: { row: number; col: number }) => ({
    x: gc.W / 2 + (n.col - 1) * Math.min(110, gc.W * 0.28),
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
      gc.g.ctx.strokeStyle = walked ? C.amber : "rgba(138,145,180,.35)";
      gc.g.ctx.lineWidth = walked ? 3 : 2;
      gc.g.ctx.setLineDash(walked ? [] : [5, 5]);
      gc.g.ctx.beginPath();
      gc.g.ctx.moveTo(a.x, a.y);
      gc.g.ctx.lineTo(b.x, b.y);
      gc.g.ctx.stroke();
    }
  }
  gc.g.ctx.setLineDash([]);
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
    gc.g.glow(on ? color : "transparent", pulse, () => {
      gc.g.ctx.beginPath();
      gc.g.ctx.arc(x, y, r, 0, Math.PI * 2);
      gc.g.ctx.fillStyle = done ? "#23284a" : C.panel;
      gc.g.ctx.fill();
      gc.g.ctx.lineWidth = on ? 3 : 1.5;
      gc.g.ctx.strokeStyle = on ? color : done ? C.dim : C.line;
      gc.g.ctx.stroke();
    });
    if ((n.type === "fight" || n.type === "boss") && n.npc) {
      gc.g.ctx.save();
      gc.g.ctx.beginPath();
      gc.g.ctx.arc(x, y, r - 3, 0, Math.PI * 2);
      gc.g.ctx.clip();
      gc.g.img(
        gc.p.loadImage(assetPath(`street/${NPCS[n.npc].img}`)),
        x - r,
        y - r + 2,
        r * 2,
        r * 2
      );
      gc.g.ctx.restore();
      if (!on && !done) gc.g.ctx.globalAlpha = 1;
    } else
      gc.g.text(glyph[n.type] ?? "?", x, y + 7, {
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
    gc.g.text(label, x, y + r + 15, { size: 12, color: on ? C.text : C.dim, align: "center" });
    if (on) gc.g.region(x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 26, "go", n.id);
  }
}
