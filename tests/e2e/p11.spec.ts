/**
 * P11 满堂彩 E2E（无声 QTE 通道；纯规则契约见 ../contract/p11-ultimates.test.ts）：
 * 1. 连续正音（QTE 甜区）点亮彩计；彩满出现绝技按钮。
 * 2. 绝技弹层 → 破阵拍 → 结算：日志、效果与存档（彩清零、每场一次）。
 * 3. 旧局（P10 存档）无彩计 UI。
 */

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

function ultimateBattle(): GameEngine {
  const e = new GameEngine();
  e.startCampaign({
    act: 1,
    seed: 991,
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    character: "man-mou-saang",
    ultimateVersion: 1
  });
  e.startCombat("battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.combat!.enemy.pattern = [{ type: "attack", amount: 1, label: "试击" }];
  e.state.combat!.enemy.hp = e.state.combat!.enemy.maxHp = 500;
  e.state.player!.deck.push("hou-sai-lei");
  const index = e.state.player!.deck.length - 1;
  e.state.combat!.hand = [{ id: "hou-sai-lei", index }];
  return e;
}

/** UI 破阵拍分数依赖点击时序，彩累积走调试 API（与 p10 丑生 E2E 同策略）。 */
async function chargeBravo(page: Page, times: number): Promise<void> {
  await page.evaluate((count) => {
    const tower = (window as typeof window & { __VOICE_TOWER__: { engine: GameEngine } })
      .__VOICE_TOWER__;
    for (let i = 0; i < count; i += 1) {
      tower.engine.state.combat!.hand = [{ id: "hou-sai-lei", index: 5 }];
      tower.engine.state.combat!.energy = 3;
      tower.engine.resolveSkill("hou-sai-lei", 92, { source: "qte" }, 5);
    }
  }, times);
}

test("连续正音点亮彩计；彩满出现绝技按钮", async ({ page }) => {
  const e = ultimateBattle();
  await preset(page, e.state);
  await expect(page.locator(".bravo-meter")).toBeVisible();
  await expect(page.locator(".bravo-pip.lit")).toHaveCount(0);
  // 两次甜区深处（裸分 92 ≥85 计彩）
  await chargeBravo(page, 2);
  await expect(page.locator(".bravo-pip.lit")).toHaveCount(2);
  await chargeBravo(page, 1);
  await expect(page.locator(".bravo-pip.lit")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "满堂彩 · 发动绝技" })).toBeVisible();
});

test("绝技弹层破阵拍全流程：日志、效果、彩清零、每场一次", async ({ page }) => {
  const e = ultimateBattle();
  await preset(page, e.state);
  await chargeBravo(page, 3);
  const hpBefore = (await readState(page)).combat!.enemy.hp;
  await page.getByRole("button", { name: "满堂彩 · 发动绝技" }).click();
  await expect(page.locator(".voice-sheet")).toBeVisible();
  await expect(page.locator(".voice-phrase strong")).toContainText("锣鼓响好戏开场");
  await page.getByRole("button", { name: "破阵拍（无声施法）" }).click();
  await page.locator("#qte-strike").click();
  await page.locator('[data-action="apply-voice"]').click();
  await expect(page.locator(".voice-sheet")).toBeHidden();
  await expect(page.locator(".battle-log-line").first()).toContainText("绝技「锣鼓响好戏开场」");
  const state = await readState(page);
  expect(state.combat!.bravo).toBe(0);
  expect(state.combat!.ultimateUsed).toBe(true);
  expect(state.combat!.enemy.hp).toBeLessThan(hpBefore);
  await expect(page.locator(".bravo-used")).toBeVisible();
  await expect(page.getByRole("button", { name: "满堂彩 · 发动绝技" })).toHaveCount(0);
});

test("旧局（P10 存档）无彩计与绝技入口", async ({ page }) => {
  const e = new GameEngine();
  e.startCampaign({
    act: 1,
    seed: 991,
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    character: "faa-daan"
  });
  e.startCombat("battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.combat!.hand = [{ id: "hou-sai-lei", index: 2 }];
  await preset(page, e.state);
  await expect(page.locator(".bravo-meter")).toHaveCount(0);
  const state = await readState(page);
  expect(state.ultimateVersion).toBeUndefined();
});
