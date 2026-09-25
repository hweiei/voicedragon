import { RELIC_INFO, type RouteKind } from "./branches";
import { LESSONS } from "./curriculum";

export const BEGINNER_KEY = "voice-dragon-beginner-v1";
export const RELICS = Object.keys(RELIC_INFO);
export interface Progress {
  runId: string;
  routes: RouteKind[];
  floor: number;
  completed: string[];
  spoken: string[];
  relics: string[];
  seed: number;
  done: boolean;
}
export function freshProgress(seed: number, runId = `legacy-${seed}`): Progress {
  return {
    runId,
    routes: ["coach"],
    floor: 0,
    completed: [],
    spoken: [],
    relics: [],
    seed,
    done: false
  };
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
  const routes: RouteKind[] =
    value.routes === undefined
      ? Array.from({ length: floor + 1 }, () => "coach")
      : Array.isArray(value.routes)
        ? value.routes
        : [];
  if (
    routes.length < Math.max(1, floor) ||
    routes.length > floor + 1 ||
    routes[0] !== "coach" ||
    routes.some((kind) => kind !== "coach" && kind !== "challenge") ||
    (count > floor && routes.length !== floor + 1)
  )
    return fallback;
  return {
    routes: [...routes],
    runId:
      typeof value.runId === "string" && /^[\w-]{1,80}$/.test(value.runId)
        ? value.runId
        : `legacy-${value.seed}`,
    floor,
    seed: value.seed!,
    done: value.done,
    completed: [...value.completed],
    spoken: [...new Set(value.spoken.filter((id) => value.completed!.includes(id)))],
    relics: [...value.relics]
  };
}
