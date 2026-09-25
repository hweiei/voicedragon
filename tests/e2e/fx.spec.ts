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
  await page.goto("/?mode=classic");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  await page.getByRole("button", { name: /战役 · 第一幕/ }).click();
  await page
    .locator(".roster-card", { hasText: "文武生" })
    .getByRole("button", { name: /开台/ })
    .click();
  await expect(page.locator(".map-screen")).toBeVisible();
  await page.locator('[data-action="choose-floor"]').first().click();
  await expect(page.locator(".battle-screen")).toBeVisible();
}

/** 破阵拍（QTE）完成一次施法结算，并在点击结算前监听短生命周期浮字。 */
async function castViaQte(page: Page, expectedFloater: string): Promise<void> {
  await page.locator(".skill-card:not([disabled])").first().click();
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  await page.evaluate((selector) => {
    const state = window as typeof window & {
      __fxFloaterSeen?: boolean;
      __fxFloaterObserver?: MutationObserver;
    };
    state.__fxFloaterSeen = false;
    state.__fxFloaterObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.matches(selector) || node.querySelector(selector))
          ) {
            state.__fxFloaterSeen = true;
          }
        }
      }
    });
    state.__fxFloaterObserver.observe(document.body, { childList: true, subtree: true });
  }, expectedFloater);
  await page.locator('[data-action="apply-voice"]').click();
  await Promise.all([
    expect
      .poll(
        () =>
          page.evaluate(
            () => (window as typeof window & { __fxFloaterSeen?: boolean }).__fxFloaterSeen === true
          ),
        { timeout: 6_000 }
      )
      .toBe(true),
    expect(page.locator(".voice-sheet")).toBeHidden({ timeout: 10_000 })
  ]);
  await page.evaluate(() => {
    const state = window as typeof window & { __fxFloaterObserver?: MutationObserver };
    state.__fxFloaterObserver?.disconnect();
  });
}

test("normal motion: cast spawns pooled floaters", async ({ page }) => {
  await preset(page, false);
  await enterFirstBattle(page);
  await castViaQte(page, ".fx-floater");
});

test("reduce motion: floaters degrade to calm fades, no shake classes", async ({ page }) => {
  await preset(page, true);
  await enterFirstBattle(page);
  await expect(page.locator("body")).toHaveClass(/reduce-motion/);
  await castViaQte(page, ".fx-floater.fx-calm");

  // 降级承诺：演出归零，信息保留——无任何抖动/红闪类
  await expect(page.locator(".fx-shake, .fx-jolt, .fx-hurt")).toHaveCount(0);
});
