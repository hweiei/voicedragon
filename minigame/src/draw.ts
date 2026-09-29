/**
 * 极简 Canvas 即时模式 UI：每帧整屏重画，按钮登记点击区。
 * 配色沿用网页版霓虹港风。
 */
import type { ImageLike, Platform } from "./platform";

export const C = {
  bg: "#0b0d1a",
  panel: "#161a33",
  line: "#2c3160",
  text: "#f2f3ff",
  dim: "#8a91b4",
  pink: "#ff4f8b",
  cyan: "#27e1d6",
  amber: "#ffb627",
  violet: "#9b7bff",
  ok: "#3ddc84",
  ink: "#1b1d33"
};

export const FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
export const MONO = 'ui-monospace,"SF Mono",Menlo,monospace';

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  act: string;
  id: string;
  /** 按住型按钮：按下触发 act，松开触发 act+"Up" */
  hold?: boolean;
}

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  weight?: string;
  font?: string;
  base?: CanvasTextBaseline;
}

export class Painter {
  regions: Region[] = [];
  constructor(readonly p: Platform) {}

  get ctx(): CanvasRenderingContext2D {
    return this.p.ctx;
  }

  begin(): void {
    this.regions = [];
    const { ctx } = this;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.p.width, this.p.height);
  }

  hit(x: number, y: number): Region | null {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  }

  region(x: number, y: number, w: number, h: number, act: string, id = "", hold = false): void {
    this.regions.push({ x, y, w, h, act, id, hold });
  }

  rr(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string,
    stroke?: string,
    lw = 1
  ): void {
    const { ctx } = this;
    ctx.beginPath();
    const rad = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  glow(color: string, blur: number, fn: () => void): void {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    fn();
    ctx.restore();
  }

  text(s: string, x: number, y: number, o: TextOpts = {}): number {
    const { ctx } = this;
    ctx.font = `${o.weight ?? "normal"} ${o.size ?? 14}px ${o.font ?? FONT}`;
    ctx.fillStyle = o.color ?? C.text;
    ctx.textAlign = o.align ?? "left";
    ctx.textBaseline = o.base ?? "alphabetic";
    ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  }

  measure(s: string, size: number, weight = "normal", font = FONT): number {
    this.ctx.font = `${weight} ${size}px ${font}`;
    return this.ctx.measureText(s).width;
  }

  /** 按字符折行（中文友好），返回占用高度 */
  wrap(
    s: string,
    x: number,
    y: number,
    maxW: number,
    lineH: number,
    o: TextOpts = {},
    maxLines = 9
  ): number {
    const size = o.size ?? 14;
    const lines: string[] = [];
    let cur = "";
    for (const ch of s) {
      if (this.measure(cur + ch, size, o.weight, o.font) > maxW && cur) {
        lines.push(cur);
        cur = ch;
      } else cur += ch;
    }
    if (cur) lines.push(cur);
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) shown[maxLines - 1] = `${shown[maxLines - 1].slice(0, -1)}…`;
    shown.forEach((l, i) => this.text(l, x, y + i * lineH, o));
    return shown.length * lineH;
  }

  /** contain 方式画图；图片未加载完成时跳过 */
  img(
    im: ImageLike,
    x: number,
    y: number,
    w: number,
    h: number,
    align: "center" | "bottom" = "center"
  ): void {
    if (!im.width) return;
    const s = Math.min(w / im.width, h / im.height);
    const dw = im.width * s;
    const dh = im.height * s;
    const dx = x + (w - dw) / 2;
    const dy = align === "bottom" ? y + h - dh : y + (h - dh) / 2;
    this.ctx.drawImage(im as CanvasImageSource, dx, dy, dw, dh);
  }

  /** cover 方式画背景图 */
  cover(im: ImageLike, x: number, y: number, w: number, h: number): void {
    if (!im.width) return;
    const s = Math.max(w / im.width, h / im.height);
    const sw = w / s;
    const sh = h / s;
    this.ctx.drawImage(
      im as CanvasImageSource,
      (im.width - sw) / 2,
      (im.height - sh) / 2,
      sw,
      sh,
      x,
      y,
      w,
      h
    );
  }

  vfade(x: number, y: number, w: number, h: number, from: string, to: string): void {
    const g = this.ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x, y, w, h);
  }

  button(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    act: string,
    id = "",
    style: "ok" | "ghost" | "pink" | "amber" | "cyan" = "ok",
    sub?: string
  ): void {
    const fill = { ok: C.ok, ghost: "transparent", pink: C.pink, amber: C.amber, cyan: C.cyan }[
      style
    ];
    const fg = style === "ghost" ? C.text : C.ink;
    if (style !== "ghost") this.rr(x, y + 4, w, h, 14, "rgba(0,0,0,.35)");
    this.rr(
      x,
      y,
      w,
      h,
      14,
      style === "ghost" ? undefined : fill,
      style === "ghost" ? C.line : undefined,
      1.5
    );
    const cy = sub ? y + h / 2 - 2 : y + h / 2 + 6;
    this.text(label, x + w / 2, cy, { size: 16, weight: "bold", color: fg, align: "center" });
    if (sub) this.text(sub, x + w / 2, y + h / 2 + 15, { size: 12, color: fg, align: "center" });
    this.region(x, y, w, h, act, id);
  }

  bar(x: number, y: number, w: number, h: number, v: number, max: number, color: string): void {
    this.rr(x, y, w, h, h / 2, "#262a4a");
    if (v > 0) this.rr(x, y, Math.max(h, (w * Math.min(v, max)) / max), h, h / 2, color);
  }
}
