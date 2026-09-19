# Lighthouse 实测报告（本地 preview）

> 2026-09-19 · `vite build` 产物 + `vite preview`（4173 端口）· `--preset=desktop`
> 命令：`npx lighthouse http://localhost:4173 --preset=desktop --only-categories=performance,accessibility,best-practices,seo`

## 得分

| 类目 | 得分 |
| --- | --- |
| Performance | **100** |
| Accessibility | **100**（修复 viewport 缩放限制后） |
| Best Practices | **100** |
| SEO | **100**（补 robots.txt 后） |

> Lighthouse v12 已移除 PWA 评分类目；可安装性核验：`manifest.webmanifest`（相对 start_url，子路径部署友好）
> + `sw.js`（Workbox 预缓存 16 项）+ 192/512/maskable 图标齐备，E2E 四条流均跑在 preview 产物上。

## 关键指标（预算 vs 实测）

| 指标 | 预算 | 实测 |
| --- | --- | --- |
| LCP | < 2.5 s | **0.4 s** |
| FCP | — | 0.4 s |
| TBT | < 200 ms | **0 ms** |
| CLS | < 0.1 | 0.006 |
| TTI | ≤ 2.5 s | 0.4 s |
| 首包游戏 JS（gzip） | ≤ 350 KB | **59.2 KB**（CI 守卫：`npm run perf`） |

## 本轮依据报告做的修复

1. **viewport**：移除 `maximum-scale=1, user-scalable=no`（无障碍：允许缩放）；
   误触双击缩放改由 `body { touch-action: manipulation }` 压制。
2. **robots.txt**：新增 `public/robots.txt`（允许全部抓取）。

## 遗留提示（不影响得分）

- render-blocking CSS 约 50 ms、未用 JS 约 34 KiB（首屏外的练习场/海报模块）——余量极大，暂不处理。
- 线上（真实网络）LCP/INP 请部署后按 `docs/DEPLOY.md` 清单复跑。
