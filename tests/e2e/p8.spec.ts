import { type Page, expect, test } from "@playwright/test";
import { GameEngine, type GameState } from "../../src/core/engine";

async function preset(page: Page, state?: GameState): Promise<void> {
  await page.addInitScript((saved) => {
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({ sound: false, music: false, tutorialSeen: true, reduceMotion: true })
    );
    if (saved && !localStorage.getItem("voice-tower-save-v2"))
      localStorage.setItem(
        "voice-tower-save-v2",
        JSON.stringify({ version: 2, savedAt: new Date().toISOString(), state: saved })
      );
  }, state ?? null);
  await page.goto("/?mode=classic");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  if (state) await page.getByRole("button", { name: "继续登楼" }).click();
}
async function readState(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("voice-tower-save-v2")!).state);
}
function game(): GameEngine {
  const e = new GameEngine();
  e.startCampaign(1, 881, "p7", 1);
  return e;
}
async function cast(page: Page, slot: number): Promise<void> {
  await page.locator(`.skill-card[data-deck-index="${slot}"]`).click();
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  await page.locator('[data-action="apply-voice"]').click();
  await expect(page.locator(".voice-sheet")).toBeHidden();
}

test("新战役带构筑版本；行囊可查看独立卡、费用、流派", async ({ page }) => {
  await preset(page);
  await page.getByRole("button", { name: /战役 · 第一幕/ }).click();
  await page
    .locator(".roster-card", { hasText: "文武生" })
    .getByRole("button", { name: /开台/ })
    .click();
  expect((await readState(page)).buildVersion).toBe(1);
  await page.getByRole("button", { name: "查看行囊" }).click();
  await page.getByRole("button", { name: /查看构筑/ }).click();
  await expect(page.getByRole("dialog", { name: "我的构筑" })).toBeVisible();
  await expect(page.locator(".build-card")).toHaveCount(5);
  await expect(page.getByLabel("声气费用分布")).toBeVisible();
  await expect(page.locator(".build-flows")).toContainText("连击增势");
  // P10：新战役入口经名伶选择，默认文武生起始牌组（旧 STARTER_DECK 见契约测试）
  await expect(page.locator('.build-card[data-slot="0"]')).toContainText("顶硬上");
  await expect(page.locator('.build-card[data-slot="1"]')).toContainText("唔使惊");
  await expect(page.locator('.build-card[data-slot="3"]')).toContainText("加油");
});

test("夜市删牌二次确认：取消不消费，确定只扣一次，升级槽平移", async ({ page }) => {
  const e = game();
  const p = e.state.player!;
  p.deck.push("hou-sai-lei");
  p.gold = 100;
  p.upgradedSlots = [0, 3, 5];
  e.startShop();
  await preset(page, e.state);
  await page.getByRole("button", { name: "选择删牌" }).click();
  await page.locator('.build-card[data-slot="1"] button').click();
  await expect(page.getByRole("dialog", { name: "确认构筑操作" })).toContainText("25 两");
  await page.getByRole("button", { name: "返回选牌，不做改动" }).click();
  expect((await readState(page)).player!.gold).toBe(100);
  await page.locator('.build-card[data-slot="1"] button').click();
  await page.getByRole("button", { name: "确认支付 25 两并删除" }).click();
  await expect(page.getByRole("button", { name: "本店已删牌" })).toBeDisabled();
  const state = await readState(page);
  expect(state.player!.gold).toBe(75);
  expect(state.player!.deck).toHaveLength(5);
  expect(state.player!.upgradedSlots).toEqual([0, 2, 4]);
  await page.reload();
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  await page.getByRole("button", { name: "继续登楼" }).click();
  await expect(page.getByRole("button", { name: "本店已删牌" })).toBeDisabled();
});

test("歇脚升级预览对应一张牌；结束节点、刷新仍保持", async ({ page }) => {
  const e = game();
  e.state.phase = "rest";
  e.state.player!.hp = 20;
  await preset(page, e.state);
  await page.getByRole("button", { name: "选择升级", exact: true }).click();
  await page.locator('.build-card[data-slot="1"] button').click();
  await expect(page.locator(".upgrade-preview")).toContainText("基础威力 8");
  await expect(page.locator(".upgrade-preview")).toContainText("基础威力 10");
  await page.getByRole("button", { name: "确认升级并结束歇脚" }).click();
  await expect(page.locator(".map-screen")).toBeVisible();
  const state = await readState(page);
  expect(state.player!.upgradedSlots).toEqual([1]);
  expect(state.player!.hp).toBe(20);
  await page.reload();
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  await page.getByRole("button", { name: "继续登楼" }).click();
  await page.getByRole("button", { name: "查看行囊" }).click();
  await page.getByRole("button", { name: /查看构筑/ }).click();
  await expect(page.locator('.build-card[data-slot="1"] strong')).toContainText("顶硬上＋");
  await expect(page.locator('.build-card[data-slot="0"] strong')).not.toContainText("＋");
});

test("升级副本与普通副本分别通过QTE按实际数值结算", async ({ page }) => {
  const e = game();
  e.state.phase = "rest";
  e.upgradeDeckCard(1, "ding-ngang-soeng");
  e.startCombat();
  e.state.combat!.enemy.hp = e.state.combat!.enemy.maxHp = 999;
  e.state.combat!.hand = [
    { id: "ding-ngang-soeng", index: 0 },
    { id: "ding-ngang-soeng", index: 1 }
  ];
  await preset(page, e.state);
  await expect(page.locator('.skill-card[data-deck-index="1"]')).toContainText("造成 10 点伤害");
  await cast(page, 1);
  let result = (await readState(page)).combat!.lastResult!;
  expect(result.damage).toBe(Math.round(10 * result.tier.multiplier));
  await cast(page, 0);
  result = (await readState(page)).combat!.lastResult!;
  expect(result.damage).toBe(Math.round(8 * result.tier.multiplier));
  expect((await readState(page)).combat!.energy).toBe(1);
});

test("旧P7存档继续时没有升级入口，构筑仅只读", async ({ page }) => {
  const e = new GameEngine();
  e.startCampaign(1, 44, "p7");
  e.state.phase = "rest";
  await preset(page, e.state);
  await expect(page.getByRole("button", { name: "选择升级", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "查看行囊" }).click();
  await page.getByRole("button", { name: /查看构筑/ }).click();
  await expect(page.locator(".build-sheet")).toContainText("本局保留旧规则");
  expect((await readState(page)).buildVersion).toBeUndefined();
});

test("奖励与夜市显示可验证的构筑提示，不篡改随机", async ({ page }) => {
  const e = game();
  e.state.player!.deck.push("gaa-jau");
  e.state.phase = "reward";
  e.state.reward = {
    gold: 10,
    choices: ["jat-cai-soeng", "mou-man-tai", "sik-zo-faan-mei"],
    bonus: null
  };
  await preset(page, e.state);
  await expect(page.locator(".reward-candidate").first()).toContainText("已有 1 张增势招式");
  await expect(page.locator(".reward-candidate").nth(1)).toContainText("尚无净化");
  expect((await readState(page)).rngState).toBe(e.state.rngState);
  await page.evaluate(() => {
    const hook = (window as unknown as { __VOICE_TOWER__: { engine: GameEngine } }).__VOICE_TOWER__;
    hook.engine.startShop();
    hook.engine.state.shop!.offers = [
      { key: "skill-0", type: "skill", id: "jat-cai-soeng", price: 22, sold: false }
    ];
    hook.engine.emit({ save: true });
  });
  await expect(page.locator(".shop-offer")).toContainText("已有 1 张增势招式");
});

test("异步施法结果不能落入下一场战斗", async ({ page }) => {
  const e = game();
  e.startCombat();
  await preset(page, e.state);
  await page.locator(".skill-card:not([disabled])").first().click();
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  await page.evaluate(() =>
    (
      window as unknown as { __VOICE_TOWER__: { engine: GameEngine } }
    ).__VOICE_TOWER__.engine.startCombat()
  );
  await page.locator('[data-action="apply-voice"]').click();
  await expect(page.locator(".voice-sheet")).toBeHidden();
  const combat = await page.evaluate(
    () =>
      (window as unknown as { __VOICE_TOWER__: { engine: GameEngine } }).__VOICE_TOWER__.engine
        .state.combat!
  );
  expect(combat.energy).toBe(3);
  expect(combat.lastResult).toBeNull();
});
