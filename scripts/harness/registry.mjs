#!/usr/bin/env node
// 阶段3.10：问题台账校验——schema、编号唯一、P0/P1 状态合法、验收阶段不得留 open P0
import { readFileSync } from "node:fs";
const reg = JSON.parse(readFileSync("docs/harness/registry.json", "utf8")).items;
const errs = [];
const ids = new Set();
for (const it of reg) {
  for (const k of ["id", "priority", "title", "status"])
    if (!it[k]) errs.push(`${it.id || "?"} 缺字段 ${k}`);
  if (ids.has(it.id)) errs.push(`重复编号 ${it.id}`);
  ids.add(it.id);
  if (!["open", "fixing", "done", "wontfix"].includes(it.status))
    errs.push(`${it.id} 非法状态 ${it.status}`);
  if (!["P0", "P1", "P2"].includes(it.priority)) errs.push(`${it.id} 非法优先级`);
  if (it.status === "wontfix" && !it.note) errs.push(`${it.id} wontfix 必须写理由(note)`);
  if (it.title.includes("[bugfix]") && !/H-\d+/.test(it.title + (it.note || "")) && !it.id)
    errs.push("bugfix 未编号");
}
const openP0 = reg.filter((i) => i.priority === "P0" && i.status === "open");
if (process.env.GATE_FINAL && openP0.length)
  errs.push(`验收期存在 open P0: ${openP0.map((i) => i.id).join(",")}`);
if (errs.length) {
  for (const e of errs) console.error(`[registry][FAIL] ${e}`);
  process.exit(1);
}
const c = (s) => reg.filter((r) => r.status === s).length;
console.log(
  `[registry] ${reg.length} 项：done ${c("done")} · fixing ${c("fixing")} · open ${c("open")} · wontfix ${c("wontfix")}`
);
