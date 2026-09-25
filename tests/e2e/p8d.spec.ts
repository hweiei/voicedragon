import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

function settings() {
  return JSON.stringify({
    sound: false,
    music: false,
    tutorialSeen: true,
    reduceMotion: true
  });
}

function stats(voiceAttempts: number, skillsUsed: string[] = []) {
  return {
    voiceAttempts,
    sumWord: voiceAttempts * 75,
    toneCount: 0,
    sumTone: 0,
    sumConfidence: voiceAttempts * 80,
    skillsUsed,
    toneMastery: {}
  };
}

test("P8-D 标题显示今日三个不同短句目标与连续练习", async ({ page }) => {
  await page.addInitScript((savedSettings) => {
    const dateKey = (offset: number) => {
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    localStorage.setItem("voice-tower-settings-v1", savedSettings);
    localStorage.setItem(
      "voice-tower-srs-v1",
      JSON.stringify({
        entries: {},
        stats: {
          voiceAttempts: 4,
          sumWord: 300,
          toneCount: 0,
          sumTone: 0,
          sumConfidence: 320,
          skillsUsed: ["ding-ngang-soeng", "m-sai-geng"],
          toneMastery: {}
        },
        history: [
          {
            dateKey: dateKey(-1),
            attempts: 2,
            sumScore: 140,
            sumWord: 150,
            toneCount: 0,
            sumTone: 0,
            practicedIds: ["ding-ngang-soeng"]
          },
          {
            dateKey: dateKey(0),
            attempts: 2,
            sumScore: 155,
            sumWord: 160,
            toneCount: 0,
            sumTone: 0,
            practicedIds: ["ding-ngang-soeng", "m-sai-geng"]
          }
        ]
      })
    );
  }, settings());
  await page.goto("/?mode=classic");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  const goal = page.getByLabel("今日开口目标");
  await expect(goal).toContainText("今日开口 2/3");
  await expect(goal).toContainText("连续练习 2 天");
  await expect(goal).toContainText("还差 1 个不同短句");
  await expect(goal.locator(".practice-goal-dot.done")).toHaveCount(2);
});

test("P8-D 报告展示14日空档/变化并导出白名单化JSON", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((savedSettings) => {
    const dateKey = (offset: number) => {
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    localStorage.setItem("voice-tower-settings-v1", savedSettings);
    localStorage.setItem(
      "voice-tower-srs-v1",
      JSON.stringify({
        entries: {},
        stats: {
          voiceAttempts: 4,
          sumWord: 290,
          toneCount: 0,
          sumTone: 0,
          sumConfidence: 320,
          skillsUsed: ["ding-ngang-soeng"],
          toneMastery: {},
          transcript: "不应导出"
        },
        history: [
          {
            dateKey: dateKey(-12),
            attempts: 1,
            sumScore: 60,
            sumWord: 70,
            toneCount: 0,
            sumTone: 0,
            practicedIds: ["ding-ngang-soeng"]
          },
          {
            dateKey: dateKey(-11),
            attempts: 1,
            sumScore: 64,
            sumWord: 72,
            toneCount: 0,
            sumTone: 0,
            practicedIds: ["ding-ngang-soeng"]
          },
          {
            dateKey: dateKey(-1),
            attempts: 1,
            sumScore: 78,
            sumWord: 80,
            toneCount: 0,
            sumTone: 0,
            practicedIds: ["ding-ngang-soeng"]
          },
          {
            dateKey: dateKey(0),
            attempts: 1,
            sumScore: 82,
            sumWord: 84,
            toneCount: 0,
            sumTone: 0,
            practicedIds: ["ding-ngang-soeng"]
          }
        ],
        rawAudio: "secret"
      })
    );
  }, settings());
  await page.goto("/?mode=classic");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  await page.getByRole("button", { name: "学习报告" }).click();
  const trend = page.locator(".learning-trend-panel");
  await expect(trend).toContainText("较前半段 +18 分");
  await expect(trend.locator(".learning-trend-day")).toHaveCount(14);
  await expect(trend.locator(".learning-trend-day.empty")).toHaveCount(10);
  await expect(trend).toContainText("近 14 天有练习");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出学习档案" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^voice-tower-learning-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const archive = JSON.parse(await readFile(path!, "utf8"));
  expect(archive.kind).toBe("voice-tower-learning");
  expect(archive.version).toBe(1);
  expect(JSON.stringify(archive)).not.toContain("不应导出");
  expect(JSON.stringify(archive)).not.toContain("rawAudio");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
});

test("P8-D 导入先预览；取消零副作用，确认后只覆盖学习档案", async ({ page }) => {
  await page.addInitScript(
    ({ savedSettings, currentStats }) => {
      localStorage.setItem("voice-tower-settings-v1", savedSettings);
      localStorage.setItem(
        "voice-tower-srs-v1",
        JSON.stringify({ entries: {}, stats: currentStats, history: [] })
      );
      localStorage.setItem("unrelated-game-sentinel", "keep-me");
    },
    { savedSettings: settings(), currentStats: stats(1, ["ding-ngang-soeng"]) }
  );
  await page.goto("/?mode=classic");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __VOICE_TOWER__?: unknown }).__VOICE_TOWER__)
  );
  await page.getByRole("button", { name: "学习报告" }).click();

  const archive = {
    kind: "voice-tower-learning",
    version: 1,
    exportedAt: new Date().toISOString(),
    store: {
      entries: {},
      stats: stats(9, ["ding-ngang-soeng", "m-sai-geng"]),
      history: []
    }
  };
  const upload = async () =>
    page.locator("#learning-import-input").setInputFiles({
      name: "learning.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(archive))
    });

  await upload();
  const sheet = page.locator(".learning-import-sheet");
  await expect(sheet).toContainText("9");
  await expect(sheet).toContainText("开口次数");
  await sheet.getByRole("button", { name: /取消/ }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("voice-tower-srs-v1")!).stats.voiceAttempts
    )
  ).toBe(1);

  await upload();
  await sheet.getByRole("button", { name: "确认覆盖并恢复" }).click();
  await expect(page.locator(".radar-notes")).toContainText("开口练习 9 次");
  const state = await page.evaluate(() => ({
    attempts: JSON.parse(localStorage.getItem("voice-tower-srs-v1")!).stats.voiceAttempts,
    sentinel: localStorage.getItem("unrelated-game-sentinel"),
    settings: localStorage.getItem("voice-tower-settings-v1")
  }));
  expect(state.attempts).toBe(9);
  expect(state.sentinel).toBe("keep-me");
  expect(state.settings).toBe(settings());
});
