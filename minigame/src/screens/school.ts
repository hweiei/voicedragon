import { CARDS, EVENTS, NPCS, RELICS } from "../../../src/street/data";
import { gainXp } from "../../../src/street/mastery";
import { gradeAnswer } from "../../../src/street/school";
/** 屏幕模块（H-01 阶段4.2 自 game.ts 迁出）。仅经 GameCtx 访问状态与平台。 */
import { C, MONO } from "../draw";
import type { GameCtx } from "./ctx";
import { backBar, cardGrid, drawCard, effectText, hear, hud, title } from "./shared";
export function schoolScreen(gc: GameCtx): void {
  const st = gc.s.school;
  if (!st) return;
  let y = backBar(gc, st.mode === "lesson" ? "章首课 · 新街區開學" : "学堂 · 温故知新");
  const n = st.quiz.length;
  gc.g.text(`第 ${Math.min(st.idx + 1, n)} / ${n} 题 · 啱咗 ${st.right}`, 16, y + 12, {
    size: 12,
    color: C.dim
  });
  for (let i = 0; i < n; i++) {
    gc.g.ctx.beginPath();
    gc.g.ctx.arc(gc.W - 16 - (n - i) * 16, y + 8, 5, 0, Math.PI * 2);
    gc.g.ctx.fillStyle = i < st.idx ? C.ok : "#262a4a";
    gc.g.ctx.fill();
  }
  y += 28;
  if (st.idx >= n) {
    const full = st.right === n;
    gc.g.rr(16, y, gc.W - 32, 150, 14, C.panel, full ? C.amber : C.line, 2);
    gc.g.text(full ? "满分！学堂阿师递来奖励" : "今日学问有进步", gc.W / 2, y + 34, {
      size: 17,
      weight: "bold",
      align: "center"
    });
    gc.g.text(
      st.mode === "node"
        ? full
          ? "$20 奖学金 · 耐心 +4 · 啱嘅句加 2 经验"
          : `啱 ${st.right}/${n}，每题加 2 熟练经验`
        : `识听识讲就开学堂，啱 ${st.right}/${n} 题`,
      gc.W / 2,
      y + 62,
      { size: 13, color: C.dim, align: "center" }
    );
    gc.g.button(gc.W / 2 - 80, y + 88, 160, 48, "继续行街", "schDone", "", "ok");
    if (st.fb) st.fb = null;
    return;
  }
  const q = st.quiz[st.idx];
  const card = CARDS[q.card];
  gc.g.rr(16, y, gc.W - 32, 108, 14, "rgba(255,79,139,.08)", C.pink, 2);
  const ask =
    q.type === "mean"
      ? "呢句咩意思？"
      : q.type === "listen"
        ? "听音，边句系呢句？"
        : q.type === "order"
          ? "拣词块砌返原句"
          : "开口读顺佢（≥60 分算啱）";
  gc.g.text(ask, 30, y + 22, { size: 12, color: C.pink, weight: "bold" });
  if (q.type === "listen") {
    gc.g.glow(C.pink, 10, () =>
      gc.g.rr(gc.W / 2 - 30, y + 34, 60, 60, 30, "rgba(255,79,139,.2)", C.pink, 2)
    );
    gc.g.text("🔊", gc.W / 2, y + 74, { size: 26, align: "center" });
    gc.g.region(gc.W / 2 - 30, y + 34, 60, 60, "schHear", q.card);
    gc.g.text(gc.s.recording ? "听紧…" : "再听一次都冇问题", gc.W / 2, y + 102, {
      size: 11,
      color: C.dim,
      align: "center"
    });
  } else {
    gc.g.text(card.phrase, gc.W / 2, y + 58, {
      size: q.type === "mean" ? 24 : 22,
      weight: "900",
      align: "center"
    });
    gc.g.text(card.jp, gc.W / 2, y + 82, { size: 12, color: C.cyan, align: "center", font: MONO });
    gc.g.rr(gc.W - 78, y + 12, 50, 30, 15, "rgba(39,225,214,.15)", C.cyan);
    gc.g.text("听", gc.W - 53, y + 32, {
      size: 14,
      weight: "bold",
      color: C.cyan,
      align: "center"
    });
    gc.g.region(gc.W - 78, y + 12, 50, 30, "schHear", q.card);
  }
  y += 120;
  if (q.type === "mean" || q.type === "listen") {
    const opts = q.type === "mean" ? q.opts : q.opts.map((id) => CARDS[id].phrase);
    opts.forEach((t, i) => {
      gc.g.button(16, y + i * 54, gc.W - 32, 46, t, "schOpt", String(i), "ghost");
    });
  } else if (q.type === "order") {
    const tw = (gc.W - 32 - (q.tokens.length - 1) * 8) / q.tokens.length;
    q.tokens.forEach((_, i) => {
      const sel = st.selTok[i];
      gc.g.rr(
        16 + i * (tw + 8),
        y,
        tw,
        40,
        8,
        sel === undefined ? "#171a33" : "rgba(61,220,132,.15)",
        sel === undefined ? C.line : C.ok
      );
      gc.g.text(sel === undefined ? "？" : q.tokens[sel], 16 + i * (tw + 8) + tw / 2, y + 26, {
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
      const w2 = gc.g.measure(t, 15, "bold") + 22;
      if (cx + w2 > gc.W - 16) {
        cx = 16;
        cy += 46;
      }
      gc.g.rr(cx, cy, w2, 38, 10, C.amber);
      gc.g.text(t, cx + w2 / 2, cy + 25, {
        size: 15,
        weight: "bold",
        color: C.ink,
        align: "center"
      });
      gc.g.region(cx, cy, w2, 38, "schTok", String(i));
      cx += w2 + 8;
    });
  } else {
    const rec = gc.s.recording;
    gc.g.glow(rec ? C.pink : "transparent", rec ? 18 : 0, () =>
      gc.g.rr(16, y, gc.W - 32, 56, 14, rec ? C.pink : C.amber)
    );
    gc.g.text(rec ? "🎙 读紧…松手交卷" : "🎙 按住读一次", gc.W / 2, y + 28, {
      size: 16,
      weight: "bold",
      color: rec ? C.ink : C.ink,
      align: "center"
    });
    gc.g.region(16, y, gc.W - 32, 56, "mic", "", true);
    gc.g.button(16, y + 66, gc.W - 32, 40, "未识读，跳过（计答错）", "schSkip", "", "ghost");
  }
  if (st.fb) {
    gc.g.ctx.fillStyle = "rgba(11,13,26,.55)";
    gc.g.ctx.fillRect(0, y - 200, gc.W, 260);
    gc.g.text(st.fb.ok ? "✓" : "✗", gc.W / 2 - 60, y - 90, {
      size: 54,
      weight: "900",
      color: st.fb.ok ? C.ok : C.pink,
      align: "center"
    });
    gc.g.text(st.fb.txt, gc.W / 2 + 30, y - 100, { size: 15, weight: "bold", align: "center" });
  }
}

export function schoolJudge(gc: GameCtx, ok: boolean): void {
  const st = gc.s.school;
  if (!st || st.fb) return;
  const q = st.quiz[st.idx];
  st.fb = { ok, txt: ok ? "啱晒！" : "米啱，仲要练下" };
  if (ok) {
    st.right += 1;
    const up = gainXp(gc.prof.mastery, q.card, ["quiz"], Date.now());
    if (up.after > up.before) gc.p.toast(`「${CARDS[q.card].phrase}」熟练度升到 Lv${up.after}`);
  }
  gc.saveProf();
  gc.s.busy = true;
  setTimeout(() => {
    gc.s.busy = false;
    if (!gc.s.school) return;
    gc.s.school.fb = null;
    gc.s.school.idx += 1;
    gc.s.school.selTok = [];
  }, 800);
}

export function schoolPick(gc: GameCtx, i: number): void {
  const st = gc.s.school;
  if (!st || st.fb) return;
  const q = st.quiz[st.idx];
  if (q && (q.type === "mean" || q.type === "listen")) schoolJudge(gc, i === q.right);
}

export function schoolTok(gc: GameCtx, i: number): void {
  const st = gc.s.school;
  if (!st || st.fb) return;
  const q = st.quiz[st.idx];
  if (!q || q.type !== "order" || st.selTok.includes(i)) return;
  st.selTok.push(i);
  if (st.selTok.length === q.tokens.length) schoolJudge(gc, gradeAnswer(q, st.selTok));
}

export function finishSchool(gc: GameCtx): void {
  const st = gc.s.school;
  if (!st) return;
  const run = gc.s.run;
  if (st.mode === "node" && run && st.right === st.quiz.length && st.quiz.length > 0) {
    run.gold += 20;
    run.patience = Math.min(run.maxPatience, run.patience + 4);
    gc.p.toast("满分！$20 奖学金 · 耐心 +4");
    gc.saveRun();
  }
  gc.s.school = null;
  gc.s.screen = "map";
}
