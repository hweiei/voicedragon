/** P11 满堂彩专属仿真：与基础版分报；绝技频率与影响单列，不覆盖旧报告。 */
import { writeFileSync } from "node:fs";
import { ACT_PACKS } from "../src/core/content";
import { CHARACTERS } from "../src/core/content/roster";
import { simulateAct } from "../src/core/sim";

const runs = Number(process.env.SIM_RUNS ?? 300);
const rows = CHARACTERS.flatMap((character) =>
  ACT_PACKS.map((pack) => {
    const row = simulateAct({
      act: pack.act,
      bot: "greedy",
      runs,
      ruleset: "p7",
      buildVersion: 1,
      encounterVersion: 1,
      counterVersion: 1,
      rosterVersion: 1,
      ultimateVersion: 1,
      character: character.id,
      qteSource: character.id === "cau-saang"
    });
    console.log(
      `P11 ${character.name} act ${pack.act}: ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${runs}), timeouts ${row.timeouts}, ultimateCasts ${row.ultimateCasts ?? 0}`
    );
    return { character, row };
  })
);
const high = simulateAct({
  act: 1,
  bot: "greedy",
  runs,
  ruleset: "p7",
  buildVersion: 1,
  encounterVersion: 1,
  counterVersion: 1,
  rosterVersion: 1,
  ultimateVersion: 1,
  character: "man-mou-saang",
  profile: { voiceMean: 92, voiceSd: 8 }
});
console.log(
  `P11 高声韵诊断行 act 1: ${(high.winRate * 100).toFixed(1)}%, ultimateCasts ${high.ultimateCasts ?? 0}`
);
const low = simulateAct({
  act: 1,
  bot: "greedy",
  runs,
  ruleset: "p7",
  buildVersion: 1,
  encounterVersion: 1,
  counterVersion: 1,
  rosterVersion: 1,
  ultimateVersion: 1,
  character: "man-mou-saang",
  profile: { voiceMean: 60, voiceSd: 10 }
});
const lines = [
  "# P11 满堂彩 · 平衡仿真报告",
  "",
  `确定性种子基 0x20260919；每格 ${runs} 局；绝技版（ruleset=p7, build/encounter/counter/roster/ultimate=1）。`,
  "验收门：默认参考 Bot（裸分均值 74）三角色三幕 45–65%、零超时；高声韵行（均值 92）断言绝技真实触发。",
  "对照同种子 P10 基线（63.0/59.0/56.3 · 64.3/60.3/59.0 · 61.7/58.3/52.0）。不覆盖旧报告。",
  "",
  "| 角色 | 幕 | 胜率 | 平均到达层 | 场均回合 | 超时 | 绝技发动 |",
  "|---|---|---|---|---|---|---|",
  ...rows.map(
    ({ character, row }) =>
      `| ${character.name} | ${row.act} | ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${row.runs}) | ${row.avgFloor.toFixed(2)} | ${row.avgTurnsPerBattle.toFixed(2)} | ${row.timeouts} | ${row.ultimateCasts ?? 0} |`
  ),
  "",
  "| 诊断行 | 胜率 | 绝技发动 |",
  "|---|---|---|",
  `| 高声韵（裸分均值 92，文武生一幕） | ${(high.winRate * 100).toFixed(1)}% (${high.wins}/${high.runs}) | ${high.ultimateCasts ?? 0} |`,
  `| 低声韵（裸分均值 60，文武生一幕） | ${(low.winRate * 100).toFixed(1)}% (${low.wins}/${low.runs}) | ${low.ultimateCasts ?? 0} |`,
  "",
  "## 解释与限制",
  "- 彩基于**裸分**（不含声韵成长/骊珠/干扰）：默认参考 Bot 绝技罕见（表中接近 0），胜率回归 P10 角色基线——绝技对普通玩家是意外高光而非稳定强度来源。",
  "- 高声韵行绝技每场一次封顶后约 18 次/局，验证机制真实运转；其胜率不设门（等价于「发音极好玩家」的诊断界，不是平衡目标）。",
  '- 初版"最终分蓄彩 + 中段保彩"经仿真证伪（场均 4 绝技、花旦 81% 越带），已改为裸分蓄彩 + 每场一次，详见 ULTIMATE-PLAN §1 修订记录。',
  "- 绝技手感（长句难度的真人达成率、连唱压力）需真人试玩校准；Bot 无法替代。",
  "- `npm run sim:p11` 可复现本表；CI tests/sim/p11-balance.test.ts 守护本报告。",
  ""
];
writeFileSync("docs/P11-BALANCE-REPORT.md", lines.join("\n"));
const failing = rows.some(
  (row) => row.row.timeouts > 0 || row.row.winRate < 0.45 || row.row.winRate > 0.65
);
if (failing || (high.ultimateCasts ?? 0) <= 0) process.exitCode = 1;
