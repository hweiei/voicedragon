import { expect, test } from "@playwright/test";

test("街坊卡牌是默认主页：开局 → 场景对话 → 出牌推进说服度", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "用粤语，搞掂成条街" })).toBeVisible();
  await page.locator('[data-act="new"]').click();
  await page.locator(".mn.can").first().click();
  const scene = page.locator(".scene");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("style", /bg\//);
  const meter = page.locator(".npcm .v");
  const before = await meter.textContent();
  // 挑一张付得起的说服卡直接出（不开咪）
  const card = page.locator(".card.persuade:not(.poor)").first();
  await card.click();
  await page.locator('[data-act="tap"]').click();
  await expect(meter).not.toHaveText(before ?? "");
});

test("图鉴、街坊录、设置可进可返，档案随开局更新", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-act="new"]').click();
  await page.locator(".mn.can").first().click();
  await page.goto("/");
  await expect(page.locator(".stats div").first()).toContainText("1");
  await page.locator('[data-act="codex"]').click();
  await expect(page.locator(".entry:not(.locked)").first()).toBeVisible();
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-act="npcs"]').click();
  await expect(page.locator(".npccard:not(.locked)")).toHaveCount(1);
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="togListen"]').click();
  await expect(page.locator('[data-act="togListen"]')).toHaveClass(/on/);
});

test("旧入口保留：?mode=beginner 进新手塔，?mode=classic 进原版", async ({ page }) => {
  await page.goto("/?mode=beginner");
  await expect(page.getByText("新手教学塔").first()).toBeVisible();
  await page.goto("/?mode=classic");
  await expect(page.locator("#app")).not.toBeEmpty();
});
