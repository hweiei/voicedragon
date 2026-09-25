import { expect, test } from "@playwright/test";
import { branchLesson } from "../../src/beginner/branches";
import { BEGINNER_KEY } from "../../src/beginner/progress";

test("实战分支先藏答案、换场景，保留路线且奖励不重复", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await page.locator('[data-action="next"]').click();
  await page.locator('[data-relic="粤拼灯牌"]').click();
  await expect(page.locator(".branch-picker")).toBeVisible();
  await page.locator('[data-route="challenge"]').click();
  await expect(page.locator(".phrase")).not.toHaveText("唔该");
  await expect(page.locator(".jyutping")).toHaveText("m4 goi1");
  await page.reload();
  await expect(page.locator(".phrase")).not.toHaveText("唔该");
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), BEGINNER_KEY);
  expect(state.routes).toEqual(["coach", "challenge"]);
  await page.locator('[data-action="reading"]').click();
  const lesson = branchLesson(1, "challenge", state.seed);
  await expect(page.locator(".understanding h3")).toHaveText(lesson.question);
  await page.locator(`[data-answer="${lesson.correct}"]`).click();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator("[data-relic]")).toHaveCount(4);
  await expect(page.locator('[data-relic="粤拼灯牌"]')).toHaveCount(0);
  await page.locator('[data-relic="分句书签"]').click();
  await page.locator('[data-route="coach"]').click();
  await expect(page.locator(".phrase")).toHaveText("我要一杯冻奶茶");
  await expect(page.locator(".hint")).toBeVisible();
  await expect(page.locator("[data-chunk]")).toHaveCount(3);
});

test("混合路线六层通关，五件奖励各不重复，手机选路无溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-action="reading"]').click();
  for (let floor = 0; floor < 6; floor++) {
    if (floor > 0) {
      await expect(page.locator(".branch-picker")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await page.locator(`[data-route="${floor % 2 ? "challenge" : "coach"}"]`).click();
    }
    const state = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "null"),
      BEGINNER_KEY
    );
    const lesson = branchLesson(floor, floor % 2 ? "challenge" : "coach", state?.seed ?? 0);
    await page.locator(`[data-answer="${lesson.correct}"]`).click();
    await page.locator('[data-action="next"]').click();
    if (floor < 5) await page.locator("[data-relic]").first().click();
  }
  await expect(page.locator(".summary")).toBeVisible();
  await expect(page.locator(".run-route-summary span")).toHaveCount(6);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), BEGINNER_KEY);
  expect(new Set(state.relics).size).toBe(5);
  expect(state.spoken).toEqual([]);
  expect(state.routes).toEqual(["coach", "challenge", "coach", "challenge", "coach", "challenge"]);
});
