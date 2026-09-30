import { CARDS, EVENTS, NPCS, RELICS } from "../../../src/street/data";
import type { Run } from "../../../src/street/engine";
import { assetPath } from "../audio-manifest";
import { C, MONO } from "../draw";
import type { GameCtx } from "./ctx";
import { backBar, cardGrid, drawCard, effectText, hear, hud, title } from "./shared";
import { RELIC_PRICE, REMOVE_PRICE } from "./shared";

export function shopScreen(gc: GameCtx, run: Run): void {
  let y = hud(gc, run);
  title(gc, "士多 · 买句子，买密码", y + 16, C.amber);
  y += 34;
  const sh = gc.s.shop;
  const left = sh.cards.filter((id) => !sh.bought.includes(id));
  y += cardGrid(gc, left, y, "buy", (id) => ({ price: CARDS[id].rarity === "rare" ? 45 : 25 }));
  if (sh.relic && !sh.bought.includes(sh.relic)) {
    const r = RELICS[sh.relic];
    gc.g.rr(16, y, gc.W - 32, 60, 12, "rgba(155,123,255,.1)", C.violet);
    gc.g.text(r.glyph, 40, y + 38, { size: 22, color: C.violet, align: "center", weight: "bold" });
    gc.g.text(r.name, 66, y + 24, { size: 15, weight: "bold" });
    gc.g.wrap(r.desc, 66, y + 42, gc.W - 150, 14, { size: 11, color: C.dim }, 2);
    gc.g.rr(gc.W - 76, y + 20, 48, 20, 10, C.amber);
    gc.g.text(`$${RELIC_PRICE}`, gc.W - 52, y + 35, {
      size: 12,
      weight: "bold",
      color: C.ink,
      align: "center"
    });
    gc.g.region(16, y, gc.W - 32, 60, "buyRelic");
    y += 70;
  }
  if (sh.removed) {
    gc.g.text("今日已经请走一张卡", gc.W / 2, y + 22, { size: 13, color: C.dim, align: "center" });
    y += 36;
  } else {
    gc.g.rr(
      16,
      y,
      gc.W - 32,
      54,
      12,
      sh.removing ? "rgba(39,225,214,.16)" : "rgba(39,225,214,.07)",
      C.cyan,
      sh.removing ? 2 : 1
    );
    gc.g.text("剪", 40, y + 35, { size: 20, color: C.cyan, align: "center", weight: "bold" });
    gc.g.text("请走一张卡", 66, y + 23, { size: 15, weight: "bold" });
    gc.g.text("卡组越精，好句越易抽到", 66, y + 41, { size: 11, color: C.dim });
    gc.g.rr(gc.W - 76, y + 17, 48, 20, 10, C.amber);
    gc.g.text(`$${REMOVE_PRICE}`, gc.W - 52, y + 32, {
      size: 12,
      weight: "bold",
      color: C.ink,
      align: "center"
    });
    gc.g.region(16, y, gc.W - 32, 54, "removeMode");
    y += 64;
  }
  if (sh.removing) {
    gc.g.text(`揀一张请走（现有 ${run.deck.length} 张，最少留 5 张）`, gc.W / 2, y + 4, {
      size: 12,
      color: C.cyan,
      align: "center"
    });
    y += 14 + cardGrid(gc, [...new Set(run.deck)], y + 16, "remove");
  }
  gc.g.button(16, Math.min(gc.H - 58, y + 8), gc.W - 32, 46, "行出去", "leave", "", "ghost");
}

export function restScreen(gc: GameCtx, run: Run): void {
  let y = hud(gc, run);
  title(gc, "糖水铺 · 坐低抖下", y + 16, C.ok);
  y += 34;
  gc.g.button(16, y, gc.W - 32, 54, "饮碗红豆沙", "heal", "", "ok", "耐心 +12");
  y += 72;
  gc.g.wrap(
    "或者：揀一句你已经识讲嘅，毕业离开卡组（卡组更精）",
    16,
    y,
    gc.W - 32,
    17,
    { size: 13, color: C.dim },
    2
  );
  y += 30;
  cardGrid(gc, [...new Set(run.deck)], y, "grad");
}

export function eventScreen(gc: GameCtx, run: Run): void {
  let y = hud(gc, run);
  const ev = EVENTS[gc.s.event.idx] ?? EVENTS[0];
  title(gc, ev.title, y + 20, C.violet);
  y += 50;
  y += gc.g.wrap(ev.text, 24, y, gc.W - 48, 22, { size: 15 }, 5) + 12;
  if (ev.reward === "card" && gc.s.event.card) {
    const cw = 110;
    drawCard(gc, gc.s.event.card, (gc.W - cw) / 2, y, cw, cw * 1.32, { act: "evCard" });
    y += cw * 1.32 + 20;
    gc.g.button(16, y, gc.W - 32, 46, "多谢，唔使喇", "leave", "", "ghost");
  } else {
    gc.g.button(
      16,
      y,
      gc.W - 32,
      50,
      ev.reward === "gold" ? "收下 $20" : "饮完继续行（耐心 +8）",
      "evOk",
      "",
      "ok"
    );
  }
}

export function endScreen(gc: GameCtx, run: Run | null, win: boolean): void {
  const im = gc.p.loadImage(assetPath(`street/${win ? "boss.png" : "auntie.png"}`));
  gc.g.img(im, gc.W / 2 - 90, gc.top + 30, 180, 190, "bottom");
  let y = gc.top + 262;
  title(gc, win ? "午市都搞掂！成条街都识你" : "耐心用晒……", y, win ? C.amber : C.pink);
  y += 28;
  gc.g.text(win ? "第一章完成。你用粤语说服咗成条街。" : "唔紧要，讲错先会进步。", gc.W / 2, y, {
    size: 14,
    color: C.dim,
    align: "center"
  });
  y += 28;
  if (run)
    gc.g.text(`卡组 ${run.deck.length} 张 · 毕业 ${run.graduated.length} 句`, gc.W / 2, y, {
      size: 13,
      color: C.cyan,
      align: "center"
    });
  y += 24;
  if (!win && !gc.s.revived && run?.combat && gc.p.adAvailable("revive")) {
    gc.g.button(
      16,
      y,
      gc.W - 32,
      54,
      "▶ 看段广告 · 深呼吸再嚟过",
      "revive",
      "",
      "amber",
      "耐心回返一半，每局限一次"
    );
    y += 68;
  }
  gc.g.button(16, y, gc.W - 32, 50, "再行一次", "new", "", "ok");
  y += 62;
  gc.g.button(16, y, gc.W - 32, 46, "返回主页", "home", "", "ghost");
}

export function rewardScreen(gc: GameCtx, run: Run): void {
  let y = hud(gc, run);
  const c = run.combat;
  title(gc, "街坊畀你讲服咗！", y + 16, C.amber);
  y += 44;
  gc.g.text(
    `$ +${gc.s.rewardGold}   开口 ${c?.spoken ?? 0} 句   暴击 ${c?.crits ?? 0} 次`,
    gc.W / 2,
    y,
    {
      size: 13,
      color: C.cyan,
      align: "center"
    }
  );
  y += 20;
  if (gc.s.levelUps.length) {
    const txt = gc.s.levelUps.map((l) => `${CARDS[l.id].phrase} Lv${l.lv}`).join("、");
    gc.g.wrap(`熟练度提升：${txt}`, 16, y, gc.W - 32, 17, { size: 13, color: C.amber }, 2);
    y += 20;
  }
  gc.g.text("选一张句子卡加入卡组", gc.W / 2, y, { size: 13, color: C.dim, align: "center" });
  y += 20;
  y += cardGrid(gc, gc.s.reward, y + 6, "pick");
  if (!gc.s.adUsed && gc.p.adAvailable("extraCard")) {
    gc.g.button(
      16,
      y + 6,
      gc.W - 32,
      50,
      "▶ 看段广告 · 多一张备选",
      "adCard",
      "",
      "amber",
      "看完先有，唔看唔影响进度"
    );
    y += 66;
  }
  gc.g.button(16, y + 8, gc.W - 32, 46, "唔要，继续行街", "skip", "", "ghost");
}
