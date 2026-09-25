import { LESSONS } from "./curriculum";

export const BEGINNER_KEY = "voice-dragon-beginner-v1";
export const RELICS = ["慢声耳机", "粤拼灯牌", "回声纪念章"];
export interface Progress {
  floor: number;
  completed: string[];
  spoken: string[];
  relics: string[];
  seed: number;
  done: boolean;
}
export function freshProgress(seed: number): Progress {
  return { floor: 0, completed: [], spoken: [], relics: [], seed, done: false };
}
/** White-list a coherent sequential save; never trust imported UI values or unbounded arrays. */
export function restoreProgress(raw: unknown, seed: number): Progress {
  const fallback = freshProgress(seed);
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Partial<Progress>;
  if (
    !Number.isInteger(value.floor) ||
    value.floor! < 0 ||
    value.floor! >= LESSONS.length ||
    !Number.isSafeInteger(value.seed) ||
    value.seed! < 0 ||
    typeof value.done !== "boolean" ||
    !Array.isArray(value.completed) ||
    !Array.isArray(value.spoken) ||
    !Array.isArray(value.relics)
  )
    return fallback;
  const floor = value.floor!;
  const count = value.completed.length;
  if (
    count < floor ||
    count > floor + 1 ||
    value.completed.some((id, index) => id !== LESSONS[index]?.id) ||
    value.relics.length !== floor ||
    value.relics.some((id) => !RELICS.includes(id)) ||
    value.done !== (count === LESSONS.length)
  )
    return fallback;
  return {
    floor,
    seed: value.seed!,
    done: value.done,
    completed: [...value.completed],
    spoken: [...new Set(value.spoken.filter((id) => value.completed!.includes(id)))],
    relics: [...value.relics]
  };
}
