import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
});
const context = await browser.newContext({ permissions: ["microphone"] });
const page = await context.newPage();
await page.goto("http://localhost:5173");
await page.locator("[data-action=record]").click();
await page.getByText("录音中 · 点击结束", { exact: false }).waitFor();
await page.waitForTimeout(1200);
await page.locator("[data-action=record]").click();
await page.locator("[data-action=play]").waitFor();
await page.locator("[data-action=play]").click();
await page.locator('[data-answer="0"]').click();
await page.locator("[data-action=next]").click();
const save = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("voice-dragon-beginner-v1"))
);
assert.deepEqual(save.spoken, ["greeting"]);
assert.equal(JSON.stringify(save).includes("blob:"), false);
await browser.close();
console.log(
  "PASS: simulated microphone capture, stop, playback control, recording credit, no audio persisted. Real microphone/accent not tested."
);
