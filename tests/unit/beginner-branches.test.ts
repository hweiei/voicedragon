import { describe, expect, test } from "vitest";
import {
  NEW_RELICS,
  branchLesson,
  branchSelected,
  rewardChoices
} from "../../src/beginner/branches";
import { LESSONS } from "../../src/beginner/curriculum";
import { freshProgress, restoreProgress } from "../../src/beginner/progress";
describe("P20 branching learning paths", () => {
  test("route changes task, not prerequisite phrase or floor order", () => {
    for (let seed = 0; seed < 50; seed++)
      for (let floor = 1; floor < 6; floor++) {
        const lesson = branchLesson(floor, "challenge", seed);
        expect(lesson.id).toBe(LESSONS[floor].id);
        expect(lesson.phrase).toBe(LESSONS[floor].phrase);
        expect(lesson.question).not.toBe(LESSONS[floor].question);
        expect(lesson.answers[lesson.correct]).toBeTruthy();
        expect(lesson).toEqual(branchLesson(floor, "challenge", seed));
        expect(branchLesson(floor, "coach", seed)).toEqual(LESSONS[floor]);
      }
  });
  test("reward pool never repeats owned aids and the challenge widens choice", () => {
    expect(rewardChoices([], "coach", 10, 0)).toHaveLength(3);
    expect(rewardChoices([], "challenge", 10, 0)).toHaveLength(5);
    const owned: string[] = [];
    for (let floor = 0; floor < 5; floor++) {
      const choices = rewardChoices(owned, "coach", 99, floor);
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.some((id) => owned.includes(id))).toBe(false);
      owned.push(choices[0]);
    }
    expect(new Set(owned).size).toBe(5);
    expect(rewardChoices(NEW_RELICS, "challenge", 99, 5)).toEqual([]);
  });
  test("pending fork survives restore and cannot skip a curriculum step", () => {
    const state = { ...freshProgress(5), floor: 1, completed: ["greeting"], relics: ["慢声耳机"] };
    expect(restoreProgress(state, 1)).toEqual(state);
    expect(branchSelected(state.routes, state.floor)).toBe(false);
    const selected = { ...state, routes: ["coach", "challenge"] };
    expect(restoreProgress(selected, 1).routes).toEqual(selected.routes);
    expect(restoreProgress({ ...selected, routes: ["coach", "challenge", "coach"] }, 1)).toEqual(
      freshProgress(1)
    );
  });
  test("older run without routes keeps progress and duplicate legacy rewards", () => {
    const { routes: _, ...base } = freshProgress(5);
    const old = {
      ...base,
      floor: 2,
      completed: ["greeting", "please"],
      relics: ["粤拼灯牌", "粤拼灯牌"]
    };
    expect(restoreProgress(old, 1)).toMatchObject({
      floor: 2,
      routes: ["coach", "coach", "coach"],
      relics: old.relics
    });
  });
});
