import { defineConfig } from "@playwright/test";

/**
 * P15 视觉回归（GROWTH-PLAN §7.2 / P15-FORGE-PLAN §2）：
 * 4 屏（标题/战斗/学习报告/图鉴）× 2 视口（390/1280）× reduce-motion 开/关 = 16 基线。
 * - 只锁 Chromium（跨浏览器渲染差异大、收益低；逻辑仍由发布矩阵覆盖）；
 * - 基线随仓库提交；更新必须人工过目后 `npm run test:visual -- --update-snapshots`；
 * - 字体走系统栈（无外部字体加载）；CI 需安装 fonts-noto-cjk 保证中文渲染一致。
 */

export default defineConfig({
  testDir: "tests/e2e/visual",
  timeout: 30_000,
  fullyParallel: true,
  workers: 1, // Bounded browser memory; CLI --workers may override for larger runners.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: {
    // 抗锯齿/字距微差容差：拦布局回归，不拦像素噪声
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 }
  },
  use: {
    baseURL: "http://localhost:4174"
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } }
  ],
  webServer: {
    command: "npm run preview -- --port 4174 --strictPort",
    url: "http://localhost:4174",
    reuseExistingServer: false,
    timeout: 60_000
  }
});
