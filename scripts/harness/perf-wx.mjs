#!/usr/bin/env node
// 阶段3.7：小游戏启动 JS 体积 + 渲染回弹检查（告警档，基线见 baseline.json perfWx）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
if (!existsSync("minigame/dist")) { console.error("[perf-wx][FAIL] 先跑 npm run minigame 生成 dist"); process.exit(1); }
const js = readdirSync("minigame/dist").filter(f => f.endsWith(".js"));
let bytes = 0; for (const f of js) bytes += gzipSync(readFileSync(join("minigame/dist", f))).length;
const base = JSON.parse(readFileSync("docs/harness/baseline.json", "utf8")).perfWx || {};
const gz = bytes / 1024;
console.log(`[perf-wx] 启动 JS ${js.join(",")} 共 ${gz.toFixed(1)}KB gz（告警线 ${base.warnStartGzKB}）`);
if (base.warnStartGzKB && gz > base.warnStartGzKB) console.warn("[perf-wx][WARN] 超基线告警线（棘轮只降不升）");
// 渲染回弹：wx 端禁连续 rAF 循环（本项目事件驱动渲染），发现 requestAnimationFrame 常驻循环即告警
const hits = readFileSync("minigame/dist/" + js[0], "utf8").match(/requestAnimationFrame/g);
if (hits && hits.length > 2) console.warn(`[perf-wx][WARN] rAF 出现 ${hits.length} 次——确认非常驻循环`);
