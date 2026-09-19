/**
 * P6-F2 粒子场（Canvas 2D 单层）：微尘氛围 + 声波涟漪 + 爆发粒子，单 rAF 合帧。
 *
 * 替代 P5 AmbientField（ambient.ts 保留一版兼容壳）：
 * - 三幕主题（方案 §5-M6）：龙楼炭火 / 雾海横雾 / 云顶光尘；
 * - 音频响应（方案 §5-M7）：setAudioLevel 注入频谱，低音使微尘微微外扩增亮；
 * - 预算纪律：≤512 粒对象池、DPR≤2、visibilitychange 停帧、reduce-motion 全停。
 */

import { type BurstSpec, createBurstRng, emitBurst } from "./emitter";
import { PARTICLE_STRIDE, type ParticlePool, clearPool, createPool, step } from "./pool";

interface Mote {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  phase: number;
  hue: number;
}

interface Ripple {
  x: number;
  y: number;
  born: number;
}

export interface AudioLevel {
  bass: number;
  mid: number;
  treble: number;
}

export interface FieldTheme {
  id: "act1" | "act2" | "act3";
  moteCount: number;
  moteHueA: number;
  moteHueB: number;
  /** 微尘基础上升速度（归一化/秒） */
  rise: number;
  /** 水平漂移（正=向右；雾海为横向飘移） */
  drift: number;
  rippleHue: number;
  /** 微尘透明度基调（云顶更清冷稀疏） */
  alpha: number;
}

export const ACT_THEMES: Record<FieldTheme["id"], FieldTheme> = {
  act1: {
    id: "act1",
    moteCount: 36,
    moteHueA: 28,
    moteHueB: 52,
    rise: 0.013,
    drift: 0.002,
    rippleHue: 38,
    alpha: 0.5
  },
  act2: {
    id: "act2",
    moteCount: 44,
    moteHueA: 186,
    moteHueB: 214,
    rise: 0.003,
    drift: 0.016,
    rippleHue: 196,
    alpha: 0.4
  },
  act3: {
    id: "act3",
    moteCount: 30,
    moteHueA: 42,
    moteHueB: 200,
    rise: 0.02,
    drift: 0.001,
    rippleHue: 48,
    alpha: 0.44
  }
};

/** 从局态推断氛围主题：战役按幕；经典/无尽/标题 = 一幕龙楼。 */
export function actThemeFor(state: {
  campaign?: { act: number } | null;
  endless?: boolean;
}): FieldTheme {
  const act = state.campaign?.act ?? 1;
  if (act === 2) return ACT_THEMES.act2;
  if (act === 3) return ACT_THEMES.act3;
  return ACT_THEMES.act1;
}

export interface ParticleFieldOptions {
  reducedMotion?: boolean;
  theme?: FieldTheme;
  poolCapacity?: number;
}

export class ParticleField {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D | null;
  protected motes: Mote[] = [];
  protected ripples: Ripple[] = [];
  protected pool: ParticlePool;
  protected theme: FieldTheme;
  protected reducedMotion: boolean;
  private raf = 0;
  private running = false;
  private lastRipple = 0;
  private lastFrame = 0;
  private burstRng = createBurstRng();
  private audioLevel: (() => AudioLevel | null) | null = null;
  private smoothBass = 0;

  constructor(canvas: HTMLCanvasElement, options: ParticleFieldOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.theme = options.theme ?? ACT_THEMES.act1;
    this.reducedMotion = options.reducedMotion ?? false;
    this.pool = createPool(options.poolCapacity ?? 512);
    if (this.ctx && !this.reducedMotion) {
      this.spawnMotes();
      this.resize();
      window.addEventListener("resize", this.resize);
      document.addEventListener("visibilitychange", this.handleVisibility);
      this.start();
    }
  }

  /** 当前主题（组合根比对幕号用）。 */
  get currentTheme(): FieldTheme {
    return this.theme;
  }

  setReducedMotion(reduced: boolean): void {
    if (reduced === this.reducedMotion) return;
    this.reducedMotion = reduced;
    if (reduced) {
      this.stop();
      this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else if (this.ctx) {
      this.spawnMotes();
      this.resize();
      this.start();
    }
  }

  /** 切幕换主题：微尘按新主题重生成，爆发粒子保留（自然衰亡）。 */
  setTheme(theme: FieldTheme): void {
    if (theme.id === this.theme.id) return;
    this.theme = theme;
    this.spawnMotes();
  }

  /** 注入频谱提供者（GameAudio.level）；无 BGM 时返回 null，场保持静态呼吸。 */
  setAudioLevel(provider: (() => AudioLevel | null) | null): void {
    this.audioLevel = provider;
  }

  /** 一次爆发（命中/胜利/败北…由 F1 的 burst sink 驱动）。 */
  burst(spec: BurstSpec): void {
    if (!this.running || this.reducedMotion) return;
    emitBurst(this.pool, spec, this.burstRng);
    this.start();
  }

  /** 兼容 P5 AmbientField.pulse：施法命中涟漪。 */
  pulse(): void {
    if (!this.running || this.reducedMotion) return;
    const now = performance.now();
    if (now - this.lastRipple < 400) return;
    this.lastRipple = now;
    this.ripples.push({
      x: this.canvas.width * (0.2 + Math.random() * 0.6),
      y: this.canvas.height * (0.2 + Math.random() * 0.5),
      born: now
    });
    if (this.ripples.length > 6) this.ripples.shift();
  }

  /** 清空爆发粒子（切幕时避免上一幕的火花飘进新场景）。 */
  clearBursts(): void {
    clearPool(this.pool);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }

  /* ── 内部 ─────────────────────────────────────────────────────────── */

  protected spawnMotes(): void {
    const { moteCount, moteHueA, moteHueB, rise, drift } = this.theme;
    this.motes = Array.from({ length: moteCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      vy: rise * (0.6 + Math.random() * 0.9),
      vx: drift * (0.4 + Math.random()) + (Math.random() - 0.5) * 0.002,
      phase: Math.random() * Math.PI * 2,
      hue: moteHueA + Math.random() * (moteHueB - moteHueA)
    }));
  }

  protected resize = (): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  };

  private handleVisibility = (): void => {
    if (document.hidden) this.stop();
    else if (!this.reducedMotion) this.start();
  };

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (): void => {
    if (!this.running || !this.ctx) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const t = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (t - this.lastFrame) / 1000));
    this.lastFrame = t;

    // 音频响应：低音能量平滑后驱动微尘增亮 + 轻微外扩
    const level = this.audioLevel?.() ?? null;
    const targetBass = level ? Math.min(1, level.bass * 1.6) : 0;
    this.smoothBass += (targetBass - this.smoothBass) * 0.08;
    const bass = this.smoothBass;

    ctx.clearRect(0, 0, width, height);

    // ① 微尘（主题动力学 + 呼吸闪烁 + 低音脉冲）
    const alphaBase = this.theme.alpha;
    for (const mote of this.motes) {
      mote.y -= mote.vy * dt * 60 * 0.016;
      mote.x += mote.vx * dt * 60 * 0.016 + Math.sin(t / 2400 + mote.phase) * 0.0004;
      if (mote.y < -0.02) {
        mote.y = 1.02;
        mote.x = Math.random();
      }
      if (mote.x < -0.02) mote.x = 1.02;
      if (mote.x > 1.02) mote.x = -0.02;
      const twinkle = 0.35 + 0.3 * Math.sin(t / 1300 + mote.phase * 3);
      const glow = Math.max(0.06, twinkle * alphaBase + bass * 0.22);
      const r = mote.r * (1 + bass * 0.5);
      ctx.beginPath();
      ctx.arc(mote.x * width, mote.y * height, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${mote.hue}, 42%, 72%, ${glow})`;
      ctx.fill();
    }

    // ② 声波涟漪（兼容 P5）
    this.ripples = this.ripples.filter((ripple) => t - ripple.born < 1400);
    for (const ripple of this.ripples) {
      const age = (t - ripple.born) / 1400;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, age * 90, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${this.theme.rippleHue}, 60%, 70%, ${(1 - age) * 0.28})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // ③ 爆发粒子（对象池 + lighter 叠加出辉光感）
    if (this.pool.count > 0) {
      step(this.pool, dt);
      const d = this.pool.data;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.pool.count; i += 1) {
        const o = i * PARTICLE_STRIDE;
        const lifeRatio = d[o + 5] / d[o + 6];
        const alpha = Math.max(0, Math.min(1, lifeRatio)) * 0.9;
        ctx.beginPath();
        ctx.arc(d[o] * width, d[o + 1] * height, d[o + 7], 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${d[o + 8]}, 78%, 64%, ${alpha})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    this.raf = requestAnimationFrame(this.frame);
  };
}
