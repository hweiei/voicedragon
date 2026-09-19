/**
 * P6-F2 语音光环 VoiceAura（方案 §5-M5 · 本方案王牌）：
 * 说话时施法弹层升起一道"龙吟环"——音量驱动环的涨落与亮度，
 * 基频在说话人音域内的相对位置漂移六种调域色相（粤语六调的视觉隐喻），
 * 持续稳定发声时环缘凝聚出"龙鳞"分段。
 *
 * 数据源全部复用现有管线（零新增采集）：
 * - 音量：MicRecorder.onVolume（RMS）经适配器转发；
 * - 音高：PitchTracker 的 onPitchFrame（pitchy 基频 + 清晰度）。
 *
 * 纯函数/纯状态部分（PitchRange、auraHueFor）可单测；
 * WebSpeech 等无基频通道时退化为"雾气态"（只有音量呼吸），与评分回退策略同源。
 */

import type { PitchFrame } from "../../core/tone";

/** 粤语六调 → 色相环（阴平金 / 阴上青 / 阴去朱 / 阳平蓝 / 阳上紫 / 阳去翠）。 */
export const TONE_HUES: readonly number[] = [48, 168, 16, 210, 280, 150];

/** 归一化音高 [0,1] → 六调域色相（越界/非法值落回阴平金）。 */
export function auraHueFor(norm: number): number {
  if (!Number.isFinite(norm)) return TONE_HUES[0];
  const clamped = Math.min(1, Math.max(0, norm));
  const idx = Math.min(TONE_HUES.length - 1, Math.floor(clamped * TONE_HUES.length));
  return TONE_HUES[idx];
}

/**
 * 说话人音域归一器：用本句话观测到的最低/最高基频把当前音高映射到 [0,1]。
 * 与评分层"中位数归一"同思想（音域无关），但为实时视觉做了宽容处理：
 * 样本不足 3 帧或音域窄于 20Hz 时返回中性 0.5（环色不抖）。
 */
export class PitchRange {
  private lo = Number.POSITIVE_INFINITY;
  private hi = Number.NEGATIVE_INFINITY;
  private samples = 0;

  push(hz: number): number | null {
    if (!Number.isFinite(hz) || hz < 50 || hz > 800) return null; // 人声护栏
    this.lo = Math.min(this.lo, hz);
    this.hi = Math.max(this.hi, hz);
    this.samples += 1;
    if (this.samples < 3 || this.hi - this.lo < 20) return 0.5;
    return (hz - this.lo) / (this.hi - this.lo);
  }

  reset(): void {
    this.lo = Number.POSITIVE_INFINITY;
    this.hi = Number.NEGATIVE_INFINITY;
    this.samples = 0;
  }
}

const TWO_PI = Math.PI * 2;
/** 连续有声帧达到该值后环缘凝聚龙鳞 */
const SCALE_STREAK = 6;
/** 色相平滑系数（避免调域跳变闪烁） */
const HUE_LERP = 0.12;

export class VoiceAura {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private raf = 0;
  private running = false;
  private range = new PitchRange();
  private targetVolume = 0;
  private volume = 0;
  private hue = TONE_HUES[0];
  private targetHue = TONE_HUES[0];
  private pitchNorm: number | null = null;
  private voicedStreak = 0;
  private spin = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  start(): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.range.reset();
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** MicRecorder RMS（0..~0.35）→ 目标能量。 */
  pushVolume(rms: number): void {
    this.targetVolume = Math.max(0, Math.min(1, rms * 4));
  }

  /** 基频帧：清晰度不足视为无声（龙鳞断开）。 */
  pushPitchFrame(frame: PitchFrame): void {
    if (frame.clarity < 0.5) {
      this.voicedStreak = 0;
      return;
    }
    const norm = this.range.push(frame.freq);
    if (norm === null) return;
    this.pitchNorm = norm;
    this.voicedStreak += 1;
    this.targetHue = auraHueFor(norm);
  }

  /* ── 内部 ─────────────────────────────────────────────────────────── */

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  private frame = (): void => {
    if (!this.running || !this.ctx) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const calm = document.body.classList.contains("reduce-motion");

    // 能量/色相平滑
    this.volume += (this.targetVolume - this.volume) * 0.22;
    this.targetVolume *= 0.9; // 无新帧时自然回落
    this.hue += shortestHueDelta(this.hue, this.targetHue) * HUE_LERP;
    if (!calm) this.spin += 0.006 + this.volume * 0.05;

    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const base = Math.min(width, height) * 0.36;
    const radius = base * (0.78 + this.volume * 0.5);
    const alpha = calm ? 0.28 + this.volume * 0.5 : 0.34 + this.volume * 0.6;

    // 内层呼吸光晕
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.5);
    glow.addColorStop(0, `hsla(${this.hue}, 70%, 62%, ${alpha * 0.28})`);
    glow.addColorStop(1, `hsla(${this.hue}, 70%, 62%, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // 主环：有声且稳定 → 12 段龙鳞；否则雾气环
    const scaled = this.voicedStreak >= SCALE_STREAK && !calm;
    ctx.lineWidth = Math.max(1.6, base * 0.05 * (1 + this.volume));
    if (scaled) {
      const segments = 12;
      const gap = 0.22;
      for (let s = 0; s < segments; s += 1) {
        const a0 = this.spin + (s / segments) * TWO_PI;
        const a1 = a0 + (TWO_PI / segments) * (1 - gap);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, a0, a1);
        ctx.strokeStyle = `hsla(${this.hue}, 78%, ${58 + this.volume * 20}%, ${alpha})`;
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TWO_PI);
      ctx.strokeStyle = `hsla(${this.hue}, 52%, 60%, ${alpha * 0.8})`;
      ctx.stroke();
    }

    // 中心吐息点
    ctx.beginPath();
    ctx.arc(cx, cy, base * 0.08 * (1 + this.volume * 1.4), 0, TWO_PI);
    ctx.fillStyle = `hsla(${this.hue}, 80%, 70%, ${alpha})`;
    ctx.fill();

    this.raf = requestAnimationFrame(this.frame);
  };
}

/** 色相最短路径差（350°→10° 应走 +20° 而非 -340°）。 */
function shortestHueDelta(from: number, to: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return delta;
}
