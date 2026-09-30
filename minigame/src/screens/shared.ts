/** 跨屏通用部件与音频键（H-01 阶段4.2a 从 game.ts 迁出；GameCtx 首参）。 */
import { CARDS, type CardDef, NPCS, RELICS } from "../../../src/street/data";
import type { Run } from "../../../src/street/engine";
import { levelOf } from "../../../src/street/mastery";
import { audioPath } from "../audio-manifest";
import { C, MONO } from "../draw";
import type { GameCtx } from "./ctx";

export const REMOVE_PRICE = 50;
export const RELIC_PRICE = 60;
export const HOME_CAST = ["auntie", "boss", "waiter"] as const;

export function hear(gc: GameCtx, key: string): void {
  const path = audioPath(key);
  if (!path || !gc.p.playAudio(path, gc.prof.settings.rate))
    gc.p.toast("示范录音制作中，先睇粤拼跟读");
}
export function cardKey(id: string) {
  return `c-${id}`;
}
export function intentKey(npc: string, idx: number) {
  return `n-${npc}-${idx % NPCS[npc].intents.length}`;
}

const KIND = {
  persuade: { label: "说服", color: C.pink },
  calm: { label: "稳住", color: C.cyan },
  skill: { label: "技巧", color: C.violet }
};
export function effectText(c: CardDef, pv?: { persuade: number; calm: number }): string {
  const out: string[] = [];
  const per = pv?.persuade ?? c.persuade;
  const calm = pv?.calm ?? c.calm;
  if (per) out.push(`说服 +${per}`);
  if (calm) out.push(`稳住 ${calm}`);
  if (c.draw) out.push(`抽 ${c.draw} 张`);
  if (c.energy) out.push(`底气 +${c.energy}`);
  return out.join(" ");
}

export function drawCard(
  gc: GameCtx,
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
  if (o.sel) gc.g.glow(C.amber, 16, () => gc.g.rr(x, y, w, h, 10, C.panel));
  gc.g.rr(x, y, w, h, 10, o.answers ? "#12301f" : C.panel, border, o.sel || o.answers ? 2 : 1);
  gc.g.text(k.label, x + 8, y + 16, { size: 11, color: k.color, weight: "bold" });
  const lv = levelOf(gc.prof.mastery[id]?.xp ?? 0);
  for (let i = 0; i < 5; i++) {
    gc.g.ctx.beginPath();
    gc.g.ctx.arc(x + w - 8 - (4 - i) * 7, y + 12, 2.6, 0, Math.PI * 2);
    gc.g.ctx.fillStyle = i < lv ? C.amber : "#343a66";
    gc.g.ctx.fill();
  }
  // 费用徽章
  gc.g.ctx.beginPath();
  gc.g.ctx.arc(x + 4, y + 4, 11, 0, Math.PI * 2);
  gc.g.ctx.fillStyle = C.amber;
  gc.g.ctx.fill();
  gc.g.text(String(c.cost), x + 4, y + 9, {
    size: 13,
    weight: "bold",
    color: C.ink,
    align: "center"
  });
  const ph = gc.g.wrap(c.phrase, x + 8, y + 36, w - 14, 19, { size: 16, weight: "bold" }, 2);
  const jpLines = Math.max(1, Math.floor((h - 30 - (40 + ph)) / 12));
  gc.g.wrap(c.jp, x + 8, y + 40 + ph, w - 12, 12, { size: 10, color: C.pink, font: MONO }, jpLines);
  gc.g.ctx.fillStyle = C.line;
  gc.g.ctx.fillRect(x + 8, y + h - 26, w - 16, 1);
  gc.g.text(o.eff ?? effectText(c), x + 8, y + h - 10, { size: 11, color: C.text });
  if (o.answers)
    gc.g.text("✓", x + w - 8, y + h - 10, {
      size: 13,
      color: C.ok,
      align: "right",
      weight: "bold"
    });
  if (o.poor) gc.g.rr(x, y, w, h, 10, "rgba(11,13,26,.55)");
  if (o.price !== undefined) {
    gc.g.rr(x + w / 2 - 22, y + h - 9, 44, 18, 9, C.amber);
    gc.g.text(`$${o.price}`, x + w / 2, y + h + 4, {
      size: 12,
      weight: "bold",
      color: C.ink,
      align: "center"
    });
  }
  if (o.act) gc.g.region(x, y, w, h, o.act, o.idx !== undefined ? String(o.idx) : id);
}

/** 卡牌网格：返回占用高度 */
export function cardGrid(
  gc: GameCtx,
  ids: string[],
  y: number,
  act: string,
  extra?: (id: string) => { price?: number }
): number {
  const cols = 3;
  const gap = 10;
  const cw = Math.min(104, (gc.W - 32 - gap * (cols - 1)) / cols);
  const ch = cw * 1.32;
  const rows = Math.ceil(ids.length / cols);
  ids.forEach((id, i) => {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, ids.length - r * cols);
    const x0 = (gc.W - (inRow * cw + (inRow - 1) * gap)) / 2;
    drawCard(gc, id, x0 + (i % cols) * (cw + gap), y + r * (ch + 18), cw, ch, {
      act,
      ...(extra?.(id) ?? {})
    });
  });
  return rows * (ch + 18);
}

export function hud(gc: GameCtx, run: Run): number {
  const y = gc.top;
  gc.g.text(`♥ 耐心 ${run.patience}/${run.maxPatience}`, 14, y + 16, {
    size: 14,
    color: C.pink,
    weight: "bold"
  });
  gc.g.text(`$ 港纸 ${run.gold}`, gc.W / 2, y + 16, {
    size: 14,
    color: C.amber,
    weight: "bold",
    align: "center"
  });
  gc.g.text(`卡组 ${run.deck.length}`, gc.W - 14, y + 16, {
    size: 14,
    color: C.cyan,
    weight: "bold",
    align: "right"
  });
  let x = 14;
  for (const r of run.relics) {
    const def = RELICS[r];
    if (!def) continue;
    gc.g.rr(x, y + 26, 26, 26, 6, "rgba(155,123,255,.15)", C.violet);
    gc.g.text(def.glyph, x + 13, y + 44, {
      size: 13,
      color: C.violet,
      align: "center",
      weight: "bold"
    });
    gc.g.region(x, y + 26, 26, 26, "relic", r);
    x += 32;
  }
  return y + 60;
}

export function title(gc: GameCtx, t: string, y: number, color: string): void {
  gc.g.text(t, gc.W / 2, y, { size: 20, weight: "bold", color, align: "center" });
}

export function backBar(gc: GameCtx, t: string): number {
  gc.g.text("‹ 返回", 16, gc.top + 20, { size: 15, color: C.cyan });
  gc.g.region(8, gc.top, 80, 32, "back");
  gc.g.text(t, gc.W / 2, gc.top + 20, { size: 17, weight: "bold", align: "center" });
  return gc.top + 44;
}
