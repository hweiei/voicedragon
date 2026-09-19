import { describe, expect, test } from "vitest";
import {
  applyCastPassive,
  characterUnlocked,
  resetTurnPassives,
  rosterEnabled
} from "../../src/core/roster";

describe("P10 名伶纯规则", () => {
  test("门控：仅 p7 + rosterVersion=1 + 战役同时满足才启用", () => {
    expect(rosterEnabled({ rosterVersion: 1, ruleset: "p7", campaign: {} })).toBe(true);
    expect(rosterEnabled({ rosterVersion: 1, ruleset: "p7", campaign: null })).toBe(false);
    expect(rosterEnabled({ rosterVersion: 1, ruleset: "legacy", campaign: {} })).toBe(false);
    expect(rosterEnabled({ ruleset: "p7", campaign: {} })).toBe(false);
    expect(rosterEnabled({})).toBe(false);
  });

  test("亮相：每场首次正音当次伤害 +4（不累积声势），二次正音不再触发", () => {
    const first = applyCastPassive({
      characterId: "man-mou-saang",
      score: 85,
      toneScore: null,
      source: "voice",
      passives: {}
    });
    expect(first).toMatchObject({ castDamageBonus: 4, strengthDelta: 0 });
    expect(first!.passives.limelight).toBe(true);
    const second = applyCastPassive({
      characterId: "man-mou-saang",
      score: 95,
      toneScore: null,
      source: "voice",
      passives: first!.passives
    });
    expect(second).toBeNull();
    const low = applyCastPassive({
      characterId: "man-mou-saang",
      score: 84,
      toneScore: null,
      source: "voice",
      passives: {}
    });
    expect(low).toBeNull();
  });

  test("绕梁：调准 ≥80 每次都 +2 护甲（无标记）；无声/QTE 通道恒不触发", () => {
    for (let i = 0; i < 3; i += 1) {
      const effect = applyCastPassive({
        characterId: "faa-daan",
        score: 60,
        toneScore: 80,
        source: "voice",
        passives: {}
      });
      expect(effect).toMatchObject({ armorDelta: 2 });
    }
    expect(
      applyCastPassive({
        characterId: "faa-daan",
        score: 90,
        toneScore: null,
        source: "qte",
        passives: {}
      })
    ).toBeNull();
    expect(
      applyCastPassive({
        characterId: "faa-daan",
        score: 90,
        toneScore: 79,
        source: "voice",
        passives: {}
      })
    ).toBeNull();
  });

  test("打诨：破阵拍 ≥92 每回合一次回 1 气；语音通道不触发；回合重置后再触发", () => {
    const first = applyCastPassive({
      characterId: "cau-saang",
      score: 92,
      toneScore: null,
      source: "qte",
      passives: {}
    });
    expect(first).toMatchObject({ energyDelta: 1 });
    expect(
      applyCastPassive({
        characterId: "cau-saang",
        score: 100,
        toneScore: null,
        source: "qte",
        passives: first!.passives
      })
    ).toBeNull(); // 同回合第二次不触发
    expect(
      applyCastPassive({
        characterId: "cau-saang",
        score: 100,
        toneScore: null,
        source: "voice",
        passives: {}
      })
    ).toBeNull(); // 语音通道不触发
    expect(
      applyCastPassive({
        characterId: "cau-saang",
        score: 91,
        toneScore: null,
        source: "qte",
        passives: {}
      })
    ).toBeNull(); // 阈值未达
    const reset = resetTurnPassives(first!.passives);
    expect(reset["jest-turn"]).toBeUndefined();
    expect(reset.limelight).toBe(first!.passives.limelight); // 每场标记保留
    const nextTurn = applyCastPassive({
      characterId: "cau-saang",
      score: 95,
      toneScore: null,
      source: "qte",
      passives: reset
    });
    expect(nextTurn).toMatchObject({ energyDelta: 1 });
  });

  test("解锁判定：默认可用；一幕 Boss；成就数", () => {
    expect(characterUnlocked({ unlock: null }, { bossClearedActs: [], achievementCount: 0 })).toBe(
      true
    );
    expect(
      characterUnlocked(
        { unlock: { kind: "act-boss", act: 1 } },
        { bossClearedActs: [1], achievementCount: 0 }
      )
    ).toBe(true);
    expect(
      characterUnlocked(
        { unlock: { kind: "act-boss", act: 1 } },
        { bossClearedActs: [2], achievementCount: 0 }
      )
    ).toBe(false);
    expect(
      characterUnlocked(
        { unlock: { kind: "achievements", count: 8 } },
        { bossClearedActs: [], achievementCount: 8 }
      )
    ).toBe(true);
    expect(
      characterUnlocked(
        { unlock: { kind: "achievements", count: 8 } },
        { bossClearedActs: [], achievementCount: 7 }
      )
    ).toBe(false);
  });
});
