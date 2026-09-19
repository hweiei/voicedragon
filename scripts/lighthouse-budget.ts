/**
 * P8-E Lighthouse 可执行预算：启动真实 dist preview，移动端取三次中位数、桌面单次，并硬门关键指标。
 * 用法：vite build && vite-node scripts/lighthouse-budget.ts
 */

import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = join(root, ".cache");
const url = "http://127.0.0.1:4174/";
const viteEntry = require.resolve("vite");
const viteCli = join(dirname(viteEntry), "../../bin/vite.js");
const lighthouseCli = require.resolve("lighthouse/cli/index.js");
const temporaryReports: string[] = [];

interface LighthouseReport {
  categories: Record<string, { score: number | null }>;
  audits: Record<string, { numericValue?: number; displayValue?: string }>;
}

interface BudgetResult {
  profile: string;
  scores: Record<string, number>;
  lcp: number;
  tbt: number;
  cls: number;
  fcp: number;
}

function run(command: string, args: string[], env = process.env): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`命令退出码 ${code}\n${output.slice(-4000)}`));
    });
  });
}

async function waitForPreview(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`vite preview 提前退出：${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 服务仍在启动。
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("等待 vite preview 超时");
}

function stopPreview(child: ChildProcess): void {
  if (!child.pid || child.exitCode != null) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // finally 清理不得遮蔽原始审计结果。
  }
}

async function audit(profile: "mobile" | "desktop", runIndex = 1): Promise<BudgetResult> {
  const reportPath = join(cacheDir, `lighthouse-${profile}-${runIndex}.json`);
  temporaryReports.push(reportPath);
  rmSync(reportPath, { force: true });
  const args = [
    lighthouseCli,
    url,
    "--quiet",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    `--output-path=${reportPath}`,
    "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage"
  ];
  if (profile === "desktop") args.push("--preset=desktop");
  await run(process.execPath, args, { ...process.env, CHROME_PATH: chromium.executablePath() });
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as LighthouseReport;
  const score = (name: string) => Math.round((report.categories[name]?.score ?? 0) * 100);
  const value = (name: string) => report.audits[name]?.numericValue ?? Number.POSITIVE_INFINITY;
  return {
    profile,
    scores: {
      performance: score("performance"),
      accessibility: score("accessibility"),
      "best-practices": score("best-practices"),
      seo: score("seo")
    },
    lcp: value("largest-contentful-paint"),
    tbt: value("total-blocking-time"),
    cls: value("cumulative-layout-shift"),
    fcp: value("first-contentful-paint")
  };
}

function assertBudget(result: BudgetResult): string[] {
  const failures: string[] = [];
  for (const [name, score] of Object.entries(result.scores)) {
    if (score < 95) failures.push(`${result.profile} ${name} ${score} < 95`);
  }
  if (result.lcp > 2500) failures.push(`${result.profile} LCP ${result.lcp.toFixed(0)}ms > 2500ms`);
  if (result.tbt > 200) failures.push(`${result.profile} TBT ${result.tbt.toFixed(0)}ms > 200ms`);
  if (result.cls > 0.1) failures.push(`${result.profile} CLS ${result.cls.toFixed(3)} > 0.100`);
  return failures;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function medianResult(profile: string, runs: BudgetResult[]): BudgetResult {
  const scoreNames = Object.keys(runs[0].scores);
  return {
    profile,
    scores: Object.fromEntries(
      scoreNames.map((name) => [name, median(runs.map((result) => result.scores[name] ?? 0))])
    ),
    lcp: median(runs.map((result) => result.lcp)),
    tbt: median(runs.map((result) => result.tbt)),
    cls: median(runs.map((result) => result.cls)),
    fcp: median(runs.map((result) => result.fcp))
  };
}

mkdirSync(cacheDir, { recursive: true });
const preview = spawn(
  process.execPath,
  [viteCli, "preview", "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
  { cwd: root, stdio: "ignore" }
);

try {
  await waitForPreview(preview);
  // Lighthouse 移动 CPU 节流在共享 CI 主机上波动明显；按官方常见做法取三次中位数，
  // 不取最好值，也不因单次邻居噪声误杀发布。
  const mobileRuns: BudgetResult[] = [];
  for (let index = 1; index <= 3; index += 1) mobileRuns.push(await audit("mobile", index));
  const results = [medianResult("mobile(3-run median)", mobileRuns), await audit("desktop")];
  const failures = results.flatMap(assertBudget);
  console.log("\nP8-E Lighthouse 预算");
  for (const result of results) {
    console.log(
      `  ${result.profile.padEnd(7)} Perf ${result.scores.performance} · A11y ${result.scores.accessibility} · Best ${result.scores["best-practices"]} · SEO ${result.scores.seo}`
    );
    console.log(
      `           FCP ${result.fcp.toFixed(0)}ms · LCP ${result.lcp.toFixed(0)}ms · TBT ${result.tbt.toFixed(0)}ms · CLS ${result.cls.toFixed(3)}`
    );
  }
  if (failures.length) {
    console.error(`\nLighthouse 预算失败：\n- ${failures.join("\n- ")}\n`);
    process.exitCode = 1;
  } else {
    console.log("  ✅ 移动端与桌面预算全部通过\n");
  }
} finally {
  stopPreview(preview);
  for (const report of temporaryReports) rmSync(report, { force: true });
}
