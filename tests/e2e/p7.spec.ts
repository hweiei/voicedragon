import { type Page, expect, test } from "@playwright/test";
import { EXPANSION_EVENTS } from "../../src/core/content/expansion";
import { GameEngine, type GameState } from "../../src/core/engine";

async function preset(page: Page, state?: GameState): Promise<void> {
  await page.addInitScript((saved) => {
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({ sound: false, music: false, reduceMotion: true, tutorialSeen: true })
    );
    // 只种一次，刷新后必须读取 UI 自己保存的进度。
    if (saved && !localStorage.getItem("voice-tower-save-v2"))
      localStorage.setItem(
        "voice-tower-save-v2",
        JSON.stringify({ version: 2, savedAt: new Date().toISOString(), state: saved })
      );
  }, state ?? null);
}
async function readState(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("voice-tower-save-v2")!).state);
}

test("新战役启用扩展池；标题内容数量由注册表生成", async ({ page }) => {
  await preset(page);
  await page.goto("/");
  await expect(page.locator(".title-screen .content-version")).toContainText(
    "43 招式 · 26 奇遇 · 8 道具"
  );
  await page.getByRole("button", { name: /战役 · 第一幕/ }).click();
  await page
    .locator(".roster-card", { hasText: "文武生" })
    .getByRole("button", { name: /开台/ })
    .click();
  await expect(page.locator(".map-screen")).toBeVisible();
  expect((await readState(page)).ruleset).toBe("p7");
  await page.locator('[data-action="choose-floor"]').first().click();
  await expect(page.locator(".battle-screen .content-version")).toContainText("扩展内容池");
});

test("每日词缀在减弱动效下可读，刷新继续保留种子与身份", async ({ page }) => {
  await preset(page);
  await page.goto("/");
  await page.getByRole("button", { name: /每日挑战/ }).click();
  await expect(page.getByLabel("本局变异词缀")).toBeVisible();
  await expect(page.locator(".mutation-rule")).toHaveCount(2);
  const saved = await readState(page);
  expect(saved.adaptiveBoost).toBe(0);
  const banner = await page.getByLabel("本局变异词缀").innerText();
  await page.reload();
  await page.getByRole("button", { name: "继续登楼" }).click();
  await expect(page.getByLabel("本局变异词缀")).toHaveText(banner, { useInnerText: true });
  expect((await readState(page)).challenge).toEqual(saved.challenge);
});

test("无尽新局展示本组词缀范围", async ({ page }) => {
  await preset(page);
  await page.goto("/");
  await page.getByRole("button", { name: /无尽塔/ }).click();
  await expect(page.getByLabel("本局变异词缀")).toContainText("第 1–5 层");
  expect((await readState(page)).challenge?.mode).toBe("endless");
});

test("新道具在行囊正确渲染并真实改变战斗与存档", async ({ page }) => {
  const e = new GameEngine();
  e.startCampaign(1, 16, "p7");
  e.startCombat();
  e.state.player!.items = ["p7-bamboo-shield", "p7-ginger-shot"];
  e.state.combat!.energy = 1;
  await preset(page, e.state);
  await page.goto("/");
  await page.getByRole("button", { name: "继续登楼" }).click();
  await page.getByRole("button", { name: "查看行囊" }).click();
  await page
    .locator(".inventory-item")
    .filter({ hasText: "竹编护身符" })
    .getByRole("button", { name: "使用" })
    .click();
  await expect(page.locator(".inventory-item").filter({ hasText: "竹编护身符" })).toHaveCount(0);
  expect((await readState(page)).player!.armor).toBe(12);
  await page
    .locator(".inventory-item")
    .filter({ hasText: "姜汁提气饮" })
    .getByRole("button", { name: "使用" })
    .click();
  const state = await readState(page);
  expect(state.combat!.energy).toBe(2);
  expect(state.player!.items).toEqual([]);
});

test("旧存档继续时不静默升级扩展版本", async ({ page }) => {
  const e = new GameEngine();
  e.startCampaign(1, 77);
  await preset(page, e.state);
  await page.goto("/");
  await page.getByRole("button", { name: "继续登楼" }).click();
  await expect(page.locator(".map-screen")).toBeVisible();
  await expect(page.locator(".content-version")).toHaveCount(0);
  await page.locator('[data-action="choose-floor"]').first().click();
  expect((await readState(page)).ruleset).toBeUndefined();
});

test("每日读档后败北仍记入P7日榜，不覆盖旧规则榜", async ({ page }) => {
  const e = new GameEngine();
  e.startDaily(102, "2026-09-19");
  e.startCombat();
  e.state.player!.hp = 1;
  e.state.player!.armor = 0;
  e.state.combat!.enemy.baseAttack = 999;
  e.state.combat!.enemy.pattern = [{ type: "attack", amount: 1, label: "测试终结" }];
  await preset(page, e.state);
  await page.goto("/");
  await page.getByRole("button", { name: "继续登楼" }).click();
  await page.locator('[data-action="end-turn"]').click();
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem("voice-tower-daily-v1-p7")))
    .not.toBeNull();
  const record = await page.evaluate(
    () => JSON.parse(localStorage.getItem("voice-tower-daily-v1-p7")!)["2026-09-19"]
  );
  expect(record).toMatchObject({ seed: 102, ruleset: "p7", victory: false });
  expect(await page.evaluate(() => localStorage.getItem("voice-tower-daily-v1"))).toBeNull();
});

test("P7 问义事件作答前不泄露释义，作答后揭晓", async ({ page }) => {
  const e = new GameEngine();
  e.startCampaign(1, 901, "p7");
  const event = EXPANSION_EVENTS[1].find((entry) => entry.id === "p7-street-direction")!;
  e.state.phase = "event";
  e.state.event = { ...event, resolved: false, outcome: "" };
  await preset(page, e.state);
  await page.goto("/");
  await page.getByRole("button", { name: "继续登楼" }).click();
  await expect(page.locator(".phrase-ribbon small")).toHaveText("选择后揭晓释义");
  const hints = await page.locator(".choice-button small").allTextContents();
  expect(new Set(hints).size).toBe(1);
  await page.locator('[data-choice-id="right"]').click();
  await expect(page.locator(".phrase-ribbon small")).toHaveText("先走一步");
  expect((await readState(page)).player!.voiceMastery).toBe(2);
});
