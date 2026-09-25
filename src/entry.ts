if (new URLSearchParams(location.search).get("mode") === "classic") {
  void import("./main");
} else {
  void import("./beginner/app");
}
