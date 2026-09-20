/**
 * P12 切磋码 E2E（零后端异步对战；纯规则与契约见 ../unit/challenge.test.ts、
 * ../contract/p12-challenge.test.ts）：
 * 1. 标题屏贴码应战 → 契约卡 → 开局：地图/牌组/楼层选项与码逐位一致。
 * 2. URL 片段自动弹应战面板；坏码与跨版本码明确警告且不放行（旧链接不崩）。
 * 3. 结算屏「发起切磋」→ 另开页面同码开局：两端初态一致（种子即链接）。
 * 4. 切磋局结算写入本机战绩簿并在结算屏展示同码最佳。
 */

import { type Page, expect, test } from "@playwright/test";
import { type ChallengeBundle, decodeChallenge, encodeChallenge } from "../../src/core/challenge";
import { GameEngine, type GameState } from "../../src/core/engine";

type TowerWindow = typeof window & {
  __VOICE_TOWER__: { engine: GameEngine; getState: () => GameState };
};

const BUNDLE: ChallengeBundle = {
  mode: "campaign",
  act: 1,
  seed: 20260920,
  ruleset: "p7",
  build: 1,
  encounter: 1,
  counter: 1,
  roster: 1,
  ultimate: 1,
  character: "faa-daan"
};

function codeFor(bundle: ChallengeBundle): string {
  const encoded = encodeChallenge(bundle);
  if (!encoded.ok) throw new Error(`测试码构造失败：${encoded.detail}`);
  return encoded.code;
}

async function preset(page: Page, url = "/"): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({ sound: false, music: false, tutorialSeen: true, reduceMotion: true })
    );
  });
  await page.goto(url);
}

async function readState(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("voice-tower-save-v2")!).state);
}

test("标题屏贴码应战：契约卡 → 开局，地图与牌组与码一致", async ({ page }) => {
  const code = codeFor(BUNDLE);
  await preset(page);
  await page.getByRole("button", { name: "切磋码 · 应战同局" }).click();
  await expect(page.locator(".duel-sheet")).toBeVisible();
  await page.locator("#duel-code-input").fill(code);
  await page.getByRole("button", { name: "解析切磋码" }).click();
  const contract = page.locator(".duel-contract");
  await expect(contract).toBeVisible();
  await expect(contract).toContainText("绝技 v1"); // 版本束标签逐项可见
  await expect(contract).toContainText("花旦");
  await page.getByRole("button", { name: "以这个码开局 · 同码同局" }).click();

  await expect(page.locator(".duel-banner")).toBeVisible();
  const state = await readState(page);
  expect(state.challengeVersion).toBe(1);
  expect(state.duel!.code).toBe(code);
  expect(state.duel!.hash).toHaveLength(8);
  expect(state.ruleset).toBe("p7");
  expect(state.characterId).toBe("faa-daan");
  expect(state.campaign!.act).toBe(1);
  expect(state.campaign!.map.seed).toBe(BUNDLE.seed);

  // 与本地引擎直开同码逐位一致：地图、牌组、起始楼层选项
  const decoded = decodeChallenge(code);
  if (!decoded.ok) throw new Error(`码解析失败：${decoded.detail}`);
  const local = new GameEngine();
  local.startChallenge(decoded.challenge);
  expect(JSON.stringify(state.campaign!.map)).toBe(JSON.stringify(local.state.campaign!.map));
  expect(state.player!.deck).toEqual(local.state.player!.deck);
  expect(JSON.stringify(state.floorOptions)).toBe(JSON.stringify(local.state.floorOptions));
  // 应战后清掉片段：刷新不再重弹
  expect(new URL(page.url()).hash).toBe("");
});

test("URL 片段自动弹应战面板", async ({ page }) => {
  await preset(page, `/?duel=1#c=${codeFor(BUNDLE)}`);
  await expect(page.locator(".duel-sheet")).toBeVisible();
  await expect(page.locator(".duel-contract")).toBeVisible();
  await page.getByRole("button", { name: "以这个码开局 · 同码同局" }).click();
  await expect(page.locator(".duel-banner")).toBeVisible();
  const state = await readState(page);
  expect(state.duel!.code).toBe(codeFor(BUNDLE));
});

test("坏码与跨版本码明确警告且不放行；标题屏照常可用", async ({ page }) => {
  await preset(page, "/?duel=bad#c=VT1.###.###");
  await expect(page.locator(".duel-warning")).toBeVisible();
  await expect(page.locator(".duel-warning")).toContainText("无法识别");
  await expect(page.getByRole("button", { name: "以这个码开局 · 同码同局" })).toHaveCount(0);
  await page.getByRole("button", { name: "关闭" }).click();
  await expect(page.getByRole("button", { name: "开始登楼" })).toBeVisible();

  // 跨版本前缀：明确说「码来自更新的版本」，仍不放行
  await page.goto("/?duel=future#c=VT2.AAAA.BBBB");
  await expect(page.locator(".duel-warning")).toContainText("更新的版本");
  await expect(page.getByRole("button", { name: "以这个码开局 · 同码同局" })).toHaveCount(0);
  // 从未开局：没有切磋身份落进存档
  const save = await page.evaluate(() => localStorage.getItem("voice-tower-save-v2"));
  expect(save).toBeNull();
});

test("结算屏「发起切磋」→ 另开页面同码开局：两端初态一致", async ({ page }) => {
  await preset(page);
  await page.evaluate(() => {
    const tower = (window as unknown as TowerWindow).__VOICE_TOWER__;
    tower.engine.startCampaign({
      act: 1,
      seed: 20260920,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1,
      counterVersion: 1,
      rosterVersion: 1,
      ultimateVersion: 1,
      character: "faa-daan"
    });
    tower.engine.state.phase = "victory";
    tower.engine.emit({ save: true });
  });
  await page.getByRole("button", { name: "发起切磋 · 把这局变成码" }).click();
  const code = (await page.locator(".duel-code").first().innerText()).trim();
  expect(code).toMatch(/^VT1\./);
  await expect(page.locator(".duel-sheet")).toContainText("声震龙楼 ·");
  const firstMap = await page.evaluate(() =>
    JSON.stringify((window as unknown as TowerWindow).__VOICE_TOWER__.engine.state.campaign!.map)
  );
  const firstDeck = await page.evaluate(() =>
    JSON.stringify((window as unknown as TowerWindow).__VOICE_TOWER__.engine.state.player!.deck)
  );

  const second = await page.context().newPage();
  await second.addInitScript(() => {
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({ sound: false, music: false, tutorialSeen: true, reduceMotion: true })
    );
  });
  await second.goto(`/?duel=peer#c=${code}`);
  await expect(second.locator(".duel-contract")).toBeVisible();
  await second.getByRole("button", { name: "以这个码开局 · 同码同局" }).click();
  await expect(second.locator(".duel-banner")).toBeVisible();
  const secondMap = await second.evaluate(() =>
    JSON.stringify((window as unknown as TowerWindow).__VOICE_TOWER__.engine.state.campaign!.map)
  );
  const secondDeck = await second.evaluate(() =>
    JSON.stringify((window as unknown as TowerWindow).__VOICE_TOWER__.engine.state.player!.deck)
  );
  expect(secondMap).toBe(firstMap);
  expect(secondDeck).toBe(firstDeck);
  await second.close();
});

test("切磋局结算写入本机战绩簿，并在结算屏显示同码最佳", async ({ page }) => {
  const code = codeFor(BUNDLE);
  await preset(page, `/?duel=record#c=${code}`);
  await page.getByRole("button", { name: "以这个码开局 · 同码同局" }).click();
  await page.evaluate(() => {
    const tower = (window as unknown as TowerWindow).__VOICE_TOWER__;
    tower.engine.state.floor = 9;
    tower.engine.state.phase = "defeat";
    tower.engine.emit({ save: true });
  });
  const panel = page.locator(".duel-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("本机同码最佳");
  await expect(panel).toContainText("第 9 层");
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("voice-tower-challenge-v1") ?? "{}")
  );
  expect(Object.keys(records)).toHaveLength(1);
  expect(records[Object.keys(records)[0]].floor).toBe(9);

  // 切磋局「再闯一局」= 重开同一枚码（同码同局可反复冲自己的战绩簿）
  await page.getByRole("button", { name: "再闯一局" }).click();
  await expect(page.locator(".duel-banner")).toBeVisible();
  const restarted = await readState(page);
  expect(restarted.duel!.code).toBe(code);
  expect(restarted.campaign!.map.seed).toBe(BUNDLE.seed);
});
