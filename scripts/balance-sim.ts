/**
 * 平衡仿真报表 CLI：三幕 × 两 Bot 蒙特卡洛 → 控制台表格 + docs/BALANCE-REPORT.md。
 *
 * 用法：
 *   npm run sim                 # 默认每格 300 局（确定性种子，结果可复现）
 *   SIM_RUNS=1000 npm run sim   # 自定义局数
 *
 * CI 阈值守卫见 tests/sim/balance.test.ts（贪心参考 Bot 三幕胜率须落 45–65%）。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ACT_PACKS } from "../src/core/content";
import { BOTS, simulateAct } from "../src/core/sim";
import type { SimSummary } from "../src/core/sim";

const RUNS = Number(process.env.SIM_RUNS ?? 300);
const BASE_SEED = 0x2026_0919;

const rows: SimSummary[] = [];
for (const pack of ACT_PACKS) {
  for (const bot of Object.keys(BOTS) as Array<keyof typeof BOTS>) {
    rows.push(simulateAct({ act: pack.act, bot, runs: RUNS, baseSeed: BASE_SEED }));
  }
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const fixed = (value: number) => value.toFixed(1);

console.log(`\n《声震龙楼》平衡仿真 · 每格 ${RUNS} 局 · 种子基 ${BASE_SEED}（确定性）\n`);
const header = "幕  主题          Bot           胜率    均到达层  场均回合  战斗场  超时";
console.log(header);
console.log("-".repeat(header.length));
for (const row of rows) {
  const theme = ACT_PACKS[row.act - 1].theme;
  console.log(
    `${row.act}  ${theme.padEnd(12)}  ${row.label.padEnd(12)}  ${percent(row.winRate).padEnd(6)}  ${fixed(row.avgFloor).padEnd(7)}  ${fixed(row.avgTurnsPerBattle).padEnd(7)}  ${fixed(row.avgBattles).padEnd(5)}  ${row.timeouts}`
  );
}

const now = new Date();
const lines: string[] = [
  "# 平衡仿真报告（自动生成，勿手改）",
  "",
  `> 生成时间：${now.toISOString()} · 每格 ${RUNS} 局 · 种子基 ${BASE_SEED}（全确定性，可复现）`,
  "> 阈值：贪心参考 Bot（声韵均值 74）各幕胜率须落在 **45%–65%**（CI 守卫：tests/sim/balance.test.ts）",
  "",
  "| 幕 | 主题 | Bot | 胜率 | 均到达层 | 场均回合 | 战斗场 | 超时 |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |"
];
for (const row of rows) {
  const theme = ACT_PACKS[row.act - 1].theme;
  lines.push(
    `| ${row.act} | ${theme} | ${row.label} | ${percent(row.winRate)} (${row.wins}/${row.runs}) | ${fixed(row.avgFloor)} | ${fixed(row.avgTurnsPerBattle)} | ${fixed(row.avgBattles)} | ${row.timeouts} |`
  );
}
lines.push(
  "",
  "## 调参入口",
  "",
  "- 敌方数值：`src/core/content/act1.ts` / `act2.ts` / `act3.ts`（hp / attack / 意图模式）",
  "- 难度曲线与地图形状：`src/core/config/balance.ts`（DIFFICULTY_CURVE / ACT_MAP）",
  "- Bot 档位：`src/core/sim.ts`（BOTS：声韵均值/波幅、问答正确率）",
  "",
  "## 结论口径",
  "",
  "- 贪心 Bot = 会玩的普通玩家（语音均值 74 分，清晰档为主）；随机 Bot = 下限玩家（62 分）。",
  "- 超时 = 单场 60 回合未分胜负的保护性判负，正常应为 0。",
  ""
);

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../docs/BALANCE-REPORT.md");
writeFileSync(target, lines.join("\n"), "utf8");
mkdirSync(dirname(target), { recursive: true });
console.log(`\n已写入 ${target}\n`);
