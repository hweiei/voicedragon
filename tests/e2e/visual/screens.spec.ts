/**
 * P15 视觉回归 · 4 屏基线（标题 / 战斗 / 学习报告 / 图鉴）× reduce-motion 开/关。
 *
 * 稳定化（防假阳）：
 * - 预置档一律 `sound/music:false`、`tutorialSeen:true`，reduce-motion 按矩阵切换；
 * - 战斗屏走 `__VOICE_TOWER__.startCampaign` 固定种子（20260922），敌人与手牌确定；
 * - 字体走系统栈（无外部加载）；快照容差见 `playwright.visual.config.ts`。
 *
 * 基线更新必须人工过目：`npm run test:visual -- --update-snapshots`。
 */

import { type Page, expect, test } from "@playwright/test";

type TowerWindow = typeof window & {
  __VOICE_TOWER__: {
    startCampaign: (...args: unknown[]) => void;
  };
};

async function preset(page: Page, reduceMotion: boolean): Promise<void> {
  await page.addInitScript((rm) => {
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({
        sound: false,
        music: false,
        tutorialSeen: true,
        reduceMotion: rm
      })
    );
  }, reduceMotion);
}

/** 让 CSS/Canvas 动效收敛后再截图（reduce-motion 关时给粒子一个静止窗口）。 */
async function settle(page: Page, reduceMotion: boolean): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(reduceMotion ? 150 : 650);
}

const MOTION = [true, false] as const;

for (const reduceMotion of MOTION) {
  const tag = reduceMotion ? "rm-on" : "rm-off";

  test(`标题屏（${tag}）`, async ({ page }) => {
    await preset(page, reduceMotion);
    await page.goto("/");
    await expect(page.locator(".title-screen")).toBeVisible();
    await settle(page, reduceMotion);
    await expect(page).toHaveScreenshot(`title-${tag}.png`);
  });

  test(`战斗屏（${tag}）`, async ({ page }) => {
    await preset(page, reduceMotion);
    await page.goto("/");
    await expect(page.locator(".title-screen")).toBeVisible();
    // 固定种子 + 全版本束直入战役，跳过选角弹窗，保证敌人/手牌可复现
    await page.evaluate(() => {
      (window as unknown as TowerWindow).__VOICE_TOWER__.startCampaign({
        act: 1,
        seed: 20260922,
        ruleset: "p7",
        buildVersion: 1,
        encounterVersion: 1,
        counterVersion: 1,
        rosterVersion: 1,
        ultimateVersion: 1,
        forgeVersion: 1,
        character: "man-mou-saang"
      });
    });
    await expect(page.locator(".map-screen")).toBeVisible();
    await page.locator('[data-action="choose-floor"]').first().click();
    await expect(page.locator(".battle-screen")).toBeVisible();
    await settle(page, reduceMotion);
    await expect(page).toHaveScreenshot(`battle-${tag}.png`);
  });

  test(`学习报告（${tag}）`, async ({ page }) => {
    await preset(page, reduceMotion);
    await page.goto("/");
    await expect(page.locator(".title-screen")).toBeVisible();
    await page.locator('[data-action="open-report"]').click();
    await expect(page.locator(".report-screen")).toBeVisible();
    await settle(page, reduceMotion);
    await expect(page).toHaveScreenshot(`report-${tag}.png`);
  });

  test(`词林图鉴（${tag}）`, async ({ page }) => {
    await preset(page, reduceMotion);
    await page.goto("/");
    await expect(page.locator(".title-screen")).toBeVisible();
    await page.locator('[data-action="open-codex"]').click();
    await expect(page.locator(".codex-screen")).toBeVisible();
    await settle(page, reduceMotion);
    await expect(page).toHaveScreenshot(`codex-${tag}.png`);
  });
}
