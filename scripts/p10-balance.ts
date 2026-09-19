/** P10 名伶登场专属仿真：与基础版分报，避免旧门绿掩盖角色失衡。 */
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
      character: character.id,
      // 丑生以破阵拍通道施法（= 全程无声玩法的乐观界）；其余角色走语音通道
      qteSource: character.id === "cau-saang"
    });
    console.log(
      `P10 ${character.name} act ${pack.act}: ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${runs}), timeouts ${row.timeouts}, passiveHits ${row.passiveHits ?? 0}, counterHits ${row.counterHits ?? 0}`
    );
    return { character, row };
  })
);
const floors = CHARACTERS.map((character) => {
  const row = simulateAct({
    act: 1,
    bot: "random",
    runs,
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    character: character.id,
    qteSource: character.id === "cau-saang"
  });
  console.log(`P10 ${character.name} act 1 random: ${(row.winRate * 100).toFixed(1)}%`);
  return { character, row };
});
const lines = [
  "# P10 名伶登场 · 平衡仿真报告",
  "",
  `确定性种子基 0x20260919；每格 ${runs} 局；名伶版（ruleset=p7, build=1, encounter=1, counter=1, roster=1）。`,
  "参考 Bot 声韵均值 74，验收门为每角色三幕 45–65% 胜率、零超时；随机 Bot 仅作下限诊断。",
  "对照同种子 P9 基线（59.3% / 63.3% / 53.0%）。不覆盖旧报告。",
  "",
  "| 角色 | 幕 | 胜率 | 平均到达层 | 场均回合 | 超时 | 被动触发 | 反击触发 |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map(
    ({ character, row }) =>
      `| ${character.name} | ${row.act} | ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${row.runs}) | ${row.avgFloor.toFixed(2)} | ${row.avgTurnsPerBattle.toFixed(2)} | ${row.timeouts} | ${row.passiveHits ?? 0} | ${row.counterHits ?? 0} |`
  ),
  "",
  "| 角色 | 随机 Bot 一幕下限 |",
  "|---|---|",
  ...floors.map(
    ({ character, row }) =>
      `| ${character.name} | ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${row.runs}) |`
  ),
  "",
  "## 解释与限制",
  "- passiveHits 为亮相/打诨一次性标记的实际触发数；花旦「绕梁」为逐次判定（无标记），仿真无调准通道不触发，其胜率为**牌组下限**。",
  "- 丑生以 qteSource 模拟（施法通道记为破阵拍），等于「全程无声玩法 + 被动全开」的乐观界；真人介于语音与无声之间。",
  "- 角色起始牌组经过三轮校准（文武生亮相由常驻声势改为当次伤害爆发；打诨阈值 85→92；三套牌组侧向置换），只调角色自有参数，未动 P8-B/P9 曲线。",
  "- 参考 Bot 是固定启发式；角色手感差异（亮相开局爆发、绕梁连续感、打诨节奏）需真人试玩校准。",
  "- `npm run sim:p10` 可复现本表；CI tests/sim/p10-balance.test.ts 守护本报告。",
  ""
];
writeFileSync("docs/P10-BALANCE-REPORT.md", lines.join("\n"));
const failing = rows.some(
  ({ row }) => row.timeouts > 0 || row.winRate < 0.45 || row.winRate > 0.65
);
if (failing) process.exitCode = 1;
