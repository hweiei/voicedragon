import { type Page, expect, test } from "@playwright/test";
import { GameEngine, type GameState } from "../../src/core/engine";

async function preset(
  page: Page,
  options: { state?: GameState; srs?: unknown } = {}
): Promise<void> {
  await page.addInitScript((data) => {
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({ sound: false, music: false, tutorialSeen: true, reduceMotion: true })
    );
    if (data.state) {
      localStorage.setItem(
        "voice-tower-save-v2",
        JSON.stringify({ version: 2, savedAt: new Date().toISOString(), state: data.state })
      );
    }
    if (data.srs) localStorage.setItem("voice-tower-srs-v1", JSON.stringify(data.srs));
  }, options);
  await page.goto("/?mode=classic");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  if (options.state) await page.getByRole("button", { name: "继续登楼" }).click();
}

function battleWithKnownPhrase(): GameState {
  const engine = new GameEngine();
  engine.startCampaign(1, 8881, "p7", 1, 1);
  engine.startCombat();
  engine.state.combat!.hand = [{ id: "ding-ngang-soeng", index: 0 }];
  return engine.state;
}

test("P8-C 端侧模拟结果显示音节焦点、保守错调说明与练法", async ({ page }) => {
  await preset(page, { state: battleWithKnownPhrase() });
  await page.locator('.skill-card[data-deck-index="0"]').click();
  await page.evaluate(() => {
    const app = (
      globalThis as unknown as {
        __VOICE_TOWER__: { showVoiceResult(result: unknown): void };
      }
    ).__VOICE_TOWER__;
    app.showVoiceResult({
      source: "sensevoice",
      score: 68,
      similarity: 90,
      confidence: 80,
      transcript: "顶硬上",
      matchedTarget: "顶硬上",
      toneScore: 55,
      toneDetail: {
        score: 55,
        perSyllable: [91, 38, 74],
        expectedTones: [2, 6, 6],
        detectedTones: [2, 1, 6],
        userCurve: [0, 1],
        template: [0, 1]
      }
    });
  });
  const coach = page.getByLabel("本次发音建议");
  await expect(coach).toBeVisible();
  await expect(coach).toContainText("第 2 音节");
  await expect(coach).toContainText("更接近 1 调");
  await expect(coach).toContainText("目标是 6 调");
  await expect(coach.locator(".tone-result-chip")).toHaveCount(3);
  await expect(coach.locator(".tone-result-chip.focus")).toContainText("38分 · 重点练");
});

test("P8-C 学习报告展示六调画像、薄弱调关联复习且 390px 无溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const now = new Date().toISOString();
  await preset(page, {
    srs: {
      entries: {
        "ding-ngang-soeng": {
          id: "ding-ngang-soeng",
          ease: 2.3,
          intervalDays: 1,
          dueAt: now,
          lastScore: 58,
          bestScore: 64,
          attempts: 3,
          lapses: 1,
          addedAt: now,
          lastReviewAt: now,
          lastWordScore: 82,
          lastToneScore: 43,
          focusSyllable: 1,
          focusTone: 6
        }
      },
      stats: {
        voiceAttempts: 3,
        sumWord: 246,
        toneCount: 3,
        sumTone: 171,
        sumConfidence: 240,
        skillsUsed: ["ding-ngang-soeng"],
        toneMastery: {
          1: { attempts: 1, sumScore: 88, bestScore: 88, lastScore: 88 },
          6: { attempts: 2, sumScore: 86, bestScore: 48, lastScore: 38 }
        }
      }
    }
  });
  await page.getByRole("button", { name: "学习报告" }).click();
  await expect(page.getByRole("heading", { name: "六调画像" })).toBeVisible();
  await expect(page.locator(".tone-mastery-card")).toHaveCount(6);
  await expect(page.locator(".tone-mastery-card.focus")).toContainText("6低平");
  await expect(page.locator(".tone-mastery-panel")).toContainText("今日重点 · 6 调");
  await expect(page.locator(".focus-practice-list")).toContainText("顶硬上");
  await expect(page.locator(".inventory-list")).toContainText("字准 82 · 调准 43 · 焦点 6 调");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
});
