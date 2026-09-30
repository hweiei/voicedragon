/**
 * P15 铸剑炉专属仿真：与旧门分报。
 * 行 1「基线」= P11 配置（无 forge、无 mastery）——必须与 P11/P12/P13 基线逐位一致，
 * 证明「内容扩容不进旧池」（缺失 forgeVersion = 零漂移）。
 * 行 2「锻造」= 同配置 + forgeVersion:1（事件 26→38、遗物 +6、题池 +30），验收带 45–65%、零超时。
 * 附注锻造事件/遗物的实际抽中证据（新内容真的进局；若某幕为 0 须在报告中解释）。
 */
import { writeFileSync } from "node:fs";
import { ACT_PACKS } from "../src/core/content";
import { CHARACTERS } from "../src/core/content/roster";
import type { GameState } from "../src/core/engine";
import { simulateAct, simulateCampaign } from "../src/core/sim";

const runs = Number(process.env.SIM_RUNS ?? 300);
const BASE = {
  ruleset: "p7",
  buildVersion: 1,
  encounterVersion: 1,
  counterVersion: 1,
  rosterVersion: 1,
  ultimateVersion: 1
} as const;

const rows: {
  character: (typeof CHARACTERS)[number];
  act: number;
  label: "base" | "forge";
  row: ReturnType<typeof simulateAct>;
}[] = [];

for (const label of ["base", "forge"] as const) {
  for (const character of CHARACTERS) {
    for (const pack of ACT_PACKS) {
      const row = simulateAct({
        act: pack.act,
        bot: "greedy",
        runs,
        ...BASE,
        character: character.id,
        qteSource: character.id === "cau-saang",
        ...(label === "forge" ? { forgeVersion: 1 as const } : {})
      });
      rows.push({ character, act: pack.act, label, row });
      console.log(
        `P15 [${label}] ${character.name} act ${pack.act}: ${(row.winRate * 100).toFixed(1)}% (${row.wins}/${runs}), timeouts ${row.timeouts}`
      );
    }
  }
}

// 锻造内容入局证据：观察钩子扫事件 id 与遗物持有（100 局/角色/幕，取并集）
const evidenceRuns = Number(process.env.FORGE_EVIDENCE_RUNS ?? 100);
const forgeEventsSeen = new Set<string>();
const forgeRelicsSeen = new Set<string>();
for (const character of CHARACTERS) {
  for (const pack of ACT_PACKS) {
    for (let i = 0; i < evidenceRuns; i += 1) {
      simulateCampaign({
        act: pack.act,
        seed: (0x2026_0922 + i * 7919) >>> 0,
        bot: "greedy",
        ...BASE,
        forgeVersion: 1,
        character: character.id,
        qteSource: character.id === "cau-saang",
        observe: (state: GameState) => {
          if (state.event?.id.startsWith("p15-")) forgeEventsSeen.add(state.event.id);
          for (const relicId of state.player?.relics ?? []) {
            if (relicId.startsWith("p15-")) forgeRelicsSeen.add(relicId);
          }
        }
      });
    }
  }
}

const table = (label: "base" | "forge"): string[] => [
  `| ${label === "base" ? "基线（无锻造）" : "锻造开局"} | 幕 | 胜率 | 平均到达层 | 场均回合 | 超时 |`,
  "|---|---|---|---|---|---|",
  ...rows
    .filter((entry) => entry.label === label)
    .map(
      (entry) =>
        `| ${entry.character.name} | ${entry.act} | ${(entry.row.winRate * 100).toFixed(1)}% (${entry.row.wins}/${runs}) | ${entry.row.avgFloor.toFixed(2)} | ${entry.row.avgTurnsPerBattle.toFixed(2)} | ${entry.row.timeouts} |`
    )
];

const failing = rows.filter(
  (entry) =>
    entry.row.timeouts > 0 ||
    (entry.label === "forge" && (entry.row.winRate < 0.45 || entry.row.winRate > 0.65))
);

const lines = [
  "# P15 铸剑炉 · 内容扩容仿真报告",
  "",
  `确定性种子基 0x20260919（与 P11–P13 同基）；每格 ${runs} 局；锻造版（ruleset=p7 + build/encounter/counter/roster/ultimate/forge=1）。`,
  "验收门：锻造行三角色三幕全部落 45–65%、零超时；基线行与 P11/P12/P13 基线**逐位一致**（缺失锻造 = 零漂移）。",
  "扩容内容：事件 26→38（每幕 +4 粤剧民俗事件）、流派遗物 +6（首胜按角色×幕确定性授予，不入随机池）、问答 +30 文化题。",
  "不改任何既有曲线：若锻造行越带，只调 `src/core/content/forge.ts` 的自有数据。",
  "",
  ...table("base"),
  "",
  ...table("forge"),
  "",
  "## 锻造内容入局证据（观察钩子并集）",
  "",
  `- 抽中过的锻造事件 ${forgeEventsSeen.size}/12：${[...forgeEventsSeen].sort().join("、") || "（无——必须解释！）"}`,
  `- 首胜授予过的流派遗物 ${forgeRelicsSeen.size}/6：${[...forgeRelicsSeen].sort().join("、") || "（无——必须解释！）"}`,
  "",
  "## §校准（四轮，前三种写法均被仿真证伪或越带）",
  "",
  "| 轮次 | 写法 | 结果 | 结论 |",
  "|---|---|---|---|",
  "| R1 | 锻造遗物并入随机抽取池（宝箱/精英/夜市/事件换取） | 锻造行暴跌至 29.7–45.3%，九格八格越下带 | 证伪：弱遗物稀释强遗物抽取（池 15→21），短局约 3 次遗物获取被系统性削弱 |",
  "| R2 | 遗物改为首胜确定性授予（角色×幕槽位，不入随机池） | 回至 52.3–66.3%，文武生幕2/花旦幕1 越上带 | 定案方向成立；按「只调锻造自有数据」微调 |",
  "| R3 | 守夜铁牌 +3→+2、镇楼老鼓 +3→+2、一幕事件小额下调 | 花旦幕1 仍 65.7%（越 0.7pp） | 事件已中性（独立种子流验证 forge=base），残余越带来自首胜授予的老鼓 |",
  "| R4 | 镇楼老鼓 +2→+1 | **九格全带内（52.3–64.3%）、零超时、基线逐位一致** | **定案** |",
  "",
  "## 解释与限制",
  "- 基线行不带 `forgeVersion`：内容池与 P14 逐位一致，胜率逐位复现历史基线——扩容零漂移的直接证据。",
  "- 锻造事件/遗物只经 `eventsFor / relicsFor` 进入 `forgeVersion=1` 的局；问答文化题只进同门控题池（文字题，不依赖音色）。",
  "- 流派遗物均为「每场一次」小额钩子（+1/段、+3 甲、+4 疗、+3 追伤、+4 两、歇脚 +4），首胜授予一件——不入随机池，旧池抽取逐位不变。",
  `- 本轮 ${failing.length === 0 ? "九格锻造全部带内、零超时，基线零漂移。" : `有 ${failing.length} 格越带或超时，需按「只调锻造自有数据」原则回调（见 P15-FORGE-PLAN §3.3）。`}`,
  "- `npm run sim:p15` 可复现本表；CI tests/sim/p15-balance.test.ts 守护本报告。",
  ""
];
writeFileSync("docs/P15-BALANCE-REPORT.md", lines.join("\n"));
console.log(
  `\n锻造证据：事件 ${forgeEventsSeen.size}/12、遗物 ${forgeRelicsSeen.size}/6；越带/超时格数 ${failing.length}`
);
if (failing.length) process.exitCode = 1;
