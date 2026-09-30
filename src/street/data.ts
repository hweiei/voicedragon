/**
 * 街坊篇内容总表：合并各章节内容模块，对外保持原有导出不变。
 * 新章节：在 content/ 下新增 chN.ts，并在这里合并、在 chapters.ts 登记。
 */
import { CH1_CARDS, CH1_EVENTS, CH1_NPCS, CH1_RELICS, CH1_STARTER } from "./content/ch1";
import type { CardDef, EventDef, NpcDef, RelicDef } from "./types";

export type { CardDef, CardKind, EventDef, Intent, NpcDef, RelicDef, Tag } from "./types";

function tag<T extends { chapter?: number }>(
  rec: Record<string, T>,
  chapter: number
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(rec).map(([k, v]) => [k, { ...v, chapter: v.chapter ?? chapter }])
  );
}

export const CARDS: Record<string, CardDef> = { ...tag(CH1_CARDS, 1) };
export const NPCS: Record<string, NpcDef> = { ...tag(CH1_NPCS, 1) };
export const RELICS: Record<string, RelicDef> = { ...CH1_RELICS };
export const EVENTS: EventDef[] = [...CH1_EVENTS];
/** 兼容旧代码：第 1 章起手卡组 */
export const STARTER_DECK: string[] = [...CH1_STARTER];
