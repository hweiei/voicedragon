/**
 * P5 氛围粒子（Canvas 2D）：标题/局内的微尘漂浮 + 声波涟漪。
 * 预算友好：单层 canvas、~36 粒子、rAF 驱动；页面隐藏即停；
 * reduce-motion / 无 canvas 时完全禁用（不画也不占帧）。
 */

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

export class AmbientField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private motes: Mote[] = [];
  private ripples: Ripple[] = [];
  private raf = 0;
  private running = false;
  private reducedMotion = false;
  private lastRipple = 0;

  constructor(canvas: HTMLCanvasElement, reducedMotion = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.reducedMotion = reducedMotion;
    if (this.ctx && !reducedMotion) {
      this.spawn();
      this.resize();
      window.addEventListener("resize", this.resize);
      document.addEventListener("visibilitychange", this.handleVisibility);
      this.start();
    }
  }

  /** 设置页切换减弱动效时同步启停。 */
  setReducedMotion(reduced: boolean): void {
    if (reduced === this.reducedMotion) return;
    this.reducedMotion = reduced;
    if (reduced) this.stop();
    else if (this.ctx) {
      this.spawn();
      this.resize();
      this.start();
    }
  }

  /** 外部事件涟漪（如施法命中）——给氛围一层"声音可视化"。 */
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

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }

  private spawn(): void {
    const count = 36;
    this.motes = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      vy: 0.006 + Math.random() * 0.014,
      vx: (Math.random() - 0.5) * 0.006,
      phase: Math.random() * Math.PI * 2,
      hue: 28 + Math.random() * 24
    }));
  }

  private resize = (): void => {
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
    ctx.clearRect(0, 0, width, height);

    // 微尘：缓慢上浮 + 呼吸闪烁
    for (const mote of this.motes) {
      mote.y -= mote.vy / 60;
      mote.x += (mote.vx + Math.sin(t / 2400 + mote.phase) * 0.0004) / 1;
      if (mote.y < -0.02) {
        mote.y = 1.02;
        mote.x = Math.random();
      }
      if (mote.x < -0.02) mote.x = 1.02;
      if (mote.x > 1.02) mote.x = -0.02;
      const twinkle = 0.35 + 0.3 * Math.sin(t / 1300 + mote.phase * 3);
      ctx.beginPath();
      ctx.arc(mote.x * width, mote.y * height, mote.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${mote.hue}, 42%, 72%, ${Math.max(0.06, twinkle * 0.5)})`;
      ctx.fill();
    }

    // 声波涟漪：一圈圈淡出的圆环
    this.ripples = this.ripples.filter((ripple) => t - ripple.born < 1400);
    for (const ripple of this.ripples) {
      const age = (t - ripple.born) / 1400;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, age * 90, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(38, 60%, 70%, ${(1 - age) * 0.28})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    this.raf = requestAnimationFrame(this.frame);
  };
}
