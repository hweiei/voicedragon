/**
 * 第一幕内容包：直接包裹 data.ts 既有数据（骑楼长街）。
 * 除新增主题文案外零新增数值——经典模式与战役第一幕行为与 P0~P4 完全一致。
 */

import { BOSS, ELITES, ENEMIES, EVENTS, FLOOR_NAMES, RELICS, SKILLS } from "../data";
import type { ActContentPack } from "./types";

export const ACT1_CONTENT: ActContentPack = {
  act: 1,
  theme: "骑楼长街",
  subtitle: "花牌影里，字字生根",
  notice: "第一幕 · 骑楼长街：从底层任意起点登楼，直取声煞之巅。",
  floorNames: FLOOR_NAMES,
  fallbackName: "塔门",
  victoryText: "九龙声煞已散。你带着一路学会的粤语短句走下天台。",
  skills: SKILLS,
  enemies: ENEMIES,
  elites: ELITES,
  boss: BOSS,
  relics: RELICS,
  events: EVENTS
};
