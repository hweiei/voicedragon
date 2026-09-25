import { type Page, expect, test } from "@playwright/test";
import { EVOLVED_ELITES } from "../../src/core/content/encounters";
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
function boss(act = 1): GameEngine {
  const e = new GameEngine();
  e.startCampaign(act, 1881, "p7", 1, 1);
  e.startCombat("boss");
  e.state.combat!.hand = [{ id: "ding-ngang-soeng", index: 0 }];
  return e;
}
async function cast(page: Page): Promise<void> {
  await page.locator('.skill-card[data-deck-index="0"]').click();
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  await page.locator('[data-action="apply-voice"]').click();
  await expect(page.locator(".voice-sheet")).toBeHidden();
}

test("新战役完整转发三个版本号", async ({ page }) => {
  await preset(page);
  await page.getByRole("button", { name: /战役 · 第一幕/ }).click();
  await page
    .locator(".roster-card", { hasText: "文武生" })
    .getByRole("button", { name: /开台/ })
    .click();
  const state = await readState(page);
  expect(state.ruleset).toBe("p7");
  expect(state.buildVersion).toBe(1);
  expect(state.encounterVersion).toBe(1);
});

test("真实QTE跨半血不偷换意图；pending及二阶段刷新保持，实际按预测扣血", async ({ page }) => {
  const e = boss();
  const combat = e.state.combat!;
  combat.enemy.maxHp = 100;
  combat.enemy.hp = 51;
  const oldLabel = e.currentIntent()!.label;
  await preset(page, e.state);
  await expect(page.getByLabel("首领阶段")).toContainText("第一阶段");
  await cast(page);
  await expect(page.getByLabel("首领阶段")).toContainText("本回合意图不变");
  await expect(page.locator(".intent-heading strong")).toHaveText(oldLabel);
  expect((await readState(page)).combat!.bossPhase!.phase).toBe(1);
  await page.reload();
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  await page.getByRole("button", { name: "继续登楼" }).click();
  await expect(page.locator('.boss-phase-info[data-phase="pending"]')).toBeVisible();
  const hp = (await readState(page)).player!.hp;
  const predicted = Number(await page.locator(".intent-forecast").getAttribute("data-hp-loss"));
  await page.getByRole("button", { name: "结束回合" }).click();
  await expect(page.getByLabel("首领阶段")).toContainText("第二阶段");
  expect(hp - (await readState(page)).player!.hp).toBe(predicted);
  await expect(page.locator(".intent-details")).toContainText("蓄势，不造成伤害");
  await page.reload();
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  await page.getByRole("button", { name: "继续登楼" }).click();
  await expect(page.locator(".intent-heading strong")).toHaveText("裂鳞蓄势");
  const hp2 = (await readState(page)).player!.hp;
  await page.getByRole("button", { name: "结束回合" }).click();
  const state = await readState(page);
  expect(state.player!.hp).toBe(hp2);
  expect(state.combat!.enemy.vulnerable).toBe(1);
  await expect(page.getByLabel("敌方当前状态")).toContainText("露隙 1 轮");
  await expect(page.locator(".intent-heading strong")).toHaveText("三叠龙吟");
});

test("穿甲意图明确无视护甲，虚弱/易伤后的实际扣血与预览一致", async ({ page }) => {
  const e = boss(3);
  const combat = e.state.combat!;
  combat.enemy.hp = Math.floor(combat.enemy.maxHp / 2) + 1;
  e.resolveSkill("ding-ngang-soeng", 74, {}, 0);
  e.endTurn();
  e.endTurn();
  e.state.player!.armor = 40;
  combat.enemy.baseAttack = 13;
  combat.enemy.weakness = 2;
  e.state.player!.buffs = [{ id: "vulnerable", name: "易伤", value: 1, turns: 1 }];
  await preset(page, e.state);
  await expect(page.locator(".intent-heading strong")).toHaveText("破云独唱");
  await expect(page.locator(".intent-details")).toContainText("穿甲");
  await expect(page.locator(".intent-details")).toContainText("10 × 1");
  await expect(page.getByLabel("敌方当前状态")).toContainText("虚弱 2 轮");
  await expect(page.getByLabel("敌方行动预告")).toContainText("此招无视护甲");
  const hp = (await readState(page)).player!.hp;
  const loss = Number(await page.locator(".intent-forecast").getAttribute("data-hp-loss"));
  expect(loss).toBe(10);
  await page.getByRole("button", { name: "结束回合" }).click();
  expect(hp - (await readState(page)).player!.hp).toBe(loss);
});

test("新精英吞音显示固定伤害与下句干扰，并真实结算", async ({ page }) => {
  const e = new GameEngine();
  for (let n = 1; n <= 120; n++) {
    e.startCampaign(2, n * 7919, "p7", 1, 1);
    e.startCombat("elite");
    if (e.state.combat!.enemy.id === EVOLVED_ELITES[2].id) break;
  }
  expect(e.state.combat!.enemy.id).toBe(EVOLVED_ELITES[2].id);
  e.state.player!.armor = 3;
  await preset(page, e.state);
  await expect(page.locator(".intent-details")).toContainText("吞音固定伤害");
  await expect(page.locator(".intent-details")).toContainText("下一句判定 -10");
  await expect(page.locator(".intent-forecast")).toHaveAttribute("data-hp-loss", "3");
  await page.getByRole("button", { name: "结束回合" }).click();
  const state = await readState(page);
  expect(state.player!.hp).toBe(69);
  expect(state.player!.buffs.find((b) => b.id === "voice-interference")!.value).toBe(10);
});

test("旧构筑存档继续沿用单阶段和旧意图文案，不自动升级版本", async ({ page }) => {
  const e = new GameEngine();
  e.startCampaign(1, 881, "p7", 1);
  e.startCombat("boss");
  e.state.combat!.enemy.hp = 40;
  e.state.combat!.hand = [{ id: "ding-ngang-soeng", index: 0 }];
  await preset(page, e.state);
  await expect(page.locator(".encounter-brief")).toHaveCount(0);
  await expect(page.locator(".intent-card")).toBeVisible();
  await cast(page);
  await page.getByRole("button", { name: "结束回合" }).click();
  const state = await readState(page);
  expect(state.encounterVersion).toBeUndefined();
  expect(state.combat!.bossPhase).toBeUndefined();
  expect(state.buildVersion).toBe(1);
});

test("390px减弱动效下阶段/意图可读，无横向溢出和页面错误", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const e = boss(3);
  await preset(page, e.state);
  await expect(page.getByLabel("首领阶段")).toContainText("生命 ≤50%");
  await expect(page.getByLabel("敌方行动预告")).toContainText("预计生命");
  const layout = await page.evaluate(() => {
    const panel = document.querySelector(".encounter-brief")!.getBoundingClientRect();
    const stage = document.querySelector(".enemy-stage")!.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      overlap: panel.bottom > stage.top,
      right: panel.right,
      width: innerWidth
    };
  });
  expect(layout.overflow).toBe(false);
  expect(layout.overlap).toBe(false);
  expect(layout.right).toBeLessThanOrEqual(layout.width);
  expect(errors).toEqual([]);
});

test("战斗中加甲和施加虚弱后，当前意图的预测立即更新", async ({ page }) => {
  const e = boss();
  e.state.player!.items = ["p7-bamboo-shield", "small-gong"];
  const initial = e.getIntentPreview()!.hpLoss!;
  await preset(page, e.state);
  await page.getByRole("button", { name: "查看行囊" }).click();
  await page
    .locator(".inventory-item")
    .filter({ hasText: "竹编护身符" })
    .getByRole("button", { name: "使用" })
    .click();
  e.useItem(0);
  const armored = e.getIntentPreview()!.hpLoss!;
  expect(armored).toBeLessThan(initial);
  await expect(page.locator(".intent-forecast")).toHaveAttribute("data-hp-loss", String(armored));
  await page
    .locator(".inventory-item")
    .filter({ hasText: "开场小铜锣" })
    .getByRole("button", { name: "使用" })
    .click();
  e.useItem(0);
  const weakened = e.getIntentPreview()!.hpLoss!;
  expect(weakened).toBeLessThan(armored);
  await expect(page.locator(".intent-forecast")).toHaveAttribute("data-hp-loss", String(weakened));
  await expect(page.getByLabel("敌方当前状态")).toContainText("虚弱 1 轮");
});
