# 部署与发布验收指南

> 首选 Cloudflare Pages（纯静态 `dist/`、可下发安全头）；GitHub Pages 为零密钥备选。
> P8-E 自动门见 `docs/RELEASE-READINESS-PLAN.md`，必须依赖真机/线上域名的项目见 `docs/DEVICE-TEST-MATRIX.md`。

## 1. 发布前一键验收

新环境先安装三种 Playwright 浏览器：

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run release:check
```

`release:check` 依次执行：

1. Biome、TypeScript、356 项 Vitest、生产构建。
2. 游戏本体 JS gzip 预算与 44 项 PWA 发布产物契约。
3. 32 项 Chromium 业务 E2E。
4. Chromium 桌面 / Chromium 触屏 / Firefox 桌面 / WebKit iPhone 模拟发布矩阵。
5. Lighthouse 移动端 + 桌面预算。
6. P8-B 三幕平衡回归。

可拆分执行：

```bash
npm run ci                 # 静态检查、356 测试、构建、体积、产物契约
npm run test:e2e           # Chromium 完整业务流
npm run test:release       # 四项目轻量发布矩阵
npm run test:lighthouse    # 移动/桌面 Lighthouse 硬预算
npm run sim:p8b            # P8-B 参考 Bot 平衡门
npm run release:artifact   # 仅重建并检查 dist 发布契约
```

## 2. Cloudflare Pages（推荐）

### 一次性配置

1. Cloudflare Dashboard → Workers & Pages → Create → Pages，以 Direct Upload 建立项目 `voicedragon`。
2. My Profile → API Tokens → Create Token，使用 **Cloudflare Pages — Edit** 最小权限模板。
3. GitHub 仓库 → Settings → Secrets and variables → Actions 添加：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

### 发布

- Actions → `deploy-pages` → Run workflow。
- 工作流执行 `npm run ci` 后才上传 `dist/`。
- 默认只允许手动触发；确认生产环境后，才可自行在 workflow 中启用 main push，仓库不会替你自动打开生产部署。

### Cloudflare 响应头

`public/_headers` 会复制到 `dist/_headers`，包含：

- `/assets/*`：一年 immutable；`index.html`、manifest、`sw.js`：no-cache。
- CSP：同源脚本，Blob AudioWorklet / Worker，WASM，以及 Hugging Face / hf.co 模型 CDN；禁止第三方 frame、对象和外部表单。
- `Permissions-Policy: microphone=(self)`，摄像头与地理位置关闭。
- HSTS、nosniff、DENY frame、严格 referrer 与同源资源策略。

没有启用 COOP/COEP：当前 sherpa WASM 使用单线程 SIMD，避免跨源隔离破坏兼容性。以后若开启多线程，必须重新审计所有资源和模型 CDN。

## 3. GitHub Pages（备选）

1. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
2. Actions → `pages` → Run workflow。
3. 访问 `https://<用户名>.github.io/voicedragon/`。

工作流以 `--base=/voicedragon/` 构建，并在上传前用同一发布契约检查所有 HTML 资源前缀。manifest 的 `id/start_url/scope` 保持相对路径。

限制：

- 私有仓库 Pages 需要相应 GitHub 账户套餐。
- GitHub Pages 不读取 Cloudflare `_headers`，因此无法获得仓库定义的 CSP / Permissions-Policy / HSTS；安全头是选择 Cloudflare 的主要理由之一。

## 4. 自动化验收现状

- PWA 产物契约：**44/44**（默认相对 base 与 `/voicedragon/` 子路径均通过）。
- Chromium 业务 E2E：**32/32**。
- 发布矩阵：**19 通过 / 1 明确跳过**；跳过项为 Playwright WebKit 离线模拟器限制，必须在 Safari 真机补验。
- Lighthouse：移动 **99/100/100/100**，桌面 **100/100/100/100**；详见 `docs/LIGHTHOUSE-REPORT.md`。
- 游戏本体 JS：**84.5 / 350 KB gzip**。
- P8-B 参考 Bot：三幕 **56.7% / 56.3% / 55.3%**，零超时。

## 5. 部署后必须人工完成

以下项目在没有真实 URL 或设备时保持未完成，不能用本地测试替代：

- [ ] 对生产 URL 执行 `curl -I`，确认 `_headers` 实际生效。
- [ ] 线上移动/桌面 Lighthouse，记录 URL、时间、报告版本。
- [ ] iOS Safari 添加到主屏、safe-area、断网冷启动、麦克风与文件导入导出。
- [ ] Android Chrome 安装、断网冷启动、麦克风与本地存档恢复。
- [ ] 约 230MB 模型在真实移动网络中的 Range、CORS、断点续传和飞行模式推理。
- [ ] og/twitter 1200×630 分享图在真实聊天工具中的抓取效果。
- [ ] 旧 Service Worker 客户端发版更新，不强制打断进行中的局。

逐项步骤与记录模板见 `docs/DEVICE-TEST-MATRIX.md`。
