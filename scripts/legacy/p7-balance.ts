/** P7 专属仿真：与基础版分报，避免旧门绿掩盖新内容失衡。 */
import { writeFileSync } from "node:fs";
import { ACT_PACKS } from "../src/core/content";
import { simulateAct } from "../src/core/sim";

const runs = Number(process.env.SIM_RUNS ?? 300);
const rows = ACT_PACKS.flatMap((pack) =>
  (["greedy", "random"] as const).map((bot) => {
    const row = simulateAct({ act: pack.act, bot, runs, ruleset: "p7" });
    console.log(
      `P7 act ${pack.act} ${bot}: ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${runs}), timeouts ${row.timeouts}`
    );
    return row;
  })
);
const lines = [
  "# P7 三幕深耕 · 平衡仿真报告",
  "",
  `确定性种子基 0x20260919；每格 ${runs} 局；扩展内容池（ruleset=p7）。`,
  "参考 Bot 声韵均值 74，胜率门 45–65%；此报告不含挑战词缀。",
  "经典/P5 回归另见 BALANCE-REPORT.md；不覆盖旧报告。",
  "",
  "| 幕 | Bot | 胜率 | 平均到达层 | 场均回合 | 超时 |",
  "|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.act} | ${r.bot} | ${(r.winRate * 100).toFixed(1)}% (${r.wins}/${r.runs}) | ${r.avgFloor.toFixed(2)} | ${r.avgTurnsPerBattle.toFixed(2)} | ${r.timeouts} |`
  ),
  "",
  "## 解释与限制",
  "- 新技能复用已有九种机制；数值与费用形成取舍，不宣称新增了十四种机制。",
  "- 参考 Bot 是固定启发式，按威胁/能量/状态使用新增战术道具；真人强度仍需试玩校准。",
  "- 词缀 36 种合法两两组合另由集成测试验证效果、确定性与有限战斗烟测，不宣称全部组合均在此胜率带。",
  "- `npm run sim:p7` 可复现本表；新增 CI tests/sim/p7-balance.test.ts 守护本报告。",
  ""
];
writeFileSync("docs/P7-BALANCE-REPORT.md", lines.join("\n"));
if (
  rows.some(
    (row) =>
      row.timeouts > 0 || (row.bot === "greedy" && (row.winRate < 0.45 || row.winRate > 0.65))
  )
)
  process.exitCode = 1;
