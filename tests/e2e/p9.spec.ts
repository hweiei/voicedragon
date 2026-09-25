/**
 * P9 守势反击 E2E（无声 QTE 通道；纯规则契约见 ../contract/p9-counter.test.ts）：
 * 1. 新战役完整转发四个版本号（含 counterVersion）。
 * 2. 反击卡施放后姿态胶囊可见、意图预览带还击预测；敌方攻击结算后日志出现还击且姿态消耗。
 * 3. 旧局（无 counterVersion 存档）不显示反击文案。
 */

import { type Page, expect, test } from "@playwright/test";
import type { EnemyIntent } from "../../src/core/data";
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

/** 反击战役 + 单段攻击敌意 + 手牌只有反击卡（引擎侧预置，UI 走真实 QTE 结算）。 */
function counterBattle(pattern: EnemyIntent[], kind = "battle"): GameEngine {
  const e = new GameEngine();
  e.startCampaign(1, 991, "p7", 1, 1, 1);
  e.startCombat(kind as "battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.player!.deck.push("p9-waan-faan-bei-nei");
  const index = e.state.player!.deck.length - 1;
  e.state.combat!.hand = [{ id: "p9-waan-faan-bei-nei", index }];
  e.state.combat!.enemy.pattern = pattern;
  return e;
}

async function castFirstCard(page: Page): Promise<void> {
  await page.locator('.skill-card[data-deck-index="5"]').click();
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  await page.locator('[data-action="apply-voice"]').click();
  await expect(page.locator(".voice-sheet")).toBeHidden();
}

test("新战役完整转发四个版本号", async ({ page }) => {
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
  expect(state.counterVersion).toBe(1);
});

test("姿态胶囊与还击预测可见；敌方行动后日志还击、姿态消耗", async ({ page }) => {
  const e = counterBattle([{ type: "attack", amount: 1, label: "试击" }]);
  await preset(page, e.state);
  await castFirstCard(page);
  await expect(page.locator(".status-chip", { hasText: "反击 50%" })).toBeVisible();
  // 意图区显示还击预测（预测与实际共用纯规则）
  await expect(page.locator(".intent-counter")).toBeVisible();
  await page.getByRole("button", { name: "结束回合" }).click();
  await expect(page.locator(".battle-log-line").first()).toContainText("反击姿态生效");
  await expect(page.locator(".status-chip", { hasText: "反击 50%" })).toHaveCount(0);
  const state = await readState(page);
  expect(state.combat!.counter).toBeUndefined();
  expect(state.combat!.enemy.hp).toBeLessThan(e.state.combat!.enemy.maxHp);
});

test("旧局无 counterVersion：不显示反击胶囊与预测", async ({ page }) => {
  const e = new GameEngine();
  e.startCampaign(1, 991, "p7", 1, 1); // P8-B 局
  e.startCombat("battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.combat!.hand = [{ id: "m-sai-geng", index: 2 }];
  await preset(page, e.state);
  await page.locator('.skill-card[data-deck-index="2"]').click();
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  await page.locator('[data-action="apply-voice"]').click();
  await expect(page.locator(".voice-sheet")).toBeHidden();
  await expect(page.locator(".status-chip", { hasText: "反击 50%" })).toHaveCount(0);
});
