# P8-E · 发布与设备验收详细方案

> 2026-09-19 · 用户选择 P8-E「发布与设备验收」。本期先把可自动化的发布契约、跨浏览器冒烟、PWA 离线与 Lighthouse 预算接入质量门，再把必须依赖真机或线上域名的项目明确留在人工矩阵中。
> 本期不新增后端、账号、遥测或语音上传，不改变战斗评分、平衡数值、存档规则和学习档案格式。

## 1. 目标与当前缺口

P8-D 之后功能已完整，但“本地跑通”仍不等于“可以稳妥发布”：

1. 当前 32 项 Playwright 只跑 Chromium 桌面配置，不能代表 Firefox、WebKit 或触屏窄屏。
2. 构建会生成 manifest 与 Service Worker，但尚无自动化测试证明安装壳在断网重载后仍可进入标题页。
3. Lighthouse 只有一次人工报告，分数和 Web Vitals 没有变成可失败的预算门。
4. Cloudflare / GitHub Pages 工作流只负责构建上传，没有验证最终 `dist/` 的图标、manifest、SW、相对路径和安全头契约。
5. P8-D 已覆盖导入成功和取消，但非法 JSON、未知版本、超限文件的“零副作用”仍需要浏览器级验收。
6. iOS 安装、移动网络模型续传、分享卡片抓取等无法由本地模拟器诚实替代，需要独立真机/线上清单，不能写成已通过。

## 2. E1 构建产物发布契约

新增 `scripts/release-readiness.ts`，在真实 `dist/` 上执行并失败退出：

- 必需文件：入口、manifest、Service Worker、注册脚本、192/512 图标、分享图、robots 与 Cloudflare `_headers`。
- manifest：`id/start_url/scope` 使用子路径友好的相对值；standalone、竖屏、主题色与 any/maskable 图标齐备。
- HTML：标题、描述、viewport、manifest、入口 JS/CSS、图标和分享图存在；默认构建不得残留 localhost、源码入口或站点根绝对资源路径。
- Service Worker：预缓存入口、主 JS/CSS、manifest 与图标；不得把 230MB 模型数据包误塞进安装壳。
- 安全头：缓存策略、MIME 嗅探保护、权限策略、拒绝嵌入与 CSP 的关键边界存在。
- 发布产物不得包含 `.env`、凭据命名文件或模型 `.data`。

Cloudflare 默认相对路径与 GitHub Pages `/voicedragon/` 子路径构建都调用同一检查器；不自动开启部署触发器，也不接触仓库 Secrets。

## 3. E2 跨浏览器与移动视口矩阵

新增独立 `playwright.release.config.ts`，只跑发布冒烟而不把 32 项完整业务流乘四：

- Chromium 桌面：标准发布壳与 Service Worker。
- Chromium 触屏移动：Pixel 7 设备参数。
- Firefox 桌面：无 Chromium 专属 API 时仍可打开、浏览报告并走降级路径。
- WebKit 移动：iPhone 13 设备参数，验证安全区、触控布局与本地档案 UI。

发布冒烟覆盖：

1. 标题、设置、学习报告可达，无页面错误、无失败的同源壳资源、无横向溢出。
2. 320px 极窄视口仍可操作；所有关键动作保持可见。
3. 非法 JSON、未知档案版本与大于 1 MiB 文件全部拒绝，SRS / 游戏哨兵 / 设置零变化。
4. Chromium 与 Firefox 中等待 Service Worker 控制页面后切断网络，重载仍能进入标题页并打开设置；Playwright WebKit 的离线模拟若绕过 SW，必须明确跳过并转入真机矩阵。

WebKit 模拟不宣称等于 iOS 实机；麦克风权限、系统粤语 TTS、主屏安装、离线冷启动和软键盘仍进入人工矩阵。

## 4. E3 Lighthouse 可执行预算

新增 `scripts/lighthouse-budget.ts`：自行启动本地 preview、运行仓库锁定版本的 Lighthouse、读取 JSON、打印摘要并清理临时进程/报告。移动端在共享 CI CPU 节流下取三次中位数（不取最好值），桌面单次。

硬门：

- Performance / Accessibility / Best Practices / SEO 均不低于 0.95。
- LCP ≤ 2500 ms、TBT ≤ 200 ms、CLS ≤ 0.10。
- 沿用游戏本体 JS ≤ 350 KB gzip；Lighthouse 不替代现有体积门。

报告文档记录最后一次通过值；CI 不提交每次生成的原始 JSON，避免仓库噪声。

## 5. E4 部署与安全收口

- Cloudflare `_headers` 增补 CSP、拒绝 iframe、HSTS、跨域资源策略；明确允许同源 Worker、Blob AudioWorklet / 模型句柄和 Hugging Face 模型下载，不扩大麦克风权限。
- CI 在构建后运行发布产物检查；E2E job 安装 Chromium / Firefox / WebKit，分别跑完整 Chromium 业务流与轻量发布矩阵，并执行 Lighthouse 预算。
- GitHub Pages 构建后以 `/voicedragon/` 作为允许前缀运行产物检查。
- 更新 `docs/DEPLOY.md`、`docs/LIGHTHOUSE-REPORT.md`、`AGENTS.md` 和总路线图；新增真机/线上矩阵，所有未实测项保持未勾选。

## 6. 验收门

- 原 37 个 Vitest 文件 356 项、32 项 Chromium E2E 不放宽。
- 发布矩阵四项目的适用场景全绿；WebKit 离线模拟器已知限制必须显示为 skip 并保留真机验收，不能把失败吞成通过。
- `npm run ci` 包含发布产物契约并全绿。
- `npm run test:release`、`npm run test:lighthouse`、`npm run sim:p8b` 全绿。
- 首包游戏本体 JS ≤350 KB gzip；P8-B 参考 Bot 三幕 45–65%、零超时。
- Git 工作区无报告垃圾、浏览器缓存、凭据或构建产物入库；CodeGraph 同步后再提交。

## 7. 明确不做与诚实边界

- 不把 Playwright WebKit 写成“iPhone 实机已通过”。
- 不在没有线上域名时宣称社交分享抓图、真实 CDN 缓存头或网络 LCP 已通过。
- 不在 CI 下载 230MB 语音模型；只验证下载入口和发布壳，不伪造真人粤语准确率。
- 不自动开启 Cloudflare / GitHub Pages 的 main 推送部署，避免未配置环境时误发布。
- 不为发布门修改战斗数值、语音评分权重、SRS 统计或学习档案 v1。

## 8. 实施与验收记录

2026-09-19 已完成可自动化部分：

- 新增 44 项 `dist` 发布契约；默认 `./` 与 GitHub Pages `/voicedragon/` 两种 base 均验证 manifest、Service Worker、图标实际尺寸、主资源路径、安全头和凭据/模型数据排除。
- PWA 注册脚本改为 defer；Cloudflare 头新增 CSP、HSTS、frame/object/form 限制和最小权限策略，同时保留 Blob Worker/AudioWorklet、WASM 及 Hugging Face/hf.co 模型 CDN。
- 新增四项目发布矩阵：Chromium 桌面、Chromium 触屏移动、Firefox 桌面、WebKit iPhone 模拟共 **19 通过 / 1 明确跳过**。跳过项只限 Playwright WebKit 离线模拟器；Safari 真机仍未验收。
- 新增移动端 + 桌面 Lighthouse 可执行门：最近实测移动 **99/100/100/100**、桌面 **100/100/100/100**；LCP/TBT/CLS 均在预算内。
- CI 与两条 Pages 工作流已接入产物契约、三浏览器安装、发布矩阵和 Lighthouse；新增 `npm run release:check` 总门。
- 原回归保持：37 个 Vitest 文件 **356/356**、Chromium E2E **32/32**、游戏本体 JS **84.5/350 KB gzip**；P8-B 三幕参考胜率 **56.7% / 56.3% / 55.3%**、零超时。
- 真机与线上项没有伪造结论，已集中到 `docs/DEVICE-TEST-MATRIX.md`，等待部署 URL、iOS/Android 设备与真实移动网络。
