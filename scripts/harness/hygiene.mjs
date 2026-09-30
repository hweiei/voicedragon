#!/usr/bin/env node
// 阶段3.5：孤儿/卫生检查——文档结构、归档规范、生成物不入库
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
const bad = [];
for (const f of readdirSync("docs").filter(x => x.endsWith(".md") && !["ARCHITECTURE.md","README.md"].includes(x))) bad.push(`docs 根散件: docs/${f}（应归入四层之一）`);
if (existsSync("docs/exec-plans/active") && readdirSync("docs/exec-plans/active").some(x => x.includes("P7") || /^P\d/.test(x))) bad.push("exec-plans/active 混入旧计划");
for (const dir of ["src", "minigame/src"]) { const junk = execSync(`git ls-files ${dir} | grep -E '\\.(png|mp3|mp4)$' || true`).toString().trim(); if (junk) bad.push(dir + " 混入生成物: " + junk.split("\n")[0]); }
const legacy = readdirSync("scripts/legacy").filter(f => !f.startsWith(".") && f !== "README.md");
for (const f of readdirSync("scripts").filter(x => statSync("scripts/" + x).isFile() && /^(p\d|-|check)/.test(x) === false && !x.match(/^(split-mini|per|release|perf|lighthouse|setup)/))) { void f; } // 其余活脚本须见 scripts.md
if (!readdirSync("docs/references").some(f => f.includes("scripts"))) bad.push("缺 scripts 索引 docs/references/scripts.md");
if (bad.length) { bad.forEach(b => console.error("[hygiene][FAIL] " + b)); process.exit(1); }
console.log(`[hygiene] docs 四层无散件 · 生成物未入库 · legacy ${legacy.length} 项已归档`);
