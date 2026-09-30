#!/usr/bin/env node
// 阶段2.6：文档四层纪律的机械校验——status 头、内链可达、docs 根纯净（模板与索引 README 豁免）。
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
const errs = [];
const mdFiles = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith(".md")) mdFiles.push(p);
  }
};
walk("docs");
const exempt = (p) => p.includes("/templates/") || p.endsWith("README.md");
for (const f of mdFiles.filter((x) => !exempt(x))) {
  const head = readFileSync(f, "utf8").split("\n", 4).join("\n");
  if (!/^> status: (active|done|draft|frozen|wontfix)/m.test(head))
    errs.push(`${f}: 缺 status 头（首行须 "> status: … · updated: YYYY-MM-DD"）`);
}
const linkRe = /\]\((?!https?:)([^)#\s]+)(#[^)]*)?\)/g;
const allMd = [
  ...mdFiles,
  "AGENTS.md",
  "README.md",
  "scripts/legacy/README.md",
  "minigame/README.md"
].filter(existsSync);
for (const f of allMd) {
  for (const m of readFileSync(f, "utf8").matchAll(linkRe)) {
    const target = m[1];
    if (target.startsWith("/") || target.includes("<")) continue;
    const abs = join(dirname(f), target);
    if (!existsSync(abs.split("#")[0])) errs.push(`${f}: 死链 → ${target}`);
  }
}
if (errs.length) {
  for (const e of errs) console.error(`[docs][FAIL] ${e}`);
  process.exit(1);
}
console.log(
  `[docs] ${mdFiles.length} 份 md：status 头齐、内链 ${allMd.length ? "全部" : ""}可达 ✓`
);
