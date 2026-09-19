import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const CSP = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8").match(
  /^\s*Content-Security-Policy:\s*(.+)$/m
)?.[1];

const SETTINGS = JSON.stringify({
  sound: false,
  music: false,
  tutorialSeen: true,
  reduceMotion: true
});

async function seedLocalState(page: import("@playwright/test").Page) {
  await page.addInitScript((settings) => {
    localStorage.setItem("voice-tower-settings-v1", settings);
    localStorage.setItem(
      "voice-tower-srs-v1",
      JSON.stringify({
        entries: {},
        stats: {
          voiceAttempts: 2,
          sumWord: 150,
          toneCount: 0,
          sumTone: 0,
          sumConfidence: 160,
          skillsUsed: ["ding-ngang-soeng"],
          toneMastery: {}
        },
        history: []
      })
    );
    localStorage.setItem("p8e-release-sentinel", "keep-me");
  }, SETTINGS);
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
}

test("发布壳在浏览器矩阵中可达，manifest 与关键入口完整", async ({ page }) => {
  await seedLocalState(page);
  const pageErrors: string[] = [];
  const failedShellRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(new URL(page.url() || "http://localhost:4175").origin)) {
      failedShellRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".title-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "声震龙楼" })).toBeVisible();
  await expect(page.getByRole("button", { name: /战役 · 第一幕/ })).toBeVisible();
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
    if (!href) return null;
    const response = await fetch(href);
    return response.ok ? response.json() : null;
  });
  expect(manifest).toMatchObject({
    id: "./",
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "portrait"
  });
  expect(pageErrors).toEqual([]);
  expect(failedShellRequests).toEqual([]);
  await expectNoHorizontalOverflow(page);
});

test("Cloudflare CSP 下发布壳仍可启动且无策略拒绝", async ({ context, page }) => {
  expect(CSP).toBeTruthy();
  await seedLocalState(page);
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /content security policy|refused to/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": CSP! }
    });
  });
  await page.goto("/");
  await expect(page.locator(".title-screen")).toBeVisible();
  await expect(page.getByRole("button", { name: /设置 · 语音引擎/ })).toBeVisible();
  expect(violations).toEqual([]);
});

test("320px 极窄视口可打开设置与学习报告，关键触点仍可操作", async ({ page }) => {
  await seedLocalState(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expectNoHorizontalOverflow(page);

  const campaign = page.getByRole("button", { name: /战役 · 第一幕/ });
  const campaignBox = await campaign.boundingBox();
  expect(campaignBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: /设置 · 语音引擎/ }).click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: /下载模型/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.locator('.settings-sheet [data-action="close-modal"]').click();

  await page.getByRole("button", { name: "学习报告" }).click();
  await expect(page.locator(".learning-trend-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "导出学习档案" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("非法、未知版本与超限学习档案均零副作用", async ({ page }) => {
  await seedLocalState(page);
  await page.goto("/");
  await page.getByRole("button", { name: "学习报告" }).click();
  const input = page.locator("#learning-import-input");
  const before = await page.evaluate(() => ({
    srs: localStorage.getItem("voice-tower-srs-v1"),
    settings: localStorage.getItem("voice-tower-settings-v1"),
    sentinel: localStorage.getItem("p8e-release-sentinel")
  }));

  await input.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{")
  });
  await expect(page.locator("#toast")).toContainText("文件不是有效的 JSON");

  await input.setInputFiles({
    name: "future.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        kind: "voice-tower-learning",
        version: 99,
        exportedAt: new Date().toISOString(),
        store: { entries: {}, stats: {} }
      })
    )
  });
  await expect(page.locator("#toast")).toContainText("版本暂不支持");

  await input.setInputFiles({
    name: "too-large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(1024 * 1024 + 1, "x")
  });
  await expect(page.locator("#toast")).toContainText("文件超过 1 MiB");

  const after = await page.evaluate(() => ({
    srs: localStorage.getItem("voice-tower-srs-v1"),
    settings: localStorage.getItem("voice-tower-settings-v1"),
    sentinel: localStorage.getItem("p8e-release-sentinel")
  }));
  expect(after).toEqual(before);
  await expect(page.locator(".learning-import-sheet")).toHaveCount(0);
});

test("安装壳受 Service Worker 控制后可断网重载", async ({ browserName, context, page }) => {
  test.skip(
    browserName === "webkit",
    "Playwright WebKit 的离线网络模拟会绕过已控制页面的 Service Worker；保留真机 Safari 项"
  );
  await seedLocalState(page);
  await page.goto("/");
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service Worker 不可用");
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".title-screen")).toBeVisible();
    await page.getByRole("button", { name: /设置 · 语音引擎/ }).click();
    await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
