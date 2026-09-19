/**
 * P10 名伶登场 E2E：
 * 1. 战役入口弹名伶选择；新档仅文武生可选，锁定项显示条件；选角开局四版本号+角色落位。
 * 2. roster 局战斗状态行显示角色名；丑生破阵拍被动回气写入日志与存档。
 * 3. 旧局（P9 存档）无角色名与 roster 字段，行为不变。
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
  await page.goto("/");
  if (state) await page.getByRole("button", { name: "继续登楼" }).click();
}

async function readState(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("voice-tower-save-v2")!).state);
}

function cauBattle(): GameEngine {
  const e = new GameEngine();
  e.startCampaign({
    act: 1,
    seed: 991,
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    character: "cau-saang"
  });
  e.startCombat("battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.player!.deck.push("hou-sai-lei");
  const index = e.state.player!.deck.length - 1;
  e.state.combat!.hand = [{ id: "hou-sai-lei", index }];
  e.state.combat!.enemy.pattern = [{ type: "attack", amount: 1, label: "试击" }];
  return e;
}

test("名伶选择：新档仅文武生可选；选角开局四版本号与角色落位", async ({ page }) => {
  await preset(page);
  await page.getByRole("button", { name: /战役 · 第一幕/ }).click();
  const sheet = page.locator(".roster-sheet");
  await expect(sheet).toBeVisible();
  await expect(page.locator(".roster-card", { hasText: "文武生" }).locator("button")).toBeEnabled();
  await expect(page.locator(".roster-card", { hasText: "花旦" }).locator("button")).toBeDisabled();
  await expect(page.locator(".roster-card", { hasText: "丑生" }).locator("button")).toBeDisabled();
  await expect(sheet).toContainText("通关第一幕 Boss 后登台");
  await page
    .locator(".roster-card", { hasText: "文武生" })
    .getByRole("button", { name: /以文武生开台/ })
    .click();
  await expect(page.locator(".map-screen")).toBeVisible();
  const state = await readState(page);
  expect(state.ruleset).toBe("p7");
  expect(state.buildVersion).toBe(1);
  expect(state.encounterVersion).toBe(1);
  expect(state.counterVersion).toBe(1);
  expect(state.rosterVersion).toBe(1);
  expect(state.characterId).toBe("man-mou-saang");
  expect(state.player!.deck).toEqual([
    "ding-ngang-soeng",
    "m-sai-geng",
    "zap-saang-laa",
    "gaa-jau",
    "faai-di-zau"
  ]);
});

test("丑生：状态行显示角色名；破阵拍被动回气写入日志与存档", async ({ page }) => {
  const e = cauBattle();
  await preset(page, e.state);
  await expect(page.locator(".battle-screen")).toBeVisible();
  await expect(page.locator(".combatant-mini", { hasText: "你 · 丑生" })).toBeVisible();
  // 经调试口以破阵拍通道施法（92 分甜区深处）：UI 经引擎广播重渲染
  await page.evaluate(() => {
    const tower = (window as typeof window & { __VOICE_TOWER__: { engine: GameEngine } })
      .__VOICE_TOWER__;
    tower.engine.resolveSkill("hou-sai-lei", 92, { source: "qte" }, 5);
  });
  await expect(page.locator(".battle-log-line", { hasText: "打诨" }).first()).toBeVisible();
  const state = await readState(page);
  expect(state.combat!.passives?.["jest-turn"]).toBe(true);
  expect(state.combat!.energy).toBe(3);
});

test("旧局（P9 存档）无角色名与 roster 字段", async ({ page }) => {
  const e = new GameEngine();
  e.startCampaign(1, 991, "p7", 1, 1, 1);
  e.startCombat("battle");
  e.state.player!.hp = e.state.player!.maxHp = 999;
  e.state.combat!.hand = [{ id: "hou-sai-lei", index: 2 }];
  await preset(page, e.state);
  await expect(page.locator(".combatant-mini", { hasText: "你 ·" })).toHaveCount(0);
  await expect(page.locator(".combatant-mini", { hasText: "你" })).toBeVisible();
  const state = await readState(page);
  expect(state.rosterVersion).toBeUndefined();
  expect(state.characterId).toBeUndefined();
});
