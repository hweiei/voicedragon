#!/usr/bin/env node
// 阶段3.4：依赖规则检查（docs/harness/deps-allowlist.json 驱动）+ import 图环检测。不新增依赖，自研。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
const rulesObj = JSON.parse(readFileSync("docs/harness/deps-allowlist.json", "utf8")).rules;
const rules = Object.entries(rulesObj).map(([from, allow]) => ({ from: from + "/", allow }));
const files = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { if (!p.includes("/legacy/") && !p.includes("node_modules")) walk(p); } else if (/\.(ts|tsx)$/.test(p) && !p.endsWith(".d.ts")) files.push(p); } };
["src", "minigame/src", "tests"].forEach(walk);
const graph = new Map(); const bad = [];
for (const f of files) {
  const from = relative(".", f).replace(/\\/g, "/");
  const rule = rules.find(r => from.startsWith(r.from));
  if (!rule) continue;
  const src = readFileSync(f, "utf8");
  const edges = [];
  for (const m of src.matchAll(/from\s+["']((?:\.\.?\/|@\/)[^"']+)["']/g)) {
    let spec = m[1]; if (spec.startsWith("@/")) spec = "src/" + spec.slice(2);
    const target = resolve(dirname(f), spec).replace(/\\/g, "/").replace(process.cwd() + "/", "");
    let t = target; if (!/\.(ts|tsx)$/.test(t)) t = target + (target.endsWith("/") ? "" : "");
    const cands = [t, t + ".ts", t + ".tsx", t + "/index.ts", target + ".ts"];
    const hit = cands.find(c => files.includes(c) || statSafe(c)) || t;
    edges.push(hit);
    if (!rule.allow.some(a => hit.startsWith(a))) bad.push(`${from}: 非法依赖 → ${hit}`);
  }
  graph.set(from, edges);
}
function statSafe(p) { try { return statSync(p).isFile(); } catch { return false; } }
// 环检测（DFS）
const color = new Map(); const cyc = [];
const dfs = (n, path) => { color.set(n, 1); for (const e of graph.get(n) || []) { if (color.get(e) === 1) cyc.push(path.slice(path.indexOf(e)).concat(e).join(" → ")); else if (!color.get(e)) dfs(e, path.concat(e)); } color.set(n, 2); };
for (const n of graph.keys()) if (!color.get(n)) dfs(n, [n]);
if (bad.length) { bad.forEach(b => console.error("[deps][FAIL] " + b)); process.exit(1); }
if (cyc.length) { console.warn("[deps][WARN] 环依赖（web 冻结线存量，勿新增）:"); [...new Set(cyc)].slice(0, 5).forEach(c => console.warn("  " + c)); }
console.log(`[deps] ${files.length} 文件、${graph.size} 节点，白名单规则 ${rules.length} 条：违规 0`);
