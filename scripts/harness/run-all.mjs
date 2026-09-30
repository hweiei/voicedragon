#!/usr/bin/env node
// 阶段3：门禁总入口。参数：--full（含 bundle，需先 build）默认跳过重活
import { execSync } from "node:child_process";
const full = process.argv.includes("--full");
const skipWx = process.argv.includes("--skip-wx"); // CI check job 无 minigame build（由 minigame job 负责 size/perf-wx）
const steps = [
  "registry",
  "deps",
  "xss",
  "hygiene",
  "docs",
  "size",
  "perf-wx",
  ...(full ? ["bundle", "coverage"] : [])
];
const wx = skipWx ? ["size", "perf-wx"] : [];
let bad = 0;
for (const s of steps.filter((x) => !wx.includes(x))) {
  try {
    console.log(execSync(`node scripts/harness/${s}.mjs`, { encoding: "utf8" }).trim());
  } catch (e) {
    bad++;
    console.error(e.stdout || "");
    console.error(`[run-all] ✗ ${s} 失败`);
  }
}
process.exit(bad ? 1 : 0);
