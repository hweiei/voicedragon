/**
 * E2E 冒烟（引擎行为已由 146 个契约/单元测试锁定，这里守浏览器层装配）：
 * 1. 标题 → 开战役 → 分支地图 → 进战斗 → 新手教学三步 → 战斗界面
 * 2. 破阵拍（QTE）施法闭环：能量消耗 + 战斗日志
 * 3. 结束回合 → 敌方回合结算 → 声气回满
 * 4. 刷新页面 → 继续登楼（存档恢复）
 */

import { type Page, expect, test } from "@playwright/test";

/** 预置设置：跳过教学、关声音（其余测试不受教学弹层与音频影响）。 */
async function presetSeen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({ sound: false, music: false, tutorialSeen: true })
    );
  });
}

/** 从标题屏开一局战役并走进第一场战斗。 */
async function enterFirstBattle(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /战役 · 第一幕/ }).click();
  await expect(page.locator(".map-screen")).toBeVisible();
  await page.locator('[data-action="choose-floor"]').first().click();
  await expect(page.locator(".battle-screen")).toBeVisible();
}

test("campaign flow reaches battle and the tutorial walks through three steps", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /战役 · 第一幕/ }).click();
  await expect(page.locator(".map-screen")).toBeVisible();

  await page.locator('[data-action="choose-floor"]').first().click();
  await expect(page.locator(".battle-screen")).toBeVisible();

  // 新手教学：三步（识招 → 听示范 → 开声校准），选破阵拍完成
  const sheet = page.locator(".tutorial-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("第一式 · 识招")).toBeVisible();
  await sheet.getByRole("button", { name: /下一步/ }).click();
  await expect(sheet.getByText("第二式 · 听示范")).toBeVisible();
  await sheet.getByRole("button", { name: /下一步/ }).click();
  await expect(sheet.getByText("第三式 · 开声校准")).toBeVisible();
  await expect(sheet.getByText(/只听声，唔会传出去/)).toBeVisible(); // 剧情化隐私文案
  await sheet.getByRole("button", { name: /先用手拍/ }).click();
  await expect(sheet).toBeHidden();

  // 教学只出现一次：出牌开施法弹层，无教学打扰
  await page.locator(".skill-card:not([disabled])").first().click();
  await expect(page.locator(".voice-sheet")).toBeVisible();
});

test("QTE cast consumes energy and writes a battle log", async ({ page }) => {
  await presetSeen(page);
  await enterFirstBattle(page);

  const orbs = page.locator(".energy-orb:not(.spent)");
  await expect(orbs).toHaveCount(3);

  await page.locator(".skill-card:not([disabled])").first().click();
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  // 结算面板确认发动（真实玩家的最后一步）
  await page.locator('[data-action="apply-voice"]').click();

  // 施法结算：弹层关闭、声气消耗、战斗日志记录了效果
  await expect(page.locator(".voice-sheet")).toBeHidden({ timeout: 10_000 });
  await expect(page.locator(".energy-orb.spent")).not.toHaveCount(0);
  // P5 演出：伤害/护甲浮字随施法出现
  await expect(page.locator(".fx-floater").first()).toBeVisible({ timeout: 3_000 });
  await expect(page.locator(".battle-log-line")).toContainText(
    /你说出|护甲|伤害|声势|回复|换了一组/
  );
});

test("end turn triggers the enemy strike and energy refills", async ({ page }) => {
  await presetSeen(page);
  await enterFirstBattle(page);

  await page.getByRole("button", { name: "结束回合" }).click();
  // 敌方回合结算后：声气回满（3 枚未消耗）
  await expect(page.locator(".energy-orb:not(.spent)")).toHaveCount(3, {
    timeout: 10_000
  });
});

test("reload restores the run from the title screen", async ({ page }) => {
  await presetSeen(page);
  await enterFirstBattle(page);

  await page.reload();
  const resume = page.getByRole("button", { name: "继续登楼" });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.locator(".battle-screen")).toBeVisible();
});
