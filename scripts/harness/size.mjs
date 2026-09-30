#!/usr/bin/env node
// H-16/阶段3.3：小游戏包体门禁。主包 ≤ 4096KB 硬限（微信规则，以官方文档为准）；
// 告警线取基线（docs/harness/baseline.json size.warnMainKB）只降不升。分包各 ≤ 4096KB。
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2] || "minigame/dist";
const base = JSON.parse(readFileSync("docs/harness/baseline.json", "utf8")).size || {};
const dirB = (p) => { let t = 0; for (const e of readdirSync(p, { withFileTypes: true })) { const f = join(p, e.name); t += e.isDirectory() ? dirB(f) : statSync(f).size; } return t; };
const kb = (n) => n / 1024;
const { subPackages = [] } = JSON.parse(readFileSync(join(root, "game.json"), "utf8"));
const subRoots = new Set(subPackages.map(s => s.root.replace(/\/$/, "")));
let main = 0; const subs = {};
for (const e of readdirSync(root, { withFileTypes: true })) {
  const p = join(root, e.name); const sz = e.isDirectory() ? kb(dirB(p)) : kb(statSync(p).size);
  if (subRoots.has(e.name)) subs[e.name] = sz; else main += sz;
}
const fail = main > 4096 ? [`主包 ${main.toFixed(0)}KB 超 4096KB 硬限`] : [];
for (const [k, v] of Object.entries(subs)) if (v > 4096) fail.push(`分包 ${k} ${v.toFixed(0)}KB 超 4096KB`);
const warn = base.warnMainKB && main > base.warnMainKB ? [`主包 ${main.toFixed(0)}KB > 基线告警线 ${base.warnMainKB}KB（棘轮：只降不升）`] : [];
console.log(`[size] 主包 ${main.toFixed(0)}KB · 分包 ${Object.entries(subs).map(([k, v]) => k + ":" + v.toFixed(0)).join(" ")}KB`);
for (const w of warn) console.warn("[size][WARN] " + w);
if (fail.length) { for (const f of fail) console.error("[size][FAIL] " + f); process.exit(1); }
