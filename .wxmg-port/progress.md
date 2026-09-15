# 移植进度

## 2026-09-13
- 方案D+个人主体已确认
- 阶段0工程已建：minigame/{game.js,game.json,project.config.json}，探针代码就绪
- 下一步：连开发者工具跑探针，P2结果决定语音路线
# 移植进度

## 2026-09-13（阶段0探针排障中）
- 已修复：C 盘满（清 npm _cacache 释放 1.29GB）
- 已修复：基础库 3.17.2/3.17.3 wxvpkg 下载成功（vendor-timeline success）
- 当前卡点：模拟器命令全部超时（connect OK，systemInfo/screenshot/evaluate 全超时）；日志见 BACKEND_READY port=0、routeTo appLaunch timeout、_fetchDevelopLibInfo 系统错误
- game.js 当前为基线版（插件调用已禁用）用于对照
- 下一步：用户目视 IDE 模拟器状态 → 决定是否 UI 层缺省（如需在 IDE 里手动确认信任项目/基础库版本）

- S0 probe results: P1 PASS (canvas on-screen render), P3 PASS (storage roundtrip)
- P2 FAIL: module plugs/WechatSI.js is not defined - touristappid cannot use plugins (expected limitation)
- Action needed: register personal minigame account, add WechatSI plugin in MP console, update project.config.json appid, retest
- Verdict: platform base verified; dev can proceed; voice route stays conditional (primary WechatSI / fallback RecorderManager+server ASR / floor text input)

- S1 done: engine/data/config/storage/platform/adapters/scoring copied into minigame/js/, game.js is wx entry (390x844 DPR fit, 8-screen render, hit-region dispatch, onHide autosave, loadGame restore)
- S2 code ready for visual check: battle skill use uses placeholder score (55-94 random) until S3 wires real recognition
