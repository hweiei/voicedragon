/** P8-A 专属仿真：与基础版分报，避免旧门绿掩盖新内容失衡。 */
import { writeFileSync } from "node:fs";
import { ACT_PACKS } from "../src/core/content";
import { simulateAct } from "../src/core/sim";

const runs = Number(process.env.SIM_RUNS ?? 300);
const rows = ACT_PACKS.flatMap((pack) =>
  (["greedy", "random"] as const).map((bot) => {
    const row = simulateAct({ act: pack.act, bot, runs, ruleset: "p7", buildVersion: 1 });
    console.log("构筑操作", row.upgrades, row.removals);
    console.log(
      `P8-A act ${pack.act} ${bot}: ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${runs}), timeouts ${row.timeouts}`
    );
    return row;
  })
);
const lines = [
  "# P8-A 构筑成型 · 平衡仿真报告",
  "",
  `确定性种子基 0x20260919；每格 ${runs} 局；构筑版（ruleset=p7, buildVersion=1）。`,
  "参考 Bot 声韵均值 74，胜率门 45–65%；此报告不含挑战词缀。",
  "经典/P5 回归另见 BALANCE-REPORT.md；不覆盖旧报告。",
  "",
  "| 幕 | Bot | 胜率 | 平均到达层 | 场均回合 | 超时 | 升级次数 | 删牌次数 |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.act} | ${r.bot} | ${(r.winRate * 100).toFixed(1)}% (${r.wins}/${r.runs}) | ${r.avgFloor.toFixed(2)} | ${r.avgTurnsPerBattle.toFixed(2)} | ${r.timeouts} | ${r.upgrades ?? 0} | ${r.removals ?? 0} |`
  ),
  "",
  "## 解释与限制",
  "- 12 种单卡升级；参考 Bot 在高生命且声韵≥6的歇脚处升级；牌组≥9且有余钱时只精简未升级的重复牌；操作计数见表。",
  "- 参考 Bot 是固定启发式，按威胁/能量/状态使用新增战术道具；真人强度仍需试玩校准。",
  "- 本期仅新战役启用构筑，经典/旧 P7/每日/无尽行为保持。Bot 为固定启发式，不能替代真实玩家测试。",
  "- `npm run sim:p8` 可复现本表；新增 CI tests/sim/p8-balance.test.ts 守护本报告。",
  ""
];
writeFileSync("docs/P8-BALANCE-REPORT.md", lines.join("\n"));
if (
  rows.some(
    (row) =>
      row.timeouts > 0 || (row.bot === "greedy" && (row.winRate < 0.45 || row.winRate > 0.65))
  )
)
  process.exitCode = 1;
