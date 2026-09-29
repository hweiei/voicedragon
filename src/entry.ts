import { entryMode } from "./core/entry-route";

const mode = entryMode(location.search, location.hash);
if (mode === "classic") {
  // Keep the chosen application stable after classic code clears a challenge hash.
  const url = new URL(location.href);
  url.searchParams.set("mode", "classic");
  history.replaceState(history.state, "", url);
  void import("./main");
} else if (mode === "beginner") {
  void import("./beginner/app");
} else {
  void import("./street/app");
}
