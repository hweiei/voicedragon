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

test("主页：点街坊冒口头禅气泡，今日一句与街道进度可见", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".daily")).toBeVisible();
  // 解耦内容数量（ch1-6 扩展后 5→25，曾因写死数字在 feat 分支腐烂）：只验进度条可见且有节点
  await expect(page.locator(".street .stop")).not.toHaveCount(0);
  await page.locator('[data-act="talk"][data-id="boss"]').click({ force: true });
  await expect(page.locator(".hero .bub")).toBeVisible();
});

test("士多：花 $50 请走一张卡，每间士多限一次", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-act="new"]').click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("street-run-v1") ?? "{}");
    s.run.gold = 200;
    for (const n of s.run.map)
      if (n.row === 0) {
        n.type = "shop";
        n.npc = undefined;
      }
    localStorage.setItem("street-run-v1", JSON.stringify(s));
  });
  await page.goto("/");
  await page.locator('[data-act="resume"]').click();
  await page.locator(".mn.can").first().click();
  await page.locator('[data-act="removeMode"]').click();
  await page.locator('[data-act="remove"]').first().click();
  await expect(page.locator(".svc.done")).toBeVisible();
  const run = await page.evaluate(
    () => JSON.parse(localStorage.getItem("street-run-v1") ?? "{}").run
  );
  expect(run.deck.length).toBe(9);
  expect(run.gold).toBe(150);
});
