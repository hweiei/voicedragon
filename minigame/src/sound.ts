/**
 * 程序化配乐与音效：WebAudio 振荡器实时合成，零音频文件、不占包体积。
 * 微信小游戏走 wx.createWebAudioContext()（基础库 ≥2.19.0 起支持，以官方文档为准），
 * 浏览器走 AudioContext。任何一步失败都整体静默降级，绝不影响游戏。
 */
export type SfxKind = "play" | "crit" | "win" | "lose";

export interface AudioCtx {
  currentTime: number;
  destination: unknown;
  state?: string;
  resume?: () => void;
  createGain(): GainNodeLite;
  createOscillator(): OscLite;
}
interface GainNodeLite {
  gain: AudioParamLite;
  connect(dest: unknown): void;
}
interface AudioParamLite {
  value: number;
  setValueAtTime(v: number, t: number): void;
  exponentialRampToValueAtTime(v: number, t: number): void;
}
interface OscLite {
  type: string;
  frequency: AudioParamLite;
  connect(dest: unknown): void;
  start(t: number): void;
  stop(t: number): void;
}

/** A 小调五声音阶，plink 音色天然粤味（跟广东工尺谱的骨干音接近） */
const PENTA = [220, 246.94, 293.66, 329.63, 392, 440, 587.33, 659.25];
const CHORDS = [
  [110, 164.81],
  [87.31, 130.81],
  [130.81, 196],
  [98, 146.83]
];

/** 每 tick（0.5s）该弹哪几个音；纯函数便于测试，伪随机但 64 拍一循环不闷 */
export function musicPlan(tick: number): number[] {
  const t = ((tick % 64) + 64) % 64;
  const seed = (t * 2654435761) >>> 0;
  const notes: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = (seed >>> (i * 7)) & 7;
    if (i === 0 || r % 3 !== 0) notes.push(PENTA[(r + t) % PENTA.length]);
  }
  return notes;
}

export interface SoundCtl {
  sfx(kind: SfxKind): void;
  setMuted(muted: boolean): void;
  /** 首个用户手势后调用：解锁被挂起的 AudioContext（自动播放策略） */
  unlock(): void;
  destroy(): void;
}

export function createSound(makeCtx: () => AudioCtx | null, tickMs = 500): SoundCtl {
  let ctx: AudioCtx | null = null;
  let master: GainNodeLite | null = null;
  let muted = false;
  let tick = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const safe = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* 环境不支持就整体静音 */
    }
  };
  const init = () => {
    if (timer || ctx) return;
    const c = makeCtx();
    if (!c) return;
    ctx = c;
    safe(() => {
      const m = c.createGain();
      m.gain.value = 0.6;
      m.connect(c.destination);
      master = m;
    });
    timer = setInterval(step, tickMs);
  };
  const tone = (freq: number, delay: number, dur: number, vol: number, type = "triangle") => {
    const c = ctx;
    const m = master;
    if (!c || !m) return;
    safe(() => {
      const t0 = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(m);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    });
  };
  const step = () => {
    if (!ctx || muted) {
      tick = (tick + 1) % 64;
      return;
    }
    for (const f of musicPlan(tick)) tone(f, 0.05, 0.9, 0.05);
    if (tick % 8 === 0)
      for (const f of CHORDS[(tick / 8) % CHORDS.length]) tone(f, 0.05, 2.2, 0.03, "sine");
    tick = (tick + 1) % 64;
  };
  init();
  return {
    sfx(kind) {
      if (!ctx || muted) return;
      if (kind === "play") tone(523.25, 0, 0.09, 0.14, "square");
      else if (kind === "crit")
        [659.25, 880, 1174.66].forEach((f, i) => tone(f, i * 0.06, 0.14, 0.16, "square"));
      else if (kind === "win")
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.4, 0.12));
      else [392, 311.13, 261.63].forEach((f, i) => tone(f, i * 0.16, 0.3, 0.1, "sawtooth"));
    },
    setMuted(m) {
      muted = m;
    },
    unlock() {
      if (!ctx) init();
      safe(() => ctx?.state === "suspended" && ctx.resume?.());
    },
    destroy() {
      if (timer) clearInterval(timer);
      timer = null;
    }
  };
}
