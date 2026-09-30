#!/usr/bin/env node
// 阶段3.2：覆盖率棘轮（告警档）。CI 里 vitest --coverage 后运行；本地 gate 不强制。
import { existsSync, readFileSync } from "node:fs";
if (!existsSync("coverage/coverage-summary.json")) {
  console.log("[coverage] 无报告（仅 CI/--coverage 时生成）——跳过");
  process.exit(0);
}
const t = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8")).total;
const base = JSON.parse(readFileSync("docs/harness/baseline.json", "utf8")).coverage || {};
const line = `lines ${t.lines.pct}% / branches ${t.branches.pct}%（棘轮目标 ${base.targetLines}/${base.targetBranches}%）`;
if (base.targetLines && (t.lines.pct < base.targetLines || t.branches.pct < base.targetBranches))
  console.warn(`[coverage][WARN] 低于棘轮目标——${line}`);
else console.log(`[coverage] ✓ ${line}`);
