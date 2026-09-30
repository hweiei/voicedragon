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
import { playBeat, winBeat } from "../../src/street/session";

import { battleScreen } from "./screens/battle";
import { dailyCard, homeScreen } from "./screens/home";
import { finishSchool, schoolJudge, schoolPick, schoolScreen, schoolTok } from "./screens/school";

import { mapScreen } from "./screens/map";

import { endScreen, eventScreen, restScreen, rewardScreen, shopScreen } from "./screens/overlays";

import { chaptersScreen, codexScreen, npcsScreen, settingsScreen } from "./screens/codex";

import { assetPath, audioPath } from "./audio-manifest";
import { C, MONO, Painter } from "./draw";
import type { Platform } from "./platform";
import type { GameCtx, Screen, State } from "./screens/ctx";
import {
  HOME_CAST,
  RELIC_PRICE,
  REMOVE_PRICE,
  backBar,
  cardGrid,
  cardKey,
  drawCard,
  effectText,
  hear,
  hud,
  intentKey,
  title
} from "./screens/shared";
import { createSound } from "./sound";

const RUN_KEY = "street-run-v1";
const PROF_KEY = "street-profile-v1";
export function startGame(p: Platform): void {
  const g = new Painter(p);
  const W = p.width;
  const H = p.height;
  const top = p.safeTop;
  let prof: Profile = loadProfile();
  const snd = createSound(() => (p.webAudioCtx?.() ?? null) as import("./sound").AudioCtx | null);
  snd.setMuted(prof.settings.mute);
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

  const ctx: GameCtx = {
    s,
    p,
    g,
    get prof() {
      return prof;
    },
    snd,
    W,
    H,
    top,
    hasSave: () => Boolean(p.getItem(RUN_KEY)),
    saveProf,
    saveRun
  };

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
  /* ---------- 各屏 ---------- */

  /* ---------- 流程 ---------- */

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
    winBeat(run, {
      begin: () => {
        snd.sfx("win");
        if (!prof.tutDone) {
          prof.tutDone = true;
          saveProf();
        }
      },
      markBeaten: (id) => {
        prof.beaten[id] = (prof.beaten[id] ?? 0) + 1;
      },
      bossWin: () => {
        prof.wins += 1;
        const chId = run.chapter ?? 1;
        if (!prof.cleared.includes(chId)) prof.cleared.push(chId);
        saveProf();
        s.screen = "win";
      },
      afterReward: (gold, reward) => {
        saveProf();
        s.rewardGold = gold;
        s.reward = reward;
        s.adUsed = false;
        s.screen = "reward";
      }
    });
  }

  function doPlay(crit: boolean, spoke: boolean, score: number | null = null): void {
    const run = s.run;
    if (!run?.combat || s.sel === null) return;
    playBeat(
      run,
      s.sel,
      crit,
      spoke,
      () => {
        s.sel = null;
      },
      {
        toast: (m) => p.toast(m),
        flash: (text, isCrit) => {
          s.float = { text, color: isCrit ? C.amber : C.ok, t0: p.now() };
        },
        calmText: (n) => `稳住 ${n}`,
        afterResult: (res, cardId) => {
          snd.sfx(res.crit ? "crit" : "play");
          const evs: MasteryEvent[] = ["play"];
          if (res.answered) evs.push("answer");
          if (score !== null && score >= 60) evs.push("spoke");
          if (res.crit) evs.push("crit");
          if (res.won) s.busy = true; // 700ms 结算窗口内防连点（原行为）
          const up = gainXp(prof.mastery, cardId, evs, Date.now());
          saveProf();
          if (up.after > up.before) {
            s.levelUps = s.levelUps
              .filter((l) => l.id !== cardId)
              .concat({ id: cardId, lv: up.after });
            run.bonus = { ...(run.bonus ?? {}), [cardId]: levelBonus(up.after) };
            p.toast(`「${CARDS[cardId].phrase}」熟练度升到 Lv${up.after}`);
          }
        },
        onWin: () => {
          s.busy = false;
          afterWin();
          saveRun();
        }
      }
    );
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
      schoolJudge(ctx, sc >= 60);
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
        p.loadRes?.(`res${chId}`); // 提前拉本章素材分包（wx）
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
        hear(ctx, intentKey(id, 0));
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
        if (NPCS[id]) hear(ctx, intentKey(id, 0));
        break;
      case "togListen":
        prof.settings.listen = !prof.settings.listen;
        saveProf();
        break;
      case "togAuto":
        prof.settings.autoSpeak = !prof.settings.autoSpeak;
        saveProf();
        break;
      case "togMute":
        prof.settings.mute = !prof.settings.mute;
        snd.setMuted(prof.settings.mute);
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
        schoolPick(ctx, Number(id));
        break;
      case "schTok":
        schoolTok(ctx, Number(id));
        break;
      case "schSkip":
        schoolJudge(ctx, false);
        break;
      case "schHear":
        if (id) hear(ctx, cardKey(id));
        break;
      case "schDone":
        finishSchool(ctx);
        break;
      case "hearCard":
        hear(ctx, cardKey(id));
        break;
      case "hearIntent":
        if (run?.combat) {
          s.revealed = true;
          hear(ctx, intentKey(run.combat.npc, run.combat.intentIndex));
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
          snd.sfx("lose");
          prof.tutDone = true;
          saveProf();
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
      snd.unlock(); // 首个手势解锁 WebAudio（自动播放策略）
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
    if (s.screen === "school") schoolScreen(ctx);
    else if (s.screen === "chapters") chaptersScreen(ctx);
    else if (s.screen === "codex") codexScreen(ctx);
    else if (s.screen === "npcs") npcsScreen(ctx);
    else if (s.screen === "settings") settingsScreen(ctx);
    else if (s.screen === "home" || !run) homeScreen(ctx, t);
    else if (s.screen === "map") mapScreen(ctx, run, t);
    else if (s.screen === "battle") battleScreen(ctx, run, t);
    else if (s.screen === "reward") rewardScreen(ctx, run);
    else if (s.screen === "shop") shopScreen(ctx, run);
    else if (s.screen === "rest") restScreen(ctx, run);
    else if (s.screen === "event") eventScreen(ctx, run);
    else endScreen(ctx, run, s.screen === "win");
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 调试钩子（仅网页预览）：自动化测试读取状态
  if (p.name === "web")
    (globalThis as unknown as { __street: { s: State; g: Painter } }).__street = { s, g };
}
