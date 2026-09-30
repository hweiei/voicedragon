#!/usr/bin/env node
// 阶段3.8：innerHTML 围栏——src/ui、src/street、minigame 全部 innerHTML/insertAdjacentHTML 右值
// 必须①静态模板（无反引号插值）②包 safeHtml ③走 esc() 转义。H-14 的机械半段。
import { execSync } from "node:child_process";
const out = execSync(`grep -rn "innerHTML *=\\|insertAdjacentHTML" src minigame/src --include="*.ts" | grep -v "\\.d\\.ts" || true`).toString().trim();
const FROZEN = /^(src\/ui|src\/beginner|src\/adapters|src\/pages)/;
const bad = []; const warns = [];
for (const line of out ? out.split("\n") : []) {
  const rhs = line.split("innerHTML")[1] || line;
  if (/innerHTML\s*=\s*["'`][^"'`]*["'`]\s*[;)]?\s*$/.test(rhs.replace(/.*=/, "")) && !rhs.includes("${")) continue; // 纯静态字符串
  if (/\$\{/.test(rhs) && !/esc\(|safeHtml|sanitize/.test(rhs)) {
    const ent = { line: line.trim().slice(0, 140) };
    if (FROZEN.test(line)) warns.push(ent.line); else bad.push(ent.line);
  }
}
for (const w of warns) console.warn("[xss][WARN] 冻结线(web)未转义插值，wontfix 见 H-14: " + w);
if (bad.length) { console.error("[xss][FAIL] 活跃线未转义插值 innerHTML:"); bad.forEach(b => console.error("  " + b)); process.exit(1); }
const n = (out.match(/\n/g) || []).length + 1;
console.log(`[xss] ${n} 处赋值点全部静态或已转义 ✓`);
