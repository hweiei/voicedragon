#!/usr/bin/env node
// 阶段3：门禁总入口。参数：--full（含 bundle，需先 build）默认跳过重活
import { execSync } from "node:child_process";
const full = process.argv.includes("--full");
const steps = ["registry", "deps", "xss", "hygiene", "size", "perf-wx", ...(full ? ["bundle", "coverage"] : [])];
let bad = 0;
for (const s of steps) {
  try { console.log(execSync(`node scripts/harness/${s}.mjs`, { encoding: "utf8" }).trim()); }
  catch (e) { bad++; console.error(e.stdout || ""); console.error(`[run-all] ✗ ${s} 失败`); }
}
process.exit(bad ? 1 : 0);
