import { expect, test } from "@playwright/test";
import { BEGINNER_KEY } from "../../src/beginner/progress";

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
  }
});

const answerIndices = [0, 1, 2, 0, 1, 0];
test("六层阅读通关、奖励与刷新恢复，不伪造口语次数", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".phrase")).toHaveText("你好");
  await expect(page.locator('[data-action="next"]')).toBeDisabled();
  await page.locator('[data-answer="1"]').click();
  await expect(page.locator("#notice")).toContainText("再想一想");
  await page.locator('[data-action="reading"]').click();
  for (let index = 0; index < 6; index++) {
    await page.locator(`[data-answer="${answerIndices[index]}"]`).click();
    await page.locator('[data-action="next"]').click();
    if (index === 5) {
      for (const answer of [1, 2]) {
        await page.locator(`[data-answer="${answer}"]`).click();
        await page.locator('[data-action="next"]').click();
      }
    }
    if (index < 5) {
      await page.locator("[data-relic]").first().click();
      await page.locator('[data-route="coach"]').click();
    }
  }
  await expect(page.locator(".summary")).toContainText("其中 0 句完成录音尝试");
  await page.reload();
  await expect(page.locator(".summary")).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), BEGINNER_KEY);
  expect(saved.completed).toHaveLength(6);
  expect(saved.spoken).toEqual([]);
  expect(saved.relics).toHaveLength(5);
});

test("领取奖励前刷新仍在奖励页，领取后进入下一层并保留提示", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await page.locator('[data-action="next"]').click();
  await page.reload();
  await expect(page.locator(".reward")).toBeVisible();
  await page.locator('[data-relic="粤拼灯牌"]').click();
  await expect(page.locator(".branch-picker")).toBeVisible();
  await page.reload();
  await expect(page.locator(".branch-picker")).toBeVisible();
  await page.locator('[data-route="coach"]').click();
  await page.reload();
  await expect(page.locator(".phrase")).toHaveText("唔该");
  await expect(page.locator(".hint")).toBeVisible();
});

test("损坏存档安全回退，原版存档不受影响", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ floor: 99, done: true }));
    localStorage.setItem("voice-tower-save-v2", "legacy-sentinel");
  }, BEGINNER_KEY);
  await page.goto("/");
  await expect(page.locator(".phrase")).toHaveText("你好");
  expect(await page.evaluate(() => localStorage.getItem("voice-tower-save-v2"))).toBe(
    "legacy-sentinel"
  );
});

test("麦克风拒绝后可切阅读模式，无假录音记录", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException("Denied", "NotAllowedError"))
      }
    });
  });
  await page.goto("/");
  await page.locator('[data-action="record"]').click();
  await expect(page.locator("#notice")).toContainText("无法访问麦克风");
  await expect(page.locator('[data-action="play"]')).toHaveCount(0);
  await page.locator('[data-action="reading"]').click();
  await page.locator('[data-answer="0"]').click();
  await expect(page.locator('[data-action="next"]')).toBeEnabled();
});

test("没有系统粤语声音时仍播放内置粤语示范", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(speechSynthesis, "getVoices", {
      value: () => [{ name: "Mandarin", lang: "zh-CN" }]
    });
    Object.defineProperty(speechSynthesis, "speak", {
      value: () => {
        throw new Error("Must not speak Mandarin");
      }
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator('[data-action="listen"]').click();
  await expect(page.locator("#notice")).toContainText("正在播放内置粤语合成示范");
  expect(errors).toEqual([]);
});

test("旧版 hash-only 挑战链接与刷新保持原版入口", async ({ page }) => {
  await page.goto("/#c=VT2.AAAA.BBBB");
  await expect(page.locator(".duel-warning")).toContainText("更新的版本");
  await expect(page).toHaveURL(/mode=classic/);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  await expect(page.locator(".title-screen")).toBeVisible();
});

test.describe("模拟麦克风（不代表真实音质）", () => {
  test("录音、回放、重录中不允许过关，存档不含音频", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-action="record"]').click();
    await expect(page.locator(".recording")).toBeVisible();
    await page.waitForTimeout(500); // Allow the simulated input to produce at least one audio packet.
    await page.locator('[data-action="record"]').click();
    await expect(page.locator('[data-action="play"]')).toBeVisible();
    await page.locator('[data-action="play"]').click();
    await page.locator('[data-answer="0"]').click();
    await expect(page.locator('[data-action="next"]')).toBeEnabled();
    await page.locator('[data-action="record"]').click();
    await expect(page.locator(".recording")).toBeVisible();
    await expect(page.locator('[data-action="next"]')).toBeDisabled();
    await page.waitForTimeout(500);
    await page.locator('[data-action="record"]').click();
    await expect(page.locator('[data-action="next"]')).toBeEnabled();
    await page.locator('[data-action="next"]').click();
    const raw = await page.evaluate((key) => localStorage.getItem(key)!, BEGINNER_KEY);
    expect(JSON.parse(raw).spoken).toEqual(["greeting"]);
    expect(raw).not.toMatch(/blob:|audio\/|base64/);
  });
});
