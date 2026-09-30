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
  for (const n of ["auntie", "waiter", "taxi", "landlady", "boss"])
    cpSync(join(root, "public/street", `${n}.png`), join(to, "street", `${n}.png`));
  cpSync(join(root, "public/street/bg"), join(to, "street/bg"), { recursive: true });
  const audio = join(here, "assets/audio");
  if (existsSync(audio)) cpSync(audio, join(to, "audio"), { recursive: true });
}

/** 按 assets/audio/street 里实际存在的 mp3 重新生成音频清单 */
function writeAudioManifest() {
  const dir = join(here, "assets/audio/street");
  const keys = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".mp3"))
        .map((f) => f.slice(0, -4))
        .sort()
    : [];
  const body = keys.length ? `[\n${keys.map((k) => `  "${k}"`).join(",\n")}\n]` : "[]";
  const src = `/**
 * 包内粤语示范音频清单（构建时由 build.mjs 按 minigame/assets/audio/street/*.mp3 自动生成，勿手改）。
 * key：c-<卡牌id> / n-<街坊id>-<台词序号>。未列出的 key 播放时提示看粤拼跟读。
 * 小游戏里没有系统粤语 TTS，所以示范只能靠预录音频。
 */
export const AUDIO_KEYS: ReadonlySet<string> = new Set<string>(${body});

export function audioPath(key: string): string | null {
  return AUDIO_KEYS.has(key) ? \`audio/street/\${key}.mp3\` : null;
}
`;
  writeFileSync(join(here, "src/audio-manifest.ts"), src);
  return keys.length;
}
console.log(`示范音频 ${writeAudioManifest()} 条`);

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
cpSync(join(here, "game.json"), join(dist, "game.json"));
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
  copyAssets(out);
}

const size = (p) =>
  statSync(p).isDirectory()
    ? readdirSync(p).reduce((a, f) => a + size(join(p, f)), 0)
    : statSync(p).size;
const total = size(dist);
console.log(`小游戏包 ${(total / 1024).toFixed(0)} KB（主包上限 4096 KB，以官方文档为准）`);
if (total > 4 * 1024 * 1024) {
  console.error("超出主包上限：请把音频放分包或 CDN");
  process.exit(1);
}
