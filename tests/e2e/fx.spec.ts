/**
 * P6-F1 演出冒烟（无声 QTE 通道；引擎层契约见 ../contract，装配冒烟见 smoke.spec.ts）：
 * 1. 常规模式：施法结算产生池化浮字（.fx-floater）
 * 2. reduce-motion：浮字降级为 .fx-calm（仅透明度），且无任何抖动类演出
 */

import { type Page, expect, test } from "@playwright/test";

/** 预置设置：跳过教学、关声音；reduceMotion 参数化。 */
async function preset(page: Page, reduceMotion: boolean): Promise<void> {
  await page.addInitScript((rm) => {
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({ sound: false, music: false, tutorialSeen: true, reduceMotion: rm })
    );
  }, reduceMotion);
}

/** 从标题屏开一局战役并走进第一场战斗。 */
async function enterFirstBattle(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /战役 · 第一幕/ }).click();
  await expect(page.locator(".map-screen")).toBeVisible();
  await page.locator('[data-action="choose-floor"]').first().click();
  await expect(page.locator(".battle-screen")).toBeVisible();
}

/** 破阵拍（QTE）完成一次施法结算。 */
async function castViaQte(page: Page): Promise<void> {
  await page.locator(".skill-card:not([disabled])").first().click();
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  await page.locator('[data-action="apply-voice"]').click();
  await expect(page.locator(".voice-sheet")).toBeHidden({ timeout: 10_000 });
}

test("normal motion: cast spawns pooled floaters", async ({ page }) => {
  await preset(page, false);
  await enterFirstBattle(page);
  await castViaQte(page);
  await expect(page.locator(".fx-floater").first()).toBeVisible({ timeout: 6_000 });
});

test("reduce motion: floaters degrade to calm fades, no shake classes", async ({ page }) => {
  await preset(page, true);
  await enterFirstBattle(page);
  await castViaQte(page);

  // 6s 窗口：并行负载下施法结算可能变慢（单跑 3/3 绿，属环境 flake）
  await expect(page.locator(".fx-floater.fx-calm").first()).toBeVisible({ timeout: 6_000 });
  // 降级承诺：演出归零，信息保留——无任何抖动/红闪类
  await expect(page.locator(".fx-shake, .fx-jolt, .fx-hurt")).toHaveCount(0);
});
