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
  mkdirSync(join(to, "street", "bg"), { recursive: true });
  for (const f of readdirSync(join(root, "public/street")))
    if (f.endsWith(".png")) cpSync(join(root, "public/street", f), join(to, "street", f));
  cpSync(join(root, "public/street/bg"), join(to, "street/bg"), { recursive: true });
  const audio = join(here, "assets/audio/street");
  if (!existsSync(audio)) return;
  mkdirSync(join(to, "audio", "street"), { recursive: true });
  for (const f of readdirSync(audio)) {
    if (!f.endsWith(".mp3")) continue;
    const key = f.slice(0, -4);
    if (manifest.sub[key]) {
      mkdirSync(join(to, manifest.sub[key]), { recursive: true });
      cpSync(join(audio, f), join(to, manifest.sub[key], f));
    } else cpSync(join(audio, f), join(to, "audio", "street", f));
  }
}

/** 第 SUB_FROM_CHAPTER 章起音频放分包（audioN/），主包只留前几章，防主包 4 MB 超限 */
const SUB_FROM_CHAPTER = 3;

/** 扫内容表得出 key→章节：c-<卡id> / n-<街坊id>-<i>；查不到章节的（recap 等）算主包 */
function keyChapters() {
  const map = new Map();
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
        if (sec === "CARDS") map.set(`c-${idm[1]}`, ch);
        else map.set(`n-${idm[1]}`, ch);
      }
    }
  }
  return map;
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
  const kc = keyChapters();
  const sub = {};
  for (const k of keys) {
    const ch = kc.get(k.startsWith("n-") ? k.slice(0, k.lastIndexOf("-")) : k);
    if (ch >= SUB_FROM_CHAPTER) sub[k] = `audio${ch}`;
  }
  const body = keys.length ? `[\n${keys.map((k) => `  "${k}"`).join(",\n")}\n]` : "[]";
  const subBody = JSON.stringify(sub);
  const src = `/**
 * 包内粤语示范音频清单（构建时由 build.mjs 按 minigame/assets/audio/street/*.mp3 自动生成，勿手改）。
 * key：c-<卡牌id> / n-<街坊id>-<台词序号>。未列出的 key 播放时提示看粤拼跟读。
 * 第 ${SUB_FROM_CHAPTER} 章起为分包路径 audioN/<key>.mp3（wx 端播放前会先 loadSubpackage）。
 */
export const AUDIO_KEYS: ReadonlySet<string> = new Set<string>(${body});

const AUDIO_SUB: Record<string, string> = ${subBody};

export function audioPath(key: string): string | null {
  if (!AUDIO_KEYS.has(key)) return null;
  const s = AUDIO_SUB[key];
  return s ? \`\${s}/\${key}.mp3\` : \`audio/street/\${key}.mp3\`;
}
`;
  writeFileSync(join(here, "src/audio-manifest.ts"), src);
  return { count: keys.length, sub, subChapters: [...new Set(Object.values(sub))].sort() };
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
  if (manifest.subChapters.length)
    gj.subPackages = manifest.subChapters.map((name) => ({ name, root: `${name}/` }));
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
const subBytes = manifest.subChapters.reduce((a, n) => a + size(join(dist, n)), 0);
const main = total - subBytes;
console.log(
  `主包 ${(main / 1024).toFixed(0)} KB（上限 4096）· 分包 ${(subBytes / 1024).toFixed(0)} KB · 整包 ${(total / 1024).toFixed(0)} KB（上限以官方文档为准）`
);
if (main > 4 * 1024 * 1024) {
  console.error("超出主包上限：把更多章节音频移入分包（SUB_FROM_CHAPTER）");
  process.exit(1);
}
