import { describe, expect, test } from "vitest";
import { freshProgress, restoreProgress } from "../../src/beginner/progress";
import { entryMode } from "../../src/core/entry-route";

describe("P18 entry compatibility", () => {
  test("default beginner, explicit classic and old challenge links preserved", () => {
    expect(entryMode("", "")).toBe("beginner");
    expect(entryMode("?mode=classic", "")).toBe("classic");
    expect(entryMode("?duel=1", "#c=VT1.example")).toBe("classic");
    expect(entryMode("", "#c=VT1.example")).toBe("classic");
    expect(entryMode("?mode=beginner", "#unknown")).toBe("beginner");
  });
});
describe("P18 progress validation", () => {
  test("fresh and pending-reward saves restore without inventing speech attempts", () => {
    const state = freshProgress(99);
    expect(restoreProgress(state, 1)).toEqual(state);
    state.completed = ["greeting"];
    expect(restoreProgress(state, 1)).toEqual(state);
  });
  test("duplicates and unlearned speech ids are discarded", () => {
    const state = {
      ...freshProgress(99),
      completed: ["greeting"],
      spoken: ["greeting", "greeting", "boss"]
    };
    expect(restoreProgress(state, 1).spoken).toEqual(["greeting"]);
  });
  test("malformed and inconsistent saves safely reset", () => {
    for (const raw of [
      null,
      "bad",
      { ...freshProgress(99), floor: 6 },
      { ...freshProgress(99), done: true },
      { ...freshProgress(99), completed: ["boss"] },
      { ...freshProgress(99), relics: ["<script>"] },
      { ...freshProgress(99), seed: -1 }
    ]) {
      expect(restoreProgress(raw, 42)).toEqual(freshProgress(42));
    }
  });
});
