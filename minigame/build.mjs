/**
 * 构建小游戏包与浏览器预览：
 *   node minigame/build.mjs          → minigame/dist（用微信开发者工具打开）
 *   node minigame/build.mjs --web    → 另外生成 minigame/preview（浏览器自测）
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(here, "dist");
const web = process.argv.includes("--web");

/** 包内静态资源：场景图、街坊立绘、示范音频 */
function copyAssets(to) {
  const { assetSub, sub } = manifestInfo;
  const put = (rel, srcAbs) => {
    const s = assetSub[rel];
    const sub = rel.includes("/") ? rel.split("/")[0] : "";
    const dstDir = s ? join(to, s, sub) : join(to, "street", sub);
    mkdirSync(dstDir, { recursive: true });
    cpSync(srcAbs, join(dstDir, rel.split("/").pop()));
  };
  for (const f of readdirSync(join(root, "public/street")))
    if (f.endsWith(".png")) put(f, join(root, "public/street", f));
  for (const f of readdirSync(join(root, "public/street/bg")))
    if (f.endsWith(".jpg")) put(`bg/${f}`, join(root, "public/street/bg", f));
  const audio = join(here, "assets/audio/street");
  if (!existsSync(audio)) return;
  mkdirSync(join(to, "audio", "street"), { recursive: true });
  for (const f of readdirSync(audio)) {
    if (!f.endsWith(".mp3")) continue;
    const key = f.slice(0, -4);
    if (sub[key]) {
      mkdirSync(join(to, sub[key]), { recursive: true });
      cpSync(join(audio, f), join(to, sub[key], f));
    } else cpSync(join(audio, f), join(to, "audio", "street", f));
  }
}

/** 第 SUB_FROM_CHAPTER 章起整章素材（立绘/背景/音频）放分包 resN/，主包只留前几章，防主包 4 MB 超限 */
const SUB_FROM_CHAPTER = 3;
let manifestInfo = { sub: {}, assetSub: {} };

/** 扫内容表得出 音频key→章节 与 立绘/背景→章节；被多章或前三章共用的素材留主包 */
function scanChapters() {
  const keyCh = new Map();
  const assetCh = new Map(); // rel(如 staff.png / bg/rooftop.jpg) -> Set<chapter>
  const dir = join(root, "src/street/content");
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    const m = /^ch(\d+)\.ts$/.exec(f);
    if (!m) continue;
    const ch = Number(m[1]);
    const txt = readFileSync(join(dir, f), "utf8");
    for (const sec of ["CARDS", "NPCS"]) {
      const start = txt.indexOf(`export const CH${ch}_${sec}`);
      if (start < 0) continue;
      const end = txt.indexOf("\n};", start);
      const blk = txt.slice(start, end > 0 ? end : txt.length);
      for (const idm of blk.matchAll(/id: "([^"]+)"/g)) {
        if (sec === "CARDS") keyCh.set(`c-${idm[1]}`, ch);
        else keyCh.set(`n-${idm[1]}`, ch);
      }
    }
    for (const im of txt.matchAll(/(?:img|bg): "([^"]+\.(?:png|jpg))"/g)) {
      const rel = im[1].startsWith("bg/") ? im[1] : im[1];
      if (!assetCh.has(rel)) assetCh.set(rel, new Set());
      assetCh.get(rel).add(ch);
    }
  }
  // chapters.ts 的章卡背景：id: N ... bg: "bg/x.jpg"
  const ct = readFileSync(join(root, "src/street/chapters.ts"), "utf8");
  for (const blk of ct.split(/\n {2}\{/)) {
    const idm = /id: (\d+),/.exec(blk);
    const bgm = /bg: "([^"]+\.jpg)"/.exec(blk);
    if (idm && bgm) {
      const rel = bgm[1];
      if (!assetCh.has(rel)) assetCh.set(rel, new Set());
      assetCh.get(rel).add(Number(idm[1]));
    }
  }
  return { keyCh, assetCh };
}

/** 按 assets/audio/street 里实际存在的 mp3 重新生成音频清单（含分包路由） */
function writeAudioManifest() {
  const dir = join(here, "assets/audio/street");
  const keys = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".mp3"))
        .map((f) => f.slice(0, -4))
        .sort()
    : [];
  const { keyCh, assetCh } = scanChapters();
  const sub = {};
  for (const k of keys) {
    const ch = keyCh.get(k.startsWith("n-") ? k.slice(0, k.lastIndexOf("-")) : k);
    if (ch >= SUB_FROM_CHAPTER) sub[k] = `res${ch}`;
  }
  const assetSub = {};
  for (const [rel, chs] of assetCh) {
    const arr = [...chs];
    if (arr.length === 1 && arr[0] >= SUB_FROM_CHAPTER) assetSub[rel] = `res${arr[0]}`;
  }
  manifestInfo = { sub, assetSub };
  const body = keys.length ? `[\n${keys.map((k) => `  "${k}"`).join(",\n")}\n]` : "[]";
  const subBody = JSON.stringify(sub);
  const assetBody = JSON.stringify(assetSub);
  const src = `/**
 * 包内静态资源清单（构建时由 build.mjs 自动生成，勿手改）：
 * 示范音频 key：c-<卡牌id> / n-<街坊id>-<台词序号>；未列出的 key 播放时提示看粤拼跟读。
 * 第 ${SUB_FROM_CHAPTER} 章起的立绘/背景/音频放分包 resN（wx 端会先 loadSubpackage）。
 */
export const AUDIO_KEYS: ReadonlySet<string> = new Set<string>(${body});

const AUDIO_SUB: Record<string, string> = ${subBody};

const ASSET_SUB: Record<string, string> = ${assetBody};

/** rel 形如 "street/auntie.png" 或 "street/bg/rooftop.jpg" */
export function assetPath(rel: string): string {
  const bare = rel.replace(/^street\\//, "");
  const s = ASSET_SUB[bare];
  return s ? \`\${s}/\${bare}\` : rel;
}

export function audioPath(key: string): string | null {
  if (!AUDIO_KEYS.has(key)) return null;
  const s = AUDIO_SUB[key];
  return s ? \`\${s}/\${key}.mp3\` : \`audio/street/\${key}.mp3\`;
}
`;
  writeFileSync(join(here, "src/audio-manifest.ts"), src);
  return { count: keys.length, sub };
}
const manifest = writeAudioManifest();
console.log(`示范音频 ${manifest.count} 条`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
await build({
  entryPoints: [join(here, "src/main-wx.ts")],
  bundle: true,
  format: "iife",
  target: "es2017",
  minify: true,
  outfile: join(dist, "game.js"),
  legalComments: "none"
});
/** game.json：注入分包声明（小游戏 subPackages，以官方文档为准） */
function writeGameJson(to) {
  const gj = JSON.parse(readFileSync(join(here, "game.json"), "utf8"));
  const resDirs = [
    ...new Set([...Object.values(manifestInfo.sub), ...Object.values(manifestInfo.assetSub)])
  ].sort();
  if (resDirs.length) gj.subPackages = resDirs.map((name) => ({ name, root: `${name}/` }));
  writeFileSync(join(to, "game.json"), JSON.stringify(gj, null, 2));
}
writeGameJson(dist);
cpSync(join(here, "project.config.json"), join(dist, "project.config.json"));
copyAssets(dist);

if (web) {
  const out = join(here, "preview");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await build({
    entryPoints: [join(here, "src/main-web.ts")],
    bundle: true,
    format: "iife",
    target: "es2019",
    outfile: join(out, "game.js")
  });
  writeFileSync(join(out, "index.html"), readFileSync(join(here, "preview.html"), "utf8"));
  await build({
    entryPoints: [join(here, "src/audio-check.ts")],
    bundle: true,
    format: "iife",
    target: "es2019",
    outfile: join(out, "audio-check.js")
  });
  writeFileSync(
    join(out, "audio-check.html"),
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>示范音频校对</title>
<style>body{font:14px "PingFang SC",sans-serif;background:#0b0d1a;color:#f2f3ff;margin:0;padding:16px}h1{font-size:20px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #2c3160;padding:8px;text-align:left;vertical-align:middle}
code{color:#ff4f8b;font-size:12px}audio{height:32px;width:200px}.miss{color:#8a91b4}
button{margin:16px 0;padding:10px 16px;border:0;border-radius:10px;background:#3ddc84;font-weight:bold}pre{background:#161a33;padding:12px;border-radius:8px}</style>
</head><body><div id="app"></div><script src="./audio-check.js"></script></body></html>`
  );
  copyAssets(out);
}

const size = (p) =>
  statSync(p).isDirectory()
    ? readdirSync(p).reduce((a, f) => a + size(join(p, f)), 0)
    : statSync(p).size;
const total = size(dist);
const resDirs = [
  ...new Set([...Object.values(manifestInfo.sub), ...Object.values(manifestInfo.assetSub)])
];
const subBytes = resDirs.reduce(
  (a, n) => a + (existsSync(join(dist, n)) ? size(join(dist, n)) : 0),
  0
);
const main = total - subBytes;
console.log(
  `主包 ${(main / 1024).toFixed(0)} KB（上限 4096）· 分包 ${(subBytes / 1024).toFixed(0)} KB · 整包 ${(total / 1024).toFixed(0)} KB（上限以官方文档为准）`
);
if (main > 4 * 1024 * 1024) {
  console.error("超出主包上限：把更多章节音频移入分包（SUB_FROM_CHAPTER）");
  process.exit(1);
}
