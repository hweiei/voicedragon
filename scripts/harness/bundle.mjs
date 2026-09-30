#!/usr/bin/env node
// 阶段3.3 预留位：web 线（冻结）bundle 预算检查——仅告警档，不设硬限。
// 计划原文的 320KB gz 预算针对活跃开发线；D1 裁决 web 冻结后降级为记录性告警。
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
if (!readdirSync(".", { withFileTypes: true }).some(d => d.name === "dist" && d.isDirectory())) { console.log("[bundle] 无 dist（先跑 npm run build）——跳过"); process.exit(0); }
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const js = walk("dist").filter(f => f.endsWith(".js")).map(f => [f, gzipSync(readFileSync(f)).length / 1024]).sort((a, b) => b[1] - a[1]);
const warn = JSON.parse(readFileSync("docs/harness/baseline.json", "utf8")).bundle?.warnChunkGzKB || 400;
console.log(`[bundle] 最大 chunk: ${js[0][0].replace("dist/", "")} ${js[0][1].toFixed(1)}KB gz (告警线 ${warn}，web 冻结线仅告警)`);
if (js[0][1] > warn) console.warn(`[bundle][WARN] 超告警线——冻结线不阻塞，活跃改动勿再加重量`);
