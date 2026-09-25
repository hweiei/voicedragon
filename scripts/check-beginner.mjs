import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
await page.locator(".phrase").waitFor();
await page.screenshot({ path: "outputs/beginner/desktop.png", fullPage: true });
assert.equal(await page.locator("[data-action=next]").isDisabled(), true);
await page.locator('[data-answer="1"]').click();
assert.equal(await page.locator("[data-action=next]").isDisabled(), true);
await page.locator("[data-action=reading]").click();
for (let i = 0; i < 6; i++) {
  await page.locator(`[data-answer="${[0, 1, 2, 0, 1, 0][i]}"]`).click();
  await page.locator("[data-action=next]").click();
  if (i === 5) {
    for (const answer of [1, 2]) {
      await page.locator(`[data-answer="${answer}"]`).click();
      await page.locator('[data-action="next"]').click();
    }
  }
  if (i < 5) {
    await page.locator("[data-relic]").first().click();
    await page.locator('[data-route="coach"]').click();
  }
}
await page.locator(".summary").waitFor();
assert.match(await page.locator(".summary").innerText(), /其中 0 句完成录音/);
await page.reload();
await page.locator(".summary").waitFor();
await page.screenshot({ path: "outputs/beginner/summary.png", fullPage: true });
await page.getByRole("link", { name: "探索原版自由冒险" }).click();
await page.locator("#app").waitFor();
await page.waitForTimeout(700);
assert.ok((await page.locator("#app").innerText()).length > 30);
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto("http://localhost:5173");
await mobile.locator(".phrase").waitFor();
assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
await mobile.screenshot({ path: "outputs/beginner/mobile.png", fullPage: true });
assert.deepEqual(errors, []);
console.log(
  "PASS: six-floor reading journey, wrong answer gating, zero spoken credit, persistence, original adventure, 390px overflow, no runtime errors."
);
await browser.close();
