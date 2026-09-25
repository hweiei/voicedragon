/** Preserve shared challenge links (including hash-only links) alongside the new home. */
export function entryMode(search: string, hash: string): "classic" | "beginner" {
  const params = new URLSearchParams(search);
  if (params.get("mode") === "classic" || params.has("duel") || hash.startsWith("#c=")) {
    return "classic";
  }
  return "beginner";
}
