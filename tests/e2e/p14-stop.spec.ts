/**
 * P14-fix 移动端修复 E2E（无麦克风/无模型环境的接线契约；
 * 纯规则见 ../unit/voice-flush.test.ts、端点策略见 ./p14.spec.ts）。
 *
 * 「手机点开录音结束不了」的 UI 层契约在此锁住：
 * 1. stub 适配器注入后「开始收音」可用（canListen 看 adapter.ready）；
 * 2. 收音中，主按钮切换为「结束并判定」——stop-listening 第一次有了真实渲染入口
 *    （修复前全仓库只有处理器、没有按钮，手机上完全没有结束手段）；
 * 3. 点击停止 → adapter.stop() 被调用（进入 flush 最终判定路径）；
 * 4. 判定收口（onError/onResult 任一）后，按钮恢复「开始收音」可再开一轮。
 */

import { type Page, expect, test } from "@playwright/test";
import type { VoiceAdapter, VoiceStartOptions } from "../../src/adapters/voice";
import { GameEngine } from "../../src/core/engine";

type TowerWindow = typeof window & {
  __VOICE_TOWER__: {
    engine: GameEngine;
    voice: {
      injectAdapter: (adapter: VoiceAdapter) => void;
    };
  };
};

type StubProbeWindow = typeof window & {
  __stub?: VoiceStartOptions;
  __stubStops?: number;
};

/** 预设设置档（与 p14.spec.ts 同理：幂等，已存在不覆盖）。 */
async function preset(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (localStorage.getItem("voice-tower-settings-v1")) return;
    localStorage.setItem(
      "voice-tower-settings-v1",
      JSON.stringify({ sound: false, music: false, tutorialSeen: true, reduceMotion: true })
    );
  });
  await page.goto("/");
}

/** 注入 stub 适配器：ready 恒真让「开始收音」可用；start/stop 记录调用供断言。 */
async function injectStub(page: Page): Promise<void> {
  await page.evaluate(() => {
    const tower = (window as unknown as TowerWindow).__VOICE_TOWER__;
    tower.voice.injectAdapter({
      id: "stub-e2e",
      supported: true,
      ready: true,
      unlockCapture: () => undefined,
      start(options: VoiceStartOptions) {
        (window as unknown as StubProbeWindow).__stub = options;
      },
      stop() {
        const probe = window as unknown as StubProbeWindow;
        probe.__stubStops = (probe.__stubStops ?? 0) + 1;
      },
      cancel() {
        // stub：取消不参与本契约
      }
    });
  });
}

test("收音停止按钮契约：收音中切换入口、停止走 flush 路径、判定收口后恢复", async ({ page }) => {
  await preset(page);
  // buildAdapter 异步落地真适配器；注入两次夹住时序（幂等，后注入者生效）
  await injectStub(page);
  await page.waitForTimeout(300);
  await injectStub(page);

  // 组一局"有可用手牌"的战斗（同 p14.spec.ts 手法：Node 侧构建状态后 load）
  const engine = new GameEngine();
  engine.startNew(20260920);
  engine.startCombat("battle");
  const usable = engine.state.combat!.hand.find((card) => engine.canUseSkill(card.id, card.index));
  expect(usable).toBeTruthy();
  await page.evaluate(
    (state) => {
      const tower = (window as unknown as TowerWindow).__VOICE_TOWER__;
      tower.engine.load(state as never);
    },
    JSON.parse(JSON.stringify(engine.state))
  );
  await expect(page.locator(".battle-screen")).toBeVisible();

  // 点手牌开语音弹层 → 「开始收音」可用（stub ready=true）
  await page.locator(`.skill-card[data-deck-index="${usable!.index}"]`).click();
  const startButton = page.locator('[data-action="start-listening"]');
  await expect(startButton).toBeEnabled();

  // 开始收音：stub.start 被调用，主按钮切换为手动停止入口
  await startButton.click();
  expect(await page.evaluate(() => Boolean((window as unknown as StubProbeWindow).__stub))).toBe(
    true
  );
  const stopButton = page.locator('[data-action="stop-listening"]');
  await expect(stopButton).toBeEnabled();
  await expect(stopButton).toHaveText("结束并判定");

  // 停止：进入 flush 最终判定路径（修复前手机上这一步不存在）
  await stopButton.click();
  expect(await page.evaluate(() => (window as unknown as StubProbeWindow).__stubStops)).toBe(1);

  // 判定收口（此处走 onError；onResult 同理恢复按钮）→ 「开始收音」回来了
  await page.evaluate(() => {
    (window as unknown as StubProbeWindow).__stub?.onError?.(new Error("stub：E2E 收口"));
  });
  await expect(page.locator('[data-action="start-listening"]')).toHaveText("开始收音");
  await expect(page.locator('[data-action="start-listening"]')).toBeEnabled();
});
