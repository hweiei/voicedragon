import { defineConfig } from "@playwright/test";

/**
 * E2E（方案 §9）：标题 → 选路 → 战斗 → 施法（破阵拍 Mock）→ 存档恢复。
 * 跑在 vite preview（真实构建产物 + PWA）上；语音用无声 QTE 通道，无需真麦。
 */

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: ["visual/**"], // P15 视觉门独立配置 playwright.visual.config.ts
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173"
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 60_000
  }
});
