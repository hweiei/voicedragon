/**
 * 性能预算守卫（方案 §9）：首包游戏本体 JS（dist/assets/*.js，gzip）≤ 350 KB。
 * vendors/（sherpa WASM 运行时）与模型文件是运行时按需下载，不计入首包。
 *
 * 用法：vite build && vite-node scripts/perf-budget.ts（npm run ci 已串联）
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 350 * 1024;
const assetsDir = new URL("../dist/assets", import.meta.url).pathname;

let totalRaw = 0;
let totalGzip = 0;
const rows: Array<{ file: string; raw: number; gzip: number }> = [];

for (const name of readdirSync(assetsDir).sort()) {
  if (!name.endsWith(".js")) continue;
  const raw = readFileSync(join(assetsDir, name));
  const gzip = gzipSync(raw, { level: 9 }).length;
  totalRaw += raw.length;
  totalGzip += gzip;
  rows.push({ file: name, raw: raw.length, gzip });
}

const css = readdirSync(assetsDir).filter((name) => name.endsWith(".css"));
for (const name of css) {
  const raw = readFileSync(join(assetsDir, name));
  rows.push({ file: name, raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length });
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log("\n性能预算 · dist/assets");
for (const row of rows) {
  console.log(
    `  ${row.file.padEnd(34)} raw ${kb(row.raw).padStart(9)}  gzip ${kb(row.gzip).padStart(9)}`
  );
}
console.log(
  `  ${"游戏本体 JS 合计".padEnd(34)} raw ${kb(totalRaw).padStart(9)}  gzip ${kb(totalGzip).padStart(9)}`
);
console.log(
  `  预算：350.0 KB gzip → ${totalGzip <= BUDGET_BYTES ? "✅ 通过" : "❌ 超支"}（余量 ${kb(BUDGET_BYTES - totalGzip)}）\n`
);

if (statSync(assetsDir).isDirectory() === false || totalGzip === 0) {
  console.error("未发现构建产物，请先 vite build");
  process.exit(1);
}
if (totalGzip > BUDGET_BYTES) {
  process.exit(1);
}
