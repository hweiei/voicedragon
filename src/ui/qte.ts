/**
 * 无声 QTE「破阵拍」：没有麦克风 / 嘈杂环境 / 静音场合的施法方式。
 * 光标在能量尺上往返，甜区带随每次施法随机位置——按下「出手」越贴近甜区中心得分越高。
 * 与语音施法同源：产出 0-100 分直接进 resolveSkill，保证双通道平衡。
 *
 * score 映射（center 为甜区中心 · r = |hit-center| 归一化到 [0,1]）：
 *   r ≤ 0.05 → 90..100（正中）
 *   r ≤ 0.15 → 70..89
 *   r ≤ 0.30 → 45..69
 *   其余    → 20..44
 */

export function qteScore(ratio: number): number {
  const r = Math.max(0, Math.min(1, Math.abs(ratio)));
  if (r <= 0.05) return 90 + Math.round(((0.05 - r) / 0.05) * 10);
  if (r <= 0.15) return 70 + Math.round(((0.15 - r) / 0.1) * 20);
  if (r <= 0.3) return 45 + Math.round(((0.3 - r) / 0.15) * 25);
  return 20 + Math.round(((1 - r) / 0.7) * 25 - 1 > 0 ? ((1 - r) / 0.7) * 25 - 1 : 0);
}

export interface QteOptions {
  /** 往返速度（每秒几个完整来回） */
  cyclesPerSecond?: number;
  /** 甜区半宽（0..1） */
  zoneHalfWidth?: number;
  random?: () => number;
  onResolve(score: number, ratio: number): void;
  onCancel?(): void;
}

export class VocalQte {
  private host: HTMLElement;
  private options: Required<QteOptions>;
  private raf = 0;
  private startTime = 0;
  private center: number;
  private position = 0;
  private cursorEl: HTMLElement | null = null;
  private resolved = false;

  constructor(host: HTMLElement, options: QteOptions) {
    this.host = host;
    this.center = 0.2 + (options.random ?? Math.random)() * 0.6;
    this.options = {
      cyclesPerSecond: options.cyclesPerSecond ?? 0.62,
      zoneHalfWidth: options.zoneHalfWidth ?? 0.05,
      random: options.random ?? Math.random,
      onResolve: options.onResolve,
      onCancel: options.onCancel ?? (() => undefined)
    };
  }

  mount(): void {
    const zoneLeft = (this.center - this.options.zoneHalfWidth) * 100;
    const zoneWidth = this.options.zoneHalfWidth * 2 * 100;
    this.host.innerHTML = `
      <div class="qte-stage">
        <div class="qte-bar" role="img" aria-label="能量尺：按停光标于金色甜区">
          <div class="qte-zone" style="left:${zoneLeft}%;width:${zoneWidth}%"></div>
          <div class="qte-cursor" id="qte-cursor"></div>
        </div>
        <p class="qte-hint">光标掠过金色甜区时按下「出手」，越居中分越高</p>
        <button class="primary-button full-button" type="button" id="qte-strike">出手！</button>
      </div>`;
    this.cursorEl = this.host.querySelector("#qte-cursor");
    this.host.querySelector("#qte-strike")?.addEventListener("click", () => this.strike());
    this.startTime = performance.now();
    this.tick();
  }

  private tick = (): void => {
    if (this.resolved) return;
    const elapsed = (performance.now() - this.startTime) / 1000;
    const t = elapsed * this.options.cyclesPerSecond;
    // 往返（锯齿 → 三角波）[0,1]
    const phase = t % 1;
    this.position = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    if (this.cursorEl) this.cursorEl.style.left = `${this.position * 100}%`;
    this.raf = requestAnimationFrame(this.tick);
  };

  strike(): void {
    if (this.resolved) return;
    this.resolved = true;
    cancelAnimationFrame(this.raf);
    const ratio = Math.abs(this.position - this.center);
    this.options.onResolve(qteScore(ratio), ratio);
  }

  dispose(): void {
    if (!this.resolved) this.options.onCancel();
    this.resolved = true;
    cancelAnimationFrame(this.raf);
  }
}
