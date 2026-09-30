# 真机测试清单（沙箱测不了的部分）

> status: active · updated: 2026-09-30 · 完整版见 `docs/design-docs/V1-RELEASE.md` §4，本表为执行勾选单。

| # | 项目 | 步骤 | 通过标准 |
|---|---|---|---|
| 1 | 录音评分 | iOS+Android 各一台，战斗中按住说话 | 出分数与 ✓/✗；拒绝授权后自动降级「跟读自评」不卡死 |
| 2 | 分包加载 | 清缓存冷启动直接进 ch3+ | 立绘/背景/音频 ≤3s 内齐；无「资源加载失败」toast |
| 3 | 音频播放 | 逐章点示范；来电打断后再点 | 可播、可恢复；`obeyMute` 表现符合 iOS 静音键预期 |
| 4 | 存档恢复 | 战斗中途杀进程重进 | run 与 profile 完整（street-run-v1 / street-profile-v1） |
| 5 | 分享 | 右上角菜单 | 只有普通转发/朋友圈，无任何奖励文案 |
| 6 | BGM/音效 | 设置页「音乐与音效」开关 | 即时生效；低版本基础库无 WebAudio 时静默无声无报错 |
| 7 | 首屏耗时 | 冷启动计时 | 首页可交互 < 2.5s（主包 2.4MB） |
| 8 | 广告 | 开发者工具「模拟广告」或真机加载 | 无 id 时全流程跳过；有 id 时失败不阻塞游戏 |

回归口径：跑 `docs/exec-plans/completed/HARNESS-PLAN.md` §6 行为清单同序进行。
失败处置：登记 `docs/harness/registry.json` 新 H 编号（标 bugfix），小 commit 修复，勿搭车。
