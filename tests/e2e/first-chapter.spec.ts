import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { LESSONS } from "../../src/beginner/curriculum";
import { JOURNAL_KEY } from "../../src/beginner/journal";
import { BEGINNER_KEY, freshProgress } from "../../src/beginner/progress";

test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] }
});
async function seedBoss(page: import("@playwright/test").Page) {
  const state = {
    ...freshProgress(20260925),
    floor: 5,
    routes: ["coach", "coach", "coach", "coach", "coach", "challenge"],
    completed: LESSONS.slice(0, 5).map((l) => l.id),
    relics: ["慢声耳机", "粤拼灯牌", "分句书签", "情境罗盘", "随身词卡"]
  };
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: BEGINNER_KEY, state }
  );
  await page.goto("/");
}
async function recordRound(page: import("@playwright/test").Page, correct: number) {
  await page.locator('[data-action="record"]').click();
  await expect(page.locator(".recording")).toBeVisible();
  await page.waitForTimeout(400);
  await page.locator('[data-action="record"]').click();
  await expect(page.locator('[data-action="play"]')).toBeVisible();
  await page.locator(`[data-answer="${correct}"]`).click();
  await page.locator('[data-action="next"]').click();
}

test("十段粤语音频均可解码，正常与慢速播放无需系统音色", async ({ page }) => {
  await page.goto("/");
  const clips = [
    "greeting",
    "please",
    "order",
    "price",
    "thanks",
    "boss",
    "want",
    "cup",
    "milk-tea",
    "served"
  ];
  const durations = await page.evaluate(async (names) => {
    const context = new OfflineAudioContext(1, 1, 24000);
    const durations: number[] = [];
    for (const name of names) {
      const response = await fetch(`./audio/yue/${name}.mp3`);
      if (!response.ok) throw new Error(`Missing audio: ${name}`);
      const audio = await context.decodeAudioData(await response.arrayBuffer());
      durations.push(audio.duration);
    }
    return durations;
  }, clips);
  for (const duration of durations) {
    expect(duration).toBeGreaterThan(0.2);
    expect(duration).toBeLessThan(30);
  }
  await page.locator('[data-action="slow"]').click();
  await expect(page.locator("#notice")).toContainText("正在播放内置粤语合成示范");
});

test("示范加载失败给出可操作提示，不假装播放成功", async ({ page }) => {
  await page.route("**/audio/yue/greeting.mp3", (route) => route.abort());
  await page.goto("/");
  await page.locator('[data-action="listen"]').click();
  await expect(page.locator("#notice")).toContainText("示范音频暂时无法播放");
  await expect(page.locator('[data-action="record"]')).toBeEnabled();
});

test("三轮老板对话可中途恢复，混合阅读不计完整录音", async ({ page }) => {
  await seedBoss(page);
  await expect(page.locator(".boss-rounds .current")).toContainText("招呼店员");
  await recordRound(page, 0);
  await page.reload();
  await expect(page.locator(".boss-rounds .current")).toContainText("完整点单");
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="1"]').click();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator(".boss-rounds .current")).toContainText("礼貌回应");
  await page.locator('[data-action="npc-listen"]').click();
  await expect(page.locator("#notice")).toContainText("正在播放内置粤语合成示范");
  await page.locator('[data-answer="2"]').click();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator(".summary")).toBeVisible();
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), BEGINNER_KEY);
  expect(state.done).toBe(true);
  expect(state.bossSpoken).toEqual([0]);
  expect(state.spoken).not.toContain("boss");
});

test("三轮都录音才记录完整对话的录音尝试", async ({ page }) => {
  await seedBoss(page);
  for (const answer of [0, 1, 2]) await recordRound(page, answer);
  await expect(page.locator(".summary")).toBeVisible();
  const journal = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), JOURNAL_KEY);
  expect(journal.entries.boss.recording).toBe(1);
  await page.reload();
  await expect(page.locator(".summary")).toBeVisible();
});

test("导出恢复手账需确认，取消与非法文件都不覆盖记录", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await page.locator('[data-action="next"]').click();
  await page.locator('.review-invitation [data-action="journal"]').click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-action="journal-export"]').click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.journal.entries.greeting.reading).toBe(1);
  backup.journal.entries.greeting.reading = 9;
  const source = {
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  };
  page.once("dialog", (d) => d.dismiss());
  await page.locator("#journal-import").setInputFiles(source);
  await expect(page.locator(".journal-entry")).toContainText("阅读 1 次");
  await page.locator("#journal-import").setInputFiles([]);
  page.once("dialog", (d) => d.accept());
  await page.locator("#journal-import").setInputFiles(source);
  await expect(page.locator(".journal-entry")).toContainText("阅读 9 次");
  await page
    .locator("#journal-import")
    .setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await expect(page.locator("#notice")).toContainText("不是有效的 JSON");
  await expect(page.locator(".journal-entry")).toContainText("阅读 9 次");
});
