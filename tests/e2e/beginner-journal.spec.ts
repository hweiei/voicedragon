import { expect, test } from "@playwright/test";
import { JOURNAL_KEY } from "../../src/beginner/journal";
import { BEGINNER_KEY } from "../../src/beginner/progress";

async function finishFirstLesson(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator(".reward")).toBeVisible();
}

test("新局不清空手账，刷新不重复计数，复习不推进爬塔", async ({ page }) => {
  await finishFirstLesson(page);
  await page.reload();
  await page.locator('.review-invitation [data-action="journal"]').click();
  await expect(page.locator(".journal-entry")).toContainText("阅读 1 次");
  await expect(page.locator(".journal-entry")).toContainText("录音 0 次");
  const before = await page.evaluate((key) => localStorage.getItem(key), BEGINNER_KEY);
  await page.locator('[data-action="review-start"]').click();
  await expect(page.locator(".phrase")).not.toHaveText("你好");
  await expect(page.locator('[data-rating="remembered"]')).toBeDisabled();
  await page.locator('[data-action="hint"]').click();
  await expect(page.locator(".phrase")).toHaveText("你好");
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await page.locator('[data-rating="again"]').click();
  await expect(page.locator(".review-summary")).toContainText("本次完成 1 句回顾");
  expect(await page.evaluate((key) => localStorage.getItem(key), BEGINNER_KEY)).toBe(before);
  let journal = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), JOURNAL_KEY);
  expect(journal.entries.greeting).toMatchObject({
    reading: 2,
    recording: 0,
    reviews: 1,
    rating: "again",
    intervalDays: 0
  });
  expect(journal.entries.greeting.dueAt - journal.entries.greeting.lastAt).toBe(600000);
  await page.locator('[data-action="journal-close"]').click();
  await expect(page.locator(".reward")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-action="restart"]').click();
  await expect(page.locator(".phrase")).toHaveText("你好");
  await page.locator('.review-invitation [data-action="journal"]').click();
  await expect(page.locator(".journal-entry")).toContainText("阅读 2 次");
  await page.reload();
  journal = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), JOURNAL_KEY);
  expect(journal.entries.greeting.reading).toBe(2);
});

test("手账仅呈现练过内容，移动端可查看与复习", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('.review-invitation [data-action="journal"]').click();
  await expect(page.locator(".journal-empty")).toBeVisible();
  await expect(page.locator('[data-action="review-start"]')).toBeDisabled();
  await page.locator('[data-action="journal-close"]').click();
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await page.locator('[data-action="next"]').click();
  await page.locator('.review-invitation [data-action="journal"]').click();
  await expect(page.locator(".journal-entry")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-action="review-start"]').click();
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await page.locator('[data-rating="remembered"]').click();
  await expect(page.locator(".review-summary")).toBeVisible();
  const entry = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).entries.greeting,
    JOURNAL_KEY
  );
  expect(entry.intervalDays).toBe(2);
});

test("旧新手存档迁移只记一次，不假造历史练习次数", async ({ page }) => {
  await page.addInitScript((key) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(
      key,
      JSON.stringify({
        floor: 0,
        completed: ["greeting"],
        spoken: ["greeting"],
        relics: [],
        seed: 88,
        done: false
      })
    );
  }, BEGINNER_KEY);
  await page.goto("/");
  await expect(page.locator(".reward")).toBeVisible();
  await page.reload();
  await page.locator('.review-invitation [data-action="journal"]').click();
  await expect(page.locator(".journal-entry")).toContainText("录音 1 次");
  const j = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), JOURNAL_KEY);
  expect(j.recentEvents).toEqual(["legacy-88:greeting"]);
});

test("本地存储写入失败有提示，仍可在当前页面练习", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "voice-dragon-beginner-journal-v1")
        throw new DOMException("Full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await finishFirstLesson(page);
  await expect(page.getByRole("alert")).toContainText("手账无法写入");
  await page.locator('.review-invitation [data-action="journal"]').click();
  await expect(page.locator(".journal-entry")).toContainText("阅读 1 次");
});
