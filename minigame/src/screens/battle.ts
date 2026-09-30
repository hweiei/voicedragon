import { CARDS, EVENTS, NPCS, RELICS } from "../../../src/street/data";
import { type Run, cardPreview, currentIntent } from "../../../src/street/engine";
/** 屏幕模块（H-01 阶段4.2 自 game.ts 迁出）。仅经 GameCtx 访问状态与平台。 */
import { assetPath } from "../audio-manifest";
import { C, MONO } from "../draw";
import type { GameCtx } from "./ctx";
import { backBar, cardGrid, drawCard, effectText, hear, hud, title } from "./shared";

export function battleScreen(gc: GameCtx, run: Run, t: number): void {
  const c = run.combat;
  if (!c) return;
  const npc = NPCS[c.npc];
  const intent = currentIntent(run);
  const y0 = gc.top;
  gc.g.text(`第 ${c.turn} 回合`, gc.W - 14, y0 + 16, { size: 13, color: C.dim, align: "right" });
  let x = 14;
  for (const r of run.relics) {
    const def = RELICS[r];
    if (!def) continue;
    gc.g.rr(x, y0 + 2, 26, 26, 6, "rgba(155,123,255,.15)", C.violet);
    gc.g.text(def.glyph, x + 13, y0 + 20, {
      size: 13,
      color: C.violet,
      align: "center",
      weight: "bold"
    });
    gc.g.region(x, y0 + 2, 26, 26, "relic", r);
    x += 32;
  }
  // 场景
  const sx = 12;
  const sy = y0 + 36;
  const sw = gc.W - 24;
  const sh = Math.round(Math.min(sw * 0.8, gc.H * 0.38));
  gc.g.ctx.save();
  gc.g.rr(sx, sy, sw, sh, 16);
  gc.g.ctx.clip();
  gc.g.cover(gc.p.loadImage(assetPath(`street/${npc.bg}`)), sx, sy, sw, sh);
  gc.g.vfade(sx, sy + sh * 0.55, sw, sh * 0.45, "rgba(11,13,26,0)", "rgba(11,13,26,.8)");
  const bob = Math.sin(t / 600) * 3;
  gc.g.img(
    gc.p.loadImage(assetPath(`street/${npc.img}`)),
    sx + sw * 0.38,
    sy + sh * 0.12 + bob,
    sw * 0.6,
    sh * 0.8,
    "bottom"
  );
  gc.g.ctx.restore();
  gc.g.rr(sx, sy, sw, sh, 16, undefined, c.enraged ? C.pink : C.line, c.enraged ? 2 : 1);
  // 意图气泡
  if (intent) {
    const bw = Math.min(sw * 0.56, 220);
    const bx = sx + 10;
    const by = sy + 12;
    gc.g.rr(bx, by + 3, bw, 80, 12, C.pink);
    gc.g.rr(bx, by, bw, 80, 12, "#fff");
    const hidden = gc.prof.settings.listen && !gc.s.revealed;
    if (hidden) {
      gc.g.text("🎧 听力挑战", bx + 10, by + 24, { size: 15, weight: "bold", color: C.ink });
      gc.g.text("先听佢讲乜，再出牌", bx + 10, by + 46, { size: 12, color: "#6b6f8e" });
      gc.g.text("点一下揭开文字", bx + 10, by + 66, { size: 11, color: C.pink });
    } else
      gc.g.wrap(
        intent.line,
        bx + 10,
        by + 22,
        bw - 40,
        18,
        { size: 15, weight: "bold", color: C.ink },
        2
      );
    if (!hidden) {
      gc.g.text(intent.gloss, bx + 10, by + 58, { size: 11, color: "#6b6f8e" });
      gc.g.text(`意图：${intent.label}`, bx + 10, by + 73, { size: 11, color: "#6b6f8e" });
    }
    gc.g.text(`耐心 -${intent.loss}`, bx + bw - 10, by + 73, {
      size: 11,
      color: C.pink,
      align: "right",
      weight: "bold"
    });
    gc.g.ctx.beginPath();
    gc.g.ctx.arc(bx + bw - 16, by + 16, 12, 0, Math.PI * 2);
    gc.g.ctx.fillStyle = C.pink;
    gc.g.ctx.fill();
    gc.g.text("▶", bx + bw - 15, by + 21, { size: 11, color: "#fff", align: "center" });
    gc.g.region(bx, by, bw, 80, "hearIntent");
  }
  gc.g.text(`${npc.name} · 说服`, sx + 10, sy + sh - 12, { size: 12, color: "#cfd3f5" });
  gc.g.bar(sx + 110, sy + sh - 20, sw - 170, 8, c.progress, c.target, C.pink);
  gc.g.text(`${c.progress}/${c.target}`, sx + sw - 10, sy + sh - 12, {
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
  const tut = gc.prof.tutDone
    ? ""
    : gc.s.sel === null
      ? "👋 新手第 1 步：撳中一张句子卡"
      : c.discard.length === 0
        ? "👋 新手第 2 步：按住黄色「🎙」读出声再出牌（未识读就撳「直接出」）"
        : "👋 新手第 3 步：下一回合试再用带 ✓ 嘅卡接住佢";
  if (tut) gc.g.text(tut, 16, y + 12, { size: 12, color: C.amber, weight: "bold" });
  gc.g.wrap(tip, 16, y + (tut ? 20 : 0), gc.W - 32, 16, { size: 12, color: C.cyan }, 2);
  y += 26 + (tut ? 18 : 0);
  gc.g.glow(C.amber, 12, () => {
    gc.g.ctx.beginPath();
    gc.g.ctx.arc(40, y + 22, 24, 0, Math.PI * 2);
    gc.g.ctx.fillStyle = C.amber;
    gc.g.ctx.fill();
  });
  gc.g.text(String(c.energy), 40, y + 26, {
    size: 20,
    weight: "900",
    color: C.ink,
    align: "center"
  });
  gc.g.text("底气", 40, y + 39, { size: 9, color: C.ink, align: "center" });
  gc.g.text("我的耐心", 74, y + 26, { size: 11, color: C.pink });
  gc.g.bar(128, y + 17, gc.W - 128 - 120, 10, run.patience, run.maxPatience, C.cyan);
  if (c.block) gc.g.text(`🛡${c.block}`, gc.W - 108, y + 27, { size: 12, color: C.cyan });
  gc.g.button(gc.W - 100, y + 2, 86, 40, "结束回合", "end", "", "ghost");

  // 手牌
  y += 60;
  const n = c.hand.length;
  const cw = Math.min(92, (gc.W - 20) / Math.max(n, 3.6));
  const ch = Math.min(cw * 1.9, gc.H - y - 112);
  const span = Math.min(gc.W - 24, n * cw + (n - 1) * 6);
  const step = n > 1 ? (span - cw) / (n - 1) : 0;
  const hx0 = (gc.W - span) / 2;
  c.hand.forEach((id, i) => {
    if (i === gc.s.sel) return;
    const card = CARDS[id];
    const pv = cardPreview(run, card);
    drawCard(gc, id, hx0 + i * step, y + 10, cw, ch, {
      poor: card.cost > c.energy,
      answers: pv.answers,
      eff: effectText(card, pv),
      act: "sel",
      idx: i
    });
  });
  if (gc.s.sel !== null && c.hand[gc.s.sel]) {
    const i = gc.s.sel;
    const card = CARDS[c.hand[i]];
    const pv = cardPreview(run, card);
    drawCard(gc, c.hand[i], hx0 + i * step, y - 8, cw, ch, {
      sel: true,
      answers: pv.answers,
      eff: effectText(card, pv),
      act: "sel",
      idx: i
    });
  }
  y += ch + 24;
  // 出牌操作
  if (gc.s.sel !== null) {
    const bw = (gc.W - 42) / 2;
    gc.g.button(16, y, bw, 50, "直接出", "tap", "", "ghost", "效果 ×1");
    const rec = gc.s.recording;
    gc.g.rr(26 + bw, y + 4, bw, 50, 14, "rgba(0,0,0,.35)");
    gc.g.glow(rec ? C.pink : "transparent", rec ? 18 : 0, () =>
      gc.g.rr(26 + bw, y, bw, 50, 14, rec ? C.pink : C.amber)
    );
    gc.g.text(rec ? "🎙 讲紧…松手出牌" : "🎙 按住读出嚟", 26 + bw + bw / 2, y + 23, {
      size: 15,
      weight: "bold",
      color: C.ink,
      align: "center"
    });
    gc.g.text("声调贴合 ×2 暴击", 26 + bw + bw / 2, y + 40, {
      size: 11,
      color: C.ink,
      align: "center"
    });
    gc.g.region(26 + bw, y, bw, 50, "mic", "", true);
  } else
    gc.g.text("揀一张卡 → 按住咪读出嚟", gc.W / 2, y + 28, {
      size: 13,
      color: C.dim,
      align: "center"
    });
  if (gc.s.lastScore !== null)
    gc.g.text(`上一句声调 ${gc.s.lastScore} 分`, gc.W / 2, Math.min(gc.H - 10, y + 72), {
      size: 12,
      color: gc.s.lastScore >= 70 ? C.ok : C.dim,
      align: "center"
    });
  gc.g.text(`抽牌堆 ${c.draw.length} · 弃牌堆 ${c.discard.length}`, gc.W / 2, gc.H - 12, {
    size: 11,
    color: C.dim,
    align: "center"
  });
  // 飘字
  if (gc.s.float) {
    const k = (t - gc.s.float.t0) / 1100;
    if (k > 1) gc.s.float = null;
    else {
      gc.g.ctx.globalAlpha = 1 - k;
      gc.g.glow(gc.s.float.color, 14, () =>
        gc.g.text(gc.s.float?.text ?? "", gc.W / 2, sy + sh * 0.55 - k * 40, {
          size: 24,
          weight: "900",
          color: gc.s.float?.color,
          align: "center"
        })
      );
      gc.g.ctx.globalAlpha = 1;
    }
  }
}
