/**
 * 战斗「出牌 → 结果呈现 → 胜利结算」的跨 UI 编排（H-03）。
 * web 线（src/street/app.ts）与微信小游戏（minigame/src/game.ts）共用同一段
 * 序列与文案，平台行为（音效/熟练度/渲染/存档）一律经 hooks 注入。
 * 本文件禁止引入任何 DOM/wx API；纯逻辑，可单测。
 */
import { NPCS } from "./data";
import { type PlayResult, type Run, nextRand, playCard, rewardChoices } from "./engine";

export const WIN_DELAY_MS = 700;

export interface PlayHooks {
  /** 出牌被拒时的提示（web: DOM toast；wx: canvas 浮层） */
  toast(msg: string): void;
  /** 飘字：text 由核心统一拼装（暴击！/接住！/…），crit 供选样式 */
  flash(text: string, crit: boolean): void;
  /** 稳住数值的展示文案（web "🛡 n" / wx "稳住 n"，历史差异保留） */
  calmText(calm: number): string;
  /** 结果就绪后、飘字前调用（wx 在此发 sfx/熟练度；web 缺省 noop） */
  afterResult?(res: PlayResult, cardId: string): void;
  /** 胜利延迟结算（各自 save/afterWin；到点由实现方调度） */
  onWin(): void;
}

/** 执行一次出牌编排。返回 true = 成功打出。 */
export function playBeat(
  run: Run,
  sel: number | null,
  crit: boolean,
  spoke: boolean,
  clearSel: () => void,
  hooks: PlayHooks
): boolean {
  if (sel === null) return false;
  const res = playCard(run, sel, crit, spoke);
  if (!res.ok) {
    hooks.toast(res.reason ?? "出唔到");
    return false;
  }
  clearSel();
  hooks.afterResult?.(res, run.combat ? run.combat.hand[sel] : "");
  const parts: string[] = [];
  if (res.persuade) parts.push(`说服 +${res.persuade}`);
  if (res.calm) parts.push(hooks.calmText(res.calm));
  hooks.flash(
    `${res.crit ? "暴击！" : ""}${res.answered ? "接住！" : ""}${parts.join(" ")}`,
    res.crit
  );
  if (res.won) setTimeout(hooks.onWin, WIN_DELAY_MS);
  return true;
}

export interface WinHooks {
  /** boss 击杀后的界面收尾（web: screen="win"；wx 另有 prof 统计） */
  bossWin(): void;
  /** 奖励池就绪后的收尾：金币已入账 run.gold，reward 由本函数计算传入（两 UI 各自挂状态） */
  afterReward(rewardGold: number, reward: string[]): void;
  /** 非 boss 街坊击败记账（wx: prof.beaten；web 缺省 noop） */
  markBeaten?(npcId: string): void;
  /** 先于其他步骤的开场（wx: sfx win / 教程标记） */
  begin?(): void;
}

/** 胜利结算：奖励金币公式与 rewardChoices 挂载（两 UI 同式）。run.combat 必须存在。 */
export function winBeat(run: Run, hooks: WinHooks): void {
  hooks.begin?.();
  if (!run.combat) return;
  const npc = NPCS[run.combat.npc];
  if (npc) hooks.markBeaten?.(npc.id);
  if (npc?.boss) {
    hooks.bossWin();
    return;
  }
  const rewardGold = 12 + Math.floor(nextRand(run)() * 10);
  run.gold += rewardGold;
  hooks.afterReward(rewardGold, rewardChoices(run));
}
