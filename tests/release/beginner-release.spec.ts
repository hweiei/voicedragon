import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const CSP = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8").match(
  /^\s*Content-Security-Policy:\s*(.+)$/m
)?.[1];

test("新手首页在严格 CSP 与 320px 视口下可阅读作答", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": CSP! }
    });
  });
  await page.goto("/");
  await expect(page.locator(".phrase")).toHaveText("你好");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator(".reward")).toBeVisible();
  expect(errors).toEqual([]);
});

test("新手首页安装壳可离线重载", async ({ browserName, page, context }) => {
  test.skip(browserName === "webkit", "WebKit 离线模拟限制；仍须 Safari 真机验证。");
  await page.goto("/");
  await expect(page.locator(".phrase")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".phrase")).toHaveText("你好");
    await page.locator('[data-action="reading"]').click();
    await expect(page.locator('[data-action="reading"]')).toContainText("当前为阅读模式");
  } finally {
    await context.setOffline(false);
  }
});
