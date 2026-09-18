/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    allowedHosts: true,
    port: 5173
  },
  preview: {
    host: true,
    allowedHosts: true
  },
  build: {
    target: "es2022",
    sourcemap: true
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon.svg"],
      devOptions: {
        enabled: false
      },
      manifest: {
        id: "./",
        name: "声震龙楼 · 粤语声攻 Roguelike",
        short_name: "声震龙楼",
        description: "讲得准，打得狠；一路开声，一路登楼",
        lang: "zh-Hans",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#171311",
        theme_color: "#171311",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,woff2,wasm}"],
        navigateFallbackDenylist: [/^\/__/, /manifest\.webmanifest/]
      }
    })
  ]
});
