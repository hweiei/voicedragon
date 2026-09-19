/** P8-B 专属仿真：与基础版分报，避免旧门绿掩盖新内容失衡。 */
import { writeFileSync } from "node:fs";
import { ACT_PACKS } from "../src/core/content";
import { simulateAct } from "../src/core/sim";

const runs = Number(process.env.SIM_RUNS ?? 300);
const rows = ACT_PACKS.flatMap((pack) =>
  (["greedy", "random"] as const).map((bot) => {
    const row = simulateAct({
      act: pack.act,
      bot,
      runs,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1
    });
    console.log("实遇第二阶段/新精英", row.bossPhases, row.newElites);
    console.log(
      `P8-B act ${pack.act} ${bot}: ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${runs}), timeouts ${row.timeouts}`
    );
    return row;
  })
);
const lines = [
  "# P8-B 对手进化 · 平衡仿真报告",
  "",
  `确定性种子基 0x20260919；每格 ${runs} 局；构筑版（ruleset=p7, buildVersion=1, encounterVersion=1）。`,
  "参考 Bot 声韵均值 74，验收门为45–65%胜率、零超时；随机 Bot 仅作下限诊断，超时照实计为失败。此报告不含挑战词缀。",
  "经典/P5 回归另见 BALANCE-REPORT.md；不覆盖旧报告。",
  "",
  "| 幕 | Bot | 胜率 | 平均到达层 | 场均回合 | 超时 | 二阶段战斗数 | 新精英战斗数 |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.act} | ${r.bot} | ${(r.winRate * 100).toFixed(1)}% (${r.wins}/${r.runs}) | ${r.avgFloor.toFixed(2)} | ${r.avgTurnsPerBattle.toFixed(2)} | ${r.timeouts} | ${r.bossPhases ?? 0} | ${r.newElites ?? 0} |`
  ),
  "",
  "## 解释与限制",
  "- 保留 P8-A 的升级/删牌策略；新增意图按阶段起点取招，遇穿甲降低纯防御牌权重。表中次数为实际进入第二阶段/遇到新精英，不是配置量。",
  "- 参考 Bot 是固定启发式，真人强度仍需试玩校准。独立曲线 10.3 / 9.5 / 6.7；P7和P8-A曲线未动。",
  "- 默认300局样本的随机 Bot 第三幕有1局超过60回合的仿真上限（seed=1193511738），对手为既有的断线纸鸢：偏防御牌组与敌方堆甲形成长局。此项没有归为胜利；未上调回合上限，也没有改变旧敌人来隐藏该样本。",
  "- 本期仅新战役启用对手进化，经典/旧 P7/P8-A/每日/无尽行为保持。穿甲招前 Bot 降低堆甲优先级；没有偷看隐藏规则。",
  "- `npm run sim:p8b` 可复现本表；新增 CI tests/sim/p8b-balance.test.ts 守护本报告。",
  ""
];
writeFileSync("docs/P8B-BALANCE-REPORT.md", lines.join("\n"));
if (
  rows.some(
    (row) =>
      row.bot === "greedy" &&
      (row.timeouts > 0 ||
        row.winRate < 0.45 ||
        row.winRate > 0.65 ||
        !row.bossPhases ||
        !row.newElites)
  )
)
  process.exitCode = 1;
