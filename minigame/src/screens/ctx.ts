import type { Run } from "../../../src/street/engine";
/**
 * 屏幕拆分共享上下文（H-01 阶段4.2）。screens/* 只经 GameCtx 取状态与平台，
 * 禁止 import game.ts。类型从原闭包迁出（4.2a，行为零 diff）。
 */
import type { Profile } from "../../../src/street/profile";
import type { Quiz } from "../../../src/street/school";
import type { Painter } from "../draw";
import type { Platform } from "../platform";
import type { SoundCtl } from "../sound";

export type Screen =
  | "home"
  | "map"
  | "battle"
  | "reward"
  | "shop"
  | "rest"
  | "event"
  | "win"
  | "lose"
  | "codex"
  | "npcs"
  | "settings"
  | "chapters"
  | "school";
export interface State {
  screen: Screen;
  run: Run | null;
  sel: number | null;
  reward: string[];
  rewardGold: number;
  adUsed: boolean;
  revived: boolean;
  shop: {
    cards: string[];
    relic: string | null;
    bought: string[];
    removing: boolean;
    removed: boolean;
  };
  event: { idx: number; card?: string };
  recording: boolean;
  lastScore: number | null;
  talk: { id: string; until: number } | null;
  float: { text: string; color: string; t0: number } | null;
  busy: boolean;
  /** 听力挑战：本回合台词是否已揭开 */
  revealed: boolean;
  codexPage: number;
  /** 本场对话里升级的句子 */
  levelUps: { id: string; lv: number }[];
  /** 学堂答题状态 */
  school: SchoolState | null;
}

export interface SchoolState {
  /** lesson = 章首课（开局前）；node = 地图学堂节点 */
  mode: "lesson" | "node";
  quiz: Quiz[];
  idx: number;
  right: number;
  /** 砌句题：已拣嘅词块下标 */
  selTok: number[];
  fb: { ok: boolean; txt: string } | null;
}

export interface GameCtx {
  s: State;
  p: Platform;
  g: Painter;
  /** getter 透传：reset 时 prof 整体换对象 */
  readonly prof: Profile;
  snd: SoundCtl;
  W: number;
  H: number;
  top: number;
}
