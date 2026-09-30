#!/usr/bin/env node
// 阶段3.5：孤儿/卫生检查——文档结构、归档规范、生成物不入库
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
const bad = [];
for (const f of readdirSync("docs").filter(
  (x) => x.endsWith(".md") && !["ARCHITECTURE.md", "README.md"].includes(x)
))
  bad.push(`docs 根散件: docs/${f}（应归入四层之一）`);
if (
  existsSync("docs/exec-plans/active") &&
  readdirSync("docs/exec-plans/active").some((x) => x.includes("P7") || /^P\d/.test(x))
)
  bad.push("exec-plans/active 混入旧计划");
for (const dir of ["src", "minigame/src"]) {
  const junk = execSync(`git ls-files ${dir} | grep -E '\\.(png|mp3|mp4)$' || true`)
    .toString()
    .trim();
  if (junk) bad.push(`${dir} 混入生成物: ${junk.split("\n")[0]}`);
}
const legacy = readdirSync("scripts/legacy").filter((f) => !f.startsWith(".") && f !== "README.md");
for (const f of readdirSync("scripts").filter(
  (x) =>
    statSync(`scripts/${x}`).isFile() &&
    /^(p\d|-|check)/.test(x) === false &&
    !x.match(/^(split-mini|per|release|perf|lighthouse|setup)/)
)) {
  void f;
} // 其余活脚本须见 scripts.md
// 复杂度守卫：单文件 >800 行即 FAIL；冻结大文件走白名单（只收不放，拆分后须移除——H-01/H-02）
const BIG = {
  // 存量棘轮白名单（只收不放；H-01/H-02/H-03 拆分完成后必须移除对应行）
  "src/ui/ui.ts": 3452,
  "minigame/src/game.ts": 1914,
  "src/ui/roster.ts": 900,
  "src/core/engine.ts": 2218,
  "src/street/app.ts": 863
};
const isData = (f) => /src\/core\/content\/(p\d+\/)?act\d+\.ts$|data\.ts$/.test(f); // 纯数据表按行计无语义
let lines;
for (const dir of ["src", "minigame/src"]) {
  const out = execSync(
    `find ${dir} -name '*.ts' -not -name '*.d.ts' | xargs wc -l | sort -rn | head -30`
  ).toString();
  for (const row of out.split("\n")) {
    const m = row.match(/^\s*(\d+)\s+(\S+\.ts)$/);
    if (!m || m[2] === "total") continue;
    if (isData(m[2])) continue;
    const n = +m[1];
    const lim = BIG[m[2]];
    if (n > 800 && (!lim || n > lim))
      bad.push(
        `${m[2]} ${n} 行超限（棘轮线 ${lim ?? 800}；新大文件禁止，超限者须拆分后下调白名单）`
      );
    if (lim && n <= 800) bad.push(`${m[2]} 已降至 ${n} 行——从 BIG 白名单移除（放闸）`);
  }
}
if (!readdirSync("docs/references").some((f) => f.includes("scripts")))
  bad.push("缺 scripts 索引 docs/references/scripts.md");
if (bad.length) {
  for (const b of bad) console.error(`[hygiene][FAIL] ${b}`);
  process.exit(1);
}
console.log(`[hygiene] docs 四层无散件 · 生成物未入库 · legacy ${legacy.length} 项已归档`);
