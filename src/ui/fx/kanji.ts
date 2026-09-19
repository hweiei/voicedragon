/**
 * P6-F3 汉字粒子采样：把汉字光栅化为归一化点云（方案 §5-M4 签名演出）。
 *
 * 零素材路线：运行时在 28×28 离屏小画布上渲染系统字体，按像素透明度采样，
 * 结果按字符缓存。非浏览器环境（单测/SSR）安全返回空数组。
 */

const GRID = 28;
const ALPHA_THRESHOLD = 128;

const pointCache = new Map<string, Array<{ x: number; y: number }>>();

/** 字符 → 归一化点云（x/y ∈ [0,1]，原点在左上）。不可用时返回 []。 */
export function kanjiPoints(char: string): Array<{ x: number; y: number }> {
  const cached = pointCache.get(char);
  if (cached) return cached;
  if (typeof document === "undefined") return [];

  const canvas = document.createElement("canvas");
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, GRID, GRID);
  ctx.fillStyle = "#fff";
  ctx.font = `${Math.floor(GRID * 0.92)}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, GRID / 2, GRID / 2 + GRID * 0.05);

  const data = ctx.getImageData(0, 0, GRID, GRID).data;
  const points: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (data[(y * GRID + x) * 4 + 3] > ALPHA_THRESHOLD) {
        points.push({ x: x / (GRID - 1), y: y / (GRID - 1) });
      }
    }
  }
  pointCache.set(char, points);
  return points;
}

/** 测试钩子：清缓存（字体环境变化时用）。 */
export function clearKanjiCache(): void {
  pointCache.clear();
}
