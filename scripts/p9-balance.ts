/** P9 守势反击专属仿真：与基础版分报，避免旧门绿掩盖新内容失衡。 */
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
      encounterVersion: 1,
      counterVersion: 1
    });
    console.log(
      `P9 act ${pack.act} ${bot}: ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${runs}), timeouts ${row.timeouts}, counterHits ${row.counterHits ?? 0}`
    );
    return row;
  })
);
const lines = [
  "# P9 守势反击 · 平衡仿真报告",
  "",
  `确定性种子基 0x20260919；每格 ${runs} 局；反击版（ruleset=p7, buildVersion=1, encounterVersion=1, counterVersion=1）。`,
  "参考 Bot 声韵均值 74，验收门为45–65%胜率、零超时、每幕 counterHits > 0；随机 Bot 仅作下限诊断，超时照实计为失败。此报告不含挑战词缀。",
  "对照同种子 P8-B 基线（56.7% / 56.3% / 55.3%）：反击对一、二幕普通攻击型对手为正收益，第三幕穿甲对手为负收益——反制关系成立。不覆盖旧报告。",
  "",
  "| 幕 | Bot | 胜率 | 平均到达层 | 场均回合 | 超时 | 反击触发 | 升级 | 删牌 |",
  "|---|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.act} | ${r.bot} | ${(r.winRate * 100).toFixed(1)}% (${r.wins}/${r.runs}) | ${r.avgFloor.toFixed(2)} | ${r.avgTurnsPerBattle.toFixed(2)} | ${r.timeouts} | ${r.counterHits ?? 0} | ${r.upgrades ?? 0} | ${r.removals ?? 0} |`
  ),
  "",
  "## 解释与限制",
  "- 保留 P8-A 升级/删牌与 P8-B 意图策略；Bot 对反击卡按「护甲 + 预期还击」估值，威胁 ≥10 且非穿甲才主动摆姿态，不偷看隐藏规则。",
  "- counterHits 为实际打出伤害 ≥1 的还击次数（姿态存在且敌方行动后消失）；穿甲行动与无伤害回合不触发、不消耗姿态。",
  "- 参考 Bot 是固定启发式，真人强度仍需试玩校准；反击手感（何时值得花一拍摆姿态）无法由 Bot 胜率替代。",
  "- `npm run sim:p9` 可复现本表；新增 CI tests/sim/p9-balance.test.ts 守护本报告。",
  ""
];
writeFileSync("docs/P9-BALANCE-REPORT.md", lines.join("\n"));
if (
  rows.some(
    (row) =>
      row.bot === "greedy" &&
      (row.timeouts > 0 ||
        row.winRate < 0.45 ||
        row.winRate > 0.65 ||
        !row.counterHits ||
        row.counterHits <= 0)
  )
)
  process.exitCode = 1;
