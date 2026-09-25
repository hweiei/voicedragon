import { expect, test } from "@playwright/test";
import { LESSONS } from "../../src/beginner/curriculum";
import { BEGINNER_KEY, freshProgress } from "../../src/beginner/progress";

test("内置粤语音频在浏览器矩阵中解码并可点按播放", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".voice-ready")).toContainText("内置粤语合成示范");
  const duration = await page.evaluate(async () => {
    const response = await fetch("./audio/yue/greeting.mp3");
    const context = new OfflineAudioContext(1, 1, 24000);
    return (await context.decodeAudioData(await response.arrayBuffer())).duration;
  });
  expect(duration).toBeGreaterThan(0.2);
  await page.locator('[data-action="listen"]').click();
  await expect(page.locator("#notice")).toContainText("正在播放内置粤语合成示范");
});

test("三轮点单在移动和桌面浏览器中可完成", async ({ page }) => {
  const state = {
    ...freshProgress(42),
    floor: 5,
    completed: LESSONS.slice(0, 5).map((l) => l.id),
    routes: Array(6).fill("coach"),
    relics: ["慢声耳机", "粤拼灯牌", "分句书签", "情境罗盘", "随身词卡"]
  };
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: BEGINNER_KEY,
    state
  });
  await page.goto("/");
  await page.locator('[data-action="reading"]').click();
  for (const answer of [0, 1, 2]) {
    await page.locator(`[data-answer="${answer}"]`).click();
    await page.locator('[data-action="next"]').click();
  }
  await expect(page.locator(".summary")).toContainText("其中 0 句完成录音尝试");
});
