/**
 * P4 战绩海报（渲染层）：Canvas 2D 绘制 4:5 竖版战报图，
 * 供 navigator.share / 下载分享（零后端裂变素材，REDESIGN-PLAN §7.10）。
 */

export interface PosterStat {
  label: string;
  value: string;
}

export interface PosterData {
  victory: boolean;
  title: string;
  subtitle: string;
  seal: string;
  stats: PosterStat[];
  dateLabel: string;
  starsLabel?: string;
}

const W = 900;
const H = 1125;

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawRunPoster(canvas: HTMLCanvasElement, data: PosterData): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;

  // 背景：墨色渐变 + 顶部声环
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c1513");
  bg.addColorStop(0.6, "#171311");
  bg.addColorStop(1, "#0f1211");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(214, 169, 77, 0.16)";
  for (const r of [140, 220, 300]) {
    ctx.beginPath();
    ctx.arc(W / 2, 330, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 金框
  ctx.strokeStyle = "rgba(240, 207, 131, 0.55)";
  ctx.lineWidth = 3;
  roundRectPath(ctx, 24, 24, W - 48, H - 48, 26);
  ctx.stroke();

  // 印章
  ctx.save();
  ctx.translate(W / 2, 300);
  ctx.fillStyle = data.victory ? "#d84e3f" : "#4f5a5e";
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3e7ce";
  ctx.font = "bold 96px 'Noto Serif SC', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.seal, 0, 8);
  ctx.restore();

  // 标题区
  ctx.fillStyle = "#f0cf83";
  ctx.font = "bold 64px 'Noto Serif SC', serif";
  ctx.textAlign = "center";
  ctx.fillText(data.title, W / 2, 480);
  ctx.fillStyle = "#aa9b85";
  ctx.font = "30px 'Noto Sans SC', sans-serif";
  ctx.fillText(data.subtitle, W / 2, 536);

  // 星辉行
  if (data.starsLabel) {
    ctx.fillStyle = "#f0cf83";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText(data.starsLabel, W / 2, 600);
  }

  // 数据格
  const cols = 2;
  const cardW = 330;
  const cardH = 108;
  const gap = 26;
  const startX = (W - (cols * cardW + (cols - 1) * gap)) / 2;
  const y0 = data.starsLabel ? 660 : 616;
  data.stats.forEach((stat, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * (cardW + gap);
    const y = y0 + row * (cardH + gap);
    ctx.fillStyle = "rgba(33, 26, 24, 0.85)";
    roundRectPath(ctx, x, y, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 209, 167, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#f3e7ce";
    ctx.font = "bold 44px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stat.value, x + cardW / 2, y + 52);
    ctx.fillStyle = "#aa9b85";
    ctx.font = "24px 'Noto Sans SC', sans-serif";
    ctx.fillText(stat.label, x + cardW / 2, y + 88);
  });

  // 底部：品牌 + 日期
  const rows = Math.ceil(data.stats.length / cols);
  void rows;
  ctx.fillStyle = "rgba(232, 209, 167, 0.5)";
  ctx.font = "26px 'Noto Sans SC', sans-serif";
  ctx.fillText(`声震龙楼 · 讲得准，打得狠 · ${data.dateLabel}`, W / 2, H - 70);
}

export async function sharePoster(
  canvas: HTMLCanvasElement,
  filename: string
): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((item) => resolve(item), "image/png")
  );
  if (!blob) return "failed";
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (payload: { files: File[] }) => boolean;
    share?: (payload: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  try {
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: "声震龙楼战绩" });
      return "shared";
    }
  } catch {
    // 用户取消分享视为未成功但无需下载
    return "failed";
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
