# Lighthouse 自动预算报告（本地 preview）

> P8-E 更新：2026-09-19 · `vite build` 真实产物 + `vite preview` · Lighthouse 12.8.2。
> 命令：`npm run test:lighthouse`。脚本自动启动/停止 preview；移动端按三次审计中位数、桌面单次审计执行，原始 JSON 写入临时缓存后删除。

## 1. 硬预算

| 类目 / 指标 | 门限 |
| --- | --- |
| Performance | ≥ 95 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 95 |
| LCP | ≤ 2500 ms |
| TBT | ≤ 200 ms |
| CLS | ≤ 0.10 |
| 游戏本体 JS gzip | ≤ 350 KB（独立 `perf-budget.ts`） |

## 2. 最近一次本地结果

> P9 更新：2026-09-20 · 反击姿态（+1 技能 / +1 纯函数模块，本体 JS 84.5 → 85.5 KB gzip）后复测。
> 沙盒噪声备注：同产物相邻四次测量 TBT 为 143 / 382 / 205 / 73 ms（共享 CPU 负载尖峰可复现地抬高 TBT，P8-E 基线同窗口 61 ms）；下表取最终验证通过值，CI 以同条件重跑为准。

| 配置 | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile（三次默认移动仿真中位数） | **99** | **100** | **100** | **100** | 1439 ms | 1665 ms | 73 ms | 0.000 |
| Desktop | **100** | **100** | **100** | **100** | 326 ms | 426 ms | 0 ms | 0.006 |

游戏本体 JS 最近实测 **85.5 / 350 KB gzip**。Lighthouse v12 已移除 PWA 类目；安装壳改由 44 项构建产物契约与跨浏览器离线测试守护。

## 3. P8-E 修复与自动化

1. `vite-plugin-pwa` 注册器从阻塞脚本改为 `script-defer`；Service Worker 更新与缓存语义不变。
2. `scripts/lighthouse-budget.ts` 把四类得分、LCP、TBT 与 CLS 变为可失败质量门，并同时覆盖移动/桌面配置。
3. `scripts/release-readiness.ts` 验证 manifest、SW 预缓存、图标实际尺寸、相对路径、安全头和发布物隐私边界。
4. CI 安装 Chromium / Firefox / WebKit：完整业务流仍只跑 Chromium，轻量发布矩阵跨四个桌面/触屏项目执行。

## 4. 诚实边界

- 本报告是 localhost 的确定性预算，不代表真实 CDN、移动基站、DNS 或第三方模型源性能。
- 线上 URL 必须在部署后复跑；结果、URL、设备与日期记录到 `docs/DEVICE-TEST-MATRIX.md`。
- WebKit 模拟不等于 iOS Safari 真机；主屏安装、断网冷启动、麦克风和系统粤语 TTS 仍待实机。
