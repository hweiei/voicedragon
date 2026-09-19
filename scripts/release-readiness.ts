/**
 * P8-E 发布产物契约：在 vite build 后验证 PWA 壳、子路径、图标、安全头和隐私边界。
 * 用法：vite-node scripts/release-readiness.ts [--base=./|/voicedragon/]
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const distDir = new URL("../dist", import.meta.url).pathname;
const expectedBase = process.argv.find((arg) => arg.startsWith("--base="))?.slice(7) ?? "./";
const failures: string[] = [];
let passed = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failures.push(detail ? `${label}：${detail}` : label);
    console.error(`  ❌ ${label}${detail ? `：${detail}` : ""}`);
  }
}

function text(name: string): string {
  return readFileSync(join(distDir, name), "utf8");
}

function filesBelow(directory: string): string[] {
  const result: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) result.push(...filesBelow(path));
    else result.push(relative(distDir, path).replaceAll("\\", "/"));
  }
  return result;
}

function pngSize(name: string): { width: number; height: number } | null {
  const bytes = readFileSync(join(distDir, name));
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== signature) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

console.log(`\nP8-E 发布产物契约 · base=${expectedBase}`);
check("dist 目录存在", existsSync(distDir));

const required = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "registerSW.js",
  "icon.svg",
  "pwa-192.png",
  "pwa-512.png",
  "og-banner.jpg",
  "robots.txt",
  "_headers"
];
for (const name of required) check(`必需文件 ${name}`, existsSync(join(distDir, name)));

const index = text("index.html");
const manifest = JSON.parse(text("manifest.webmanifest")) as {
  id?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  orientation?: string;
  theme_color?: string;
  icons?: Array<{ src?: string; sizes?: string; purpose?: string }>;
};
const serviceWorker = text("sw.js");
const headers = text("_headers");
const allFiles = filesBelow(distDir);

check(
  "HTML 标题与描述存在",
  index.includes("<title>声震龙楼") && index.includes('name="description"')
);
check(
  "viewport 允许缩放并适配安全区",
  index.includes("width=device-width, initial-scale=1, viewport-fit=cover") &&
    !index.includes("user-scalable=no") &&
    !index.includes("maximum-scale")
);
check("HTML 不残留源码入口", !index.includes("/src/main.ts"));
check("HTML 不含 localhost", !/localhost|127\.0\.0\.1/.test(index));
check("HTML 引用构建 JS/CSS", /(?:src|href)="[^"]*assets\/[^"?]+\.(?:js|css)"/.test(index));
check("HTML 引用 manifest", /rel="manifest" href="[^"]*manifest\.webmanifest"/.test(index));
check(
  "HTML 引用分享图",
  /(?:property|name)="(?:og:image|twitter:image)" content="[^"]*og-banner\.jpg"/.test(index)
);

const localAssets = [
  ...index.matchAll(/(?:src|href|content)="([^"#]+\.(?:js|css|svg|png|jpg|webmanifest))"/g)
].map((match) => match[1]);
const portablePaths = localAssets.every((url) =>
  expectedBase === "./" ? url.startsWith("./") : url.startsWith(expectedBase)
);
check(
  "HTML 静态资源符合部署 base",
  portablePaths,
  localAssets
    .filter((url) =>
      expectedBase === "./" ? !url.startsWith("./") : !url.startsWith(expectedBase)
    )
    .join(", ")
);

check(
  "manifest id/start/scope 使用相对路径",
  manifest.id === "./" && manifest.start_url === "./" && manifest.scope === "./"
);
check(
  "manifest 为竖屏 standalone",
  manifest.display === "standalone" && manifest.orientation === "portrait"
);
check("manifest 主题色完整", manifest.theme_color === "#171311");
const icons = manifest.icons ?? [];
check(
  "manifest 包含 192 图标",
  icons.some((icon) => icon.src === "pwa-192.png" && icon.sizes === "192x192")
);
check(
  "manifest 包含 512 图标",
  icons.some((icon) => icon.src === "pwa-512.png" && icon.sizes === "512x512")
);
check(
  "manifest 包含 maskable 图标",
  icons.some((icon) => icon.src === "pwa-512.png" && icon.purpose === "maskable")
);
const pwa192 = pngSize("pwa-192.png");
const pwa512 = pngSize("pwa-512.png");
check("192 PNG 实际尺寸正确", pwa192?.width === 192 && pwa192.height === 192);
check("512 PNG 实际尺寸正确", pwa512?.width === 512 && pwa512.height === 512);

for (const asset of [
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "pwa-192.png",
  "pwa-512.png"
]) {
  check(`Service Worker 预缓存 ${asset}`, serviceWorker.includes(`url:\"${asset}\"`));
}
check("Service Worker 预缓存主 JS", serviceWorker.includes('url:"assets/index-'));
check("Service Worker 预缓存主 CSS", serviceWorker.includes(".css"));
check("安装壳不包含模型 data 包", !allFiles.some((file) => file.endsWith(".data")));

check(
  "哈希资源使用 immutable 缓存",
  headers.includes("/assets/*") && headers.includes("max-age=31536000, immutable")
);
check(
  "入口与 Service Worker 禁止陈旧缓存",
  headers.includes("/sw.js") && headers.includes("/index.html") && headers.includes("no-cache")
);
check(
  "权限策略仅允许同源麦克风",
  headers.includes("Permissions-Policy: microphone=(self), geolocation=(), camera=()")
);
check("禁止 MIME 嗅探", headers.includes("X-Content-Type-Options: nosniff"));
check(
  "拒绝 iframe 嵌入",
  headers.includes("X-Frame-Options: DENY") && headers.includes("frame-ancestors 'none'")
);
check(
  "CSP 限制对象与表单",
  headers.includes("object-src 'none'") && headers.includes("form-action 'self'")
);
check(
  "CSP 允许端侧 Worker 与模型源",
  headers.includes("worker-src 'self' blob:") &&
    headers.includes("https://huggingface.co") &&
    headers.includes("https://*.hf.co")
);
check("HSTS 已启用", headers.includes("Strict-Transport-Security: max-age=31536000"));

const forbidden = allFiles.filter(
  (file) =>
    /(^|\/)\.env(?:\.|$)/i.test(file) || /(^|\/)[^/]*(?:credential|secret|token)[^/]*$/i.test(file)
);
check("发布物不含凭据命名文件", forbidden.length === 0, forbidden.join(", "));

if (failures.length) {
  console.error(`\n发布契约失败：${failures.length} 项\n- ${failures.join("\n- ")}\n`);
  process.exit(1);
}
console.log(`发布契约通过：${passed} 项 ✅\n`);
