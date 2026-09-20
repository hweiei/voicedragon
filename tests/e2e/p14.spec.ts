/**
 * P14 声之细织 E2E（无麦克风环境下的接线与降级核对；纯规则见 ../unit/*、
 * 契约见 ../contract/p14-refine.test.ts、策略级时延见 ../sim/p14-latency.test.ts）：
 * 1. 设置页「自动收音」默认开 → 可关 → 刷新后仍关；调试探针与设置一致。
 * 2. 端点策略调试口（与 worker 同一份纯策略）：无麦克风也能核对开口/收口行为。
 * 3. 自适应难度 2.0：结算计账（按幕），且徽标/设置文案如实（本地启发式）。
 * 4. QTE 一局施法照常（端点策略不碰无声通道）。
 */

import { type Page, expect, test } from "@playwright/test";
import { GameEngine, type GameState } from "../../src/core/engine";

type TowerWindow = typeof window & {
  __VOICE_TOWER__: {
    engine: GameEngine;
    getState: () => GameState;
    voice: {
      autoCapture: () => boolean;
      endpointPolicy: (frames: { voice: boolean; nowMs: number }[]) => string[];
      difficulty: () => string;
      recordResult: (
        context: { endless?: boolean; campaign?: boolean; act?: number },
        won: boolean
      ) => string;
    };
  };
};

/**
 * 预设设置档。**幂等**：已存在则不覆盖——否则 reload 会把用例里刚改的开关冲回默认，
 * 让「设置持久化」这条断言假绿/假红（首屏写入、后续 reload 保留玩家选择，与真实行为一致）。
 */
async function preset(page: Page, settings: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((extra) => {
    if (localStorage.getItem("voice-tower-settings-v1")) return;
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({
        sound: false,
        music: false,
        tutorialSeen: true,
        reduceMotion: true,
        ...extra
      })
    );
  }, settings);
  await page.goto("/");
}

function debugVoice(page: Page) {
  return page.evaluateHandle(() => (window as unknown as TowerWindow).__VOICE_TOWER__.voice);
}

test("设置页「自动收音」：默认开、可关、刷新后仍关，调试探针同步", async ({ page }) => {
  await preset(page);
  const voice = await debugVoice(page);
  expect(
    await page.evaluate(
      (handle) => (handle as never as { autoCapture: () => boolean }).autoCapture(),
      voice
    )
  ).toBe(true);

  await page.getByRole("button", { name: "设置" }).click();
  const toggle = page.locator("#set-auto-capture");
  await expect(toggle).toBeChecked();
  await expect(page.locator("label:has(#set-auto-capture)")).toContainText("自动收音");
  await toggle.uncheck();
  await expect(page.locator(".toast")).toContainText("自动收音已关");

  expect(
    await page.evaluate(
      (handle) => (handle as never as { autoCapture: () => boolean }).autoCapture(),
      voice
    )
  ).toBe(false);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("voice-tower-settings-v1")!)
  );
  expect(saved.autoCapture).toBe(false);

  // 刷新：设置持久化（旧档缺省 = 开，这里显式关了就该一直是关）
  await page.reload();
  const voiceAfter = await debugVoice(page);
  expect(
    await page.evaluate(
      (handle) => (handle as never as { autoCapture: () => boolean }).autoCapture(),
      voiceAfter
    )
  ).toBe(false);
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.locator("#set-auto-capture")).not.toBeChecked();
});

test("端点策略调试口：400ms 开口 / 300ms 收口，与 worker 同一份纯策略", async ({ page }) => {
  await preset(page);
  const events = await page.evaluate(() => {
    const voice = (window as unknown as TowerWindow).__VOICE_TOWER__.voice;
    const speech = Array.from({ length: 13 }, (_, index) => ({
      voice: true,
      nowMs: (index + 1) * 32
    }));
    const silence = Array.from({ length: 10 }, (_, index) => ({
      voice: false,
      nowMs: 13 * 32 + (index + 1) * 32
    }));
    return voice.endpointPolicy([...speech, ...silence]);
  });
  expect(events.filter((event) => event === "speech-start")).toHaveLength(1);
  expect(events.filter((event) => event === "auto-stop")).toHaveLength(1);
  expect(events.indexOf("speech-start")).toBe(12);
  expect(events.indexOf("auto-stop")).toBe(22);
});

test("自适应难度 2.0：按幕计账，摘要如实（本地启发式，不是 ML）", async ({ page }) => {
  await preset(page);
  const before = await page.evaluate(() =>
    (window as unknown as TowerWindow).__VOICE_TOWER__.voice.difficulty()
  );
  expect(before).toContain("还没有足够的对局");

  const afterWin = await page.evaluate(() =>
    (window as unknown as TowerWindow).__VOICE_TOWER__.voice.recordResult(
      { campaign: true, act: 2 },
      true
    )
  );
  expect(afterWin).toContain("本地启发式评级");
  expect(afterWin).toContain("第2幕 +");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("voice-tower-difficulty-v1")!)
  );
  expect(stored.wins).toBe(1);
  expect(Object.keys(stored.ratings)).toEqual(["act2"]);

  // 关掉自适应：设置仍可关（文案如实）
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.locator("label:has(#set-adaptive)")).toContainText("本地启发式评级");
  await expect(page.locator("label:has(#set-adaptive)")).toContainText("不是机器学习");
});

test("QTE 一局施法照常：端点策略不碰无声通道", async ({ page }) => {
  await preset(page);
  const engine = new GameEngine();
  engine.startNew(20260920);
  engine.startCombat("battle");
  const hand = engine.state.combat!.hand[0];
  await page.evaluate(
    (state) => {
      const tower = (window as unknown as TowerWindow).__VOICE_TOWER__;
      tower.engine.load(state as never);
    },
    JSON.parse(JSON.stringify(engine.state))
  );
  await expect(page.locator(".battle-screen")).toBeVisible();
  const damage = await page.evaluate(() => {
    const tower = (window as unknown as TowerWindow).__VOICE_TOWER__;
    const card = tower.engine.state.combat!.hand[0];
    const result = tower.engine.resolveSkill(card.id, 88, { source: "qte" }, card.index);
    return result?.damage ?? 0;
  });
  expect(damage).toBeGreaterThan(0);
  const log = await page.evaluate(() =>
    (window as unknown as TowerWindow).__VOICE_TOWER__.engine.state.combat!.log.join(" ")
  );
  expect(log).not.toContain("端点");
  expect(log).not.toContain("保底");
  expect(hand.id.length).toBeGreaterThan(0);
});
