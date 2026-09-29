/**
 * 入口路由：默认进入「街坊卡牌」；保留新手塔（?mode=beginner）与原版冒险（?mode=classic、切磋码链接）。
 */
export type EntryMode = "classic" | "beginner" | "street";

export function entryMode(search: string, hash: string): EntryMode {
  const params = new URLSearchParams(search);
  if (params.get("mode") === "classic" || params.has("duel") || hash.startsWith("#c=")) {
    return "classic";
  }
  if (params.get("mode") === "beginner") return "beginner";
  return "street";
}
