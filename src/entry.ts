import { entryMode } from "./core/entry-route";

if (entryMode(location.search, location.hash) === "classic") {
  // Keep the chosen application stable after classic code clears a challenge hash.
  const url = new URL(location.href);
  url.searchParams.set("mode", "classic");
  history.replaceState(history.state, "", url);
  void import("./main");
} else {
  void import("./beginner/app");
}
