# 部署指南

> 方案 §13 决策 1：Cloudflare Pages（纯静态 `dist/`，零后端）；GitHub Pages 为零配置备选。
> 两条路线都已备好工作流：`.github/workflows/deploy-pages.yml`（Cloudflare）与 `.github/workflows/pages.yml`（GitHub Pages）。

## 路线二：GitHub Pages（零密钥，最快上线）

1. 仓库 **Settings → Pages → Build and deployment → Source 选 “GitHub Actions”**（唯一的开关）。
2. Actions → **pages** → Run workflow（此后 main 每次推送自动部署）。
3. 访问 `https://<用户名>.github.io/voicedragon/`（构建时自动带 `/voicedragon/` 子路径 base）。

限制：私有仓库的 Pages 需要账户支持（GitHub Pro/Team/Enterprise）；免费账户可将仓库设为 public，或走 Cloudflare 路线。

---

## 路线一：Cloudflare Pages（推荐，可设响应头）

## 一次性配置

1. **建 Pages 项目**：Cloudflare Dashboard → Workers & Pages → Create → Pages →
   "Direct Upload" 先用任意 `dist/` 建立项目，项目名 `voicedragon`（或改 workflow 里的 `--project-name`）。
2. **建 API Token**：My Profile → API Tokens → Create Token → 模板 **"Cloudflare Pages — Edit"**。
3. **配仓库密钥**：GitHub 仓库 → Settings → Secrets and variables → Actions：
   - `CLOUDFLARE_API_TOKEN`（第 2 步的 token）
   - `CLOUDFLARE_ACCOUNT_ID`（Dashboard 右侧栏 Account ID）

## 日常发布

- **手动**：Actions → deploy-pages → Run workflow（跑完整 `npm run ci` 后上传 `dist/`）。
- **自动**：把 `deploy-pages.yml` 里 `on:` 段的 `push: branches: [main]` 取消注释，
  此后 main 每次推送自动部署（CI 先全绿才会执行到部署步）。

## 头与缓存（`public/_headers`，构建时自动带入 dist）

- `/assets/*`：内容哈希命名 → `max-age=31536000, immutable`
- `/sw.js`、`/index.html`：`no-cache`，保证发版即时生效（PWA 更新提示由 Workbox 处理）
- 全站：`X-Content-Type-Options` / `Referrer-Policy` / `Permissions-Policy: microphone=(self)`
- **未启用 COOP/COEP**：sherpa WASM 走单线程 SIMD 已达标，避免隔离头带来的外链兼容成本；
  如后续要多线程，可在 `_headers` 追加 `Cross-Origin-Opener-Policy: same-origin` +
  `Cross-Origin-Embedder-Policy: require-corp` 并全站自审资源。

## 发布后验收清单

- [x] Lighthouse 本地实测（vite preview + `npx lighthouse --preset=desktop`，2026-09-19）：
      **Performance 100 / Best Practices 100 / SEO 100 / Accessibility 100**，
      FCP 0.4s · LCP 0.4s · TBT 0ms · CLS 0.006 —— 见 `docs/LIGHTHOUSE-REPORT.md`
      （Lighthouse v12 已移除 PWA 评分类目；可安装性以 manifest + SW + 图标齐备为准，E2E 走 preview 产物验证）
- [ ] 线上复跑 Lighthouse（部署域名）确认网络环境下的 LCP/INP
- [ ] 性能预算：首包游戏 JS ≤ 350 KB gzip（本地实测 59.2 KB，`npm run perf`）
- [ ] iOS Safari 实机：可安装（分享 → 添加到主屏幕）、可玩（保底 WebSpeech / 破阵拍）
- [ ] 模型下载（设置页 → 端侧引擎 → 下载约 238 MB）在移动网络下断点续传可用
- [ ] 分享卡片：og/twitter 图在聊天工具里正常预览

## 本地验证命令

```bash
npm run ci        # lint + 类型 + 150 项测试 + 构建 + 性能预算
npm run test:e2e  # 构建 + Playwright 冒烟（标题→地图→战斗→施法→存档恢复）
npm run sim       # 平衡仿真报表（docs/BALANCE-REPORT.md）
npm run perf      # 单独跑性能预算
```
