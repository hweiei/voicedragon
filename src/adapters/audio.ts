/**
 * P5 音效与音乐适配器：Web Audio 实时合成（方案 §4.5「自生成」路线）。
 *
 * 设计：
 * - 零素材零下载：SFX 与 BGM 全部由振荡器/噪声实时合成——卡牌游戏音效短促，
 *   合成比下载音频更符合 PWA 离线与性能预算（偏离 Howler 选型：无需资产管理）；
 * - 自动播放合规：AudioContext 在首次用户手势时创建/恢复（unlock），未解锁前全部 no-op；
 * - 三档听感：音效（settings.sound）/ 背景音乐（settings.music）独立开关；
 * - BGM 为生成式五声音阶环境乐（宫调式），按局内相位切换情绪（标题/探索/战斗），
 *   lookahead 调度器驱动，切幕交叉淡出；
 * - 纯映射函数 sfxForEffect / bgmMoodForPhase 供单测与组合根复用。
 */

export type SfxName =
  | "hit"
  | "skill"
  | "guard"
  | "enemy"
  | "item"
  | "defeat"
  | "victory"
  | "treasure"
  | "star"
  | "click";

export type BgmMood = "title" | "explore" | "battle" | "none";

export interface AudioSettings {
  sound: boolean;
  music: boolean;
}

/** 引擎 emit 的 effect → 音效名（null = 不发声）。 */
export function sfxForEffect(effect: string | undefined): SfxName | null {
  switch (effect) {
    case "hit":
      return "hit";
    case "skill":
      return "skill";
    case "enemy":
      return "enemy";
    case "item":
      return "item";
    case "defeat":
      return "defeat";
    case "victory":
      return "victory";
    case "treasure":
      return "treasure";
    case "star":
      return "star";
    default:
      return null;
  }
}

/** 游戏相位 → BGM 情绪（标题/大厅 = title；局内非战斗 = explore）。 */
export function bgmMoodForPhase(phase: string): BgmMood {
  switch (phase) {
    case "battle":
      return "battle";
    case "title":
      return "title";
    case "tower":
    case "event":
    case "rest":
    case "shop":
    case "quiz":
    case "reward":
      return "explore";
    default:
      return "none"; // victory / defeat：只播结算音效，音乐留白
  }
}

/** 宫调五声音阶（C 大调宫系统，粤语南音的味道靠节奏与音色而非音阶外音）。 */
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

interface BgmPattern {
  /** 步进间隔（秒） */
  step: number;
  /** 每步触发音符的概率 */
  density: number;
  /** 音量 */
  gain: number;
  /** 低音鼓点（战斗情绪） */
  pulse: boolean;
  /** 音符音色（三角波柔和 / 锯齿紧张） */
  wave: OscillatorType;
}

const MOODS: Record<Exclude<BgmMood, "none">, BgmPattern> = {
  title: { step: 0.9, density: 0.45, gain: 0.1, pulse: false, wave: "triangle" },
  explore: { step: 0.66, density: 0.55, gain: 0.11, pulse: false, wave: "triangle" },
  battle: { step: 0.34, density: 0.62, gain: 0.12, pulse: true, wave: "sawtooth" }
};

export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private settings: AudioSettings = { sound: true, music: true };
  private unlocked = false;
  private noiseBuffer: AudioBuffer | null = null;

  // P6-F2 频谱分析（音频驱动氛围）：masterGain 旁路挂 AnalyserNode
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array | null = null;

  // BGM 调度状态
  private mood: BgmMood = "none";
  private nextStepAt = 0;
  private stepIndex = 0;
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private fadeNodes: GainNode[] = [];

  /** 组合根注入设置（init 与设置页保存时都会调用）。 */
  attachSettings(settings: AudioSettings): void {
    this.settings = { sound: settings.sound, music: settings.music };
    this.applyGains();
  }

  /** 首次用户手势解锁（自动播放策略合规）。幂等。 */
  unlock(): void {
    if (this.unlocked) return;
    try {
      if (!this.ctx) this.createContext();
      void this.ctx?.resume().then(() => {
        if (this.mood !== "none") this.startScheduler();
      });
      this.unlocked = true;
    } catch {
      // 无 Web Audio（极老浏览器）：静默降级，游戏不受影响
    }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * P6-F2：当前输出频谱能量（供粒子场做音频响应氛围）。
   * 未解锁 / 声音音乐全关 / 无 Web Audio 时返回 null——氛围层保持静态呼吸。
   * 数值归一化到 0..1（低/中/高三带）。
   */
  level(): { bass: number; mid: number; treble: number } | null {
    if (!this.analyser || !this.freqData || !this.unlocked) return null;
    if (!this.settings.sound && !this.settings.music) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    const band = (from: number, to: number): number => {
      let sum = 0;
      for (let i = from; i < to; i += 1) sum += this.freqData?.[i] ?? 0;
      return sum / ((to - from) * 255);
    };
    return { bass: band(1, 8), mid: band(8, 40), treble: band(40, 100) };
  }

  /** 播放一次性音效（未解锁/关音效时 no-op）。 */
  playSfx(name: SfxName): void {
    const ctx = this.readyContext();
    if (!ctx || !this.settings.sound || !this.sfxGain) return;
    const at = ctx.currentTime + 0.02;
    switch (name) {
      case "hit":
        this.thump(at, 130, 0.16, 0.5);
        this.noiseBurst(at, 0.06, 0.22, 2400);
        break;
      case "skill":
        this.blip(at, 523.25, 783.99, 0.14, 0.16, "triangle");
        break;
      case "guard":
        this.thump(at, 210, 0.1, 0.3);
        this.noiseBurst(at, 0.03, 0.1, 900);
        break;
      case "enemy":
        this.thump(at, 88, 0.2, 0.46);
        this.noiseBurst(at, 0.09, 0.2, 700);
        break;
      case "item":
        this.blip(at, 659.26, 987.77, 0.09, 0.14, "sine");
        break;
      case "defeat":
        this.gong(at, 311.13, 1.6, 0.4, "down");
        break;
      case "victory":
        this.fanfare(at);
        break;
      case "treasure":
        this.blip(at, 987.77, 1318.5, 0.08, 0.12, "sine");
        this.blip(at + 0.09, 1318.5, 1567.98, 0.09, 0.1, "sine");
        break;
      case "star":
        this.gong(at, 1046.5, 0.5, 0.2, "up");
        break;
      case "click":
        this.blip(at, 880, 660, 0.03, 0.06, "square");
        break;
    }
  }

  /** 切换 BGM 情绪（交叉淡出旧声部；"none" 停止）。幂等。 */
  setMood(mood: BgmMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    if (!this.readyContext() || !this.settings.music) return;
    this.fadeOutCurrent(0.9);
    if (mood === "none") {
      this.stopScheduler();
      return;
    }
    this.stepIndex = 0;
    this.nextStepAt = (this.ctx?.currentTime ?? 0) + 0.15;
    this.startScheduler();
  }

  /** 页面隐藏时挂起（省电；后台标签页不该出声）。 */
  handleVisibility(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else if (this.unlocked) void this.ctx.resume();
  }

  // ─── 内部：上下文与增益 ─────────────────────────────────────────────────────

  private createContext(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.9;
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.settings.sound ? 1 : 0;
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.settings.music ? 1 : 0;
    this.musicGain.connect(this.masterGain);
    // P6-F2：主增益旁路频谱分析（AnalyserNode 作为汇聚端，无需接 destination）
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.85;
    this.masterGain.connect(this.analyser);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    // 预生成 1s 白噪声缓冲（打击音色共用）
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  }

  private readyContext(): AudioContext | null {
    if (!this.unlocked) return null;
    return this.ctx?.state === "running" ? this.ctx : null;
  }

  private applyGains(): void {
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.settings.sound ? 1 : 0, this.ctx.currentTime, 0.05);
    }
    if (this.musicGain && this.ctx) {
      const target = this.settings.music ? 1 : 0;
      this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      if (this.settings.music && this.mood !== "none" && this.unlocked) this.startScheduler();
      if (!this.settings.music) this.stopScheduler();
    }
  }

  // ─── 内部：音色原语 ─────────────────────────────────────────────────────────

  /** 低频冲击（打击感主体）。 */
  private thump(at: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.4), at + dur);
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(env).connect(this.sfxGain!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** 噪声爆破（质感）。 */
  private noiseBurst(at: number, dur: number, gain: number, hz: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = hz;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(filter).connect(env).connect(this.sfxGain!);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  /** 双音上行/下行短闪（技能/物品/点击）。 */
  private blip(
    at: number,
    from: number,
    to: number,
    dur: number,
    gain: number,
    wave: OscillatorType
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(env).connect(this.sfxGain!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** 钟/锣（得分星辉、胜负）。 */
  private gong(at: number, freq: number, dur: number, gain: number, dir: "up" | "down"): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const partial = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    partial.type = "sine";
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(dir === "up" ? freq * 1.5 : freq * 0.5, at + dur);
    partial.frequency.setValueAtTime(freq * 2.01, at);
    partial.frequency.exponentialRampToValueAtTime(dir === "up" ? freq * 3.02 : freq, at + dur);
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    const partialEnv = ctx.createGain();
    partialEnv.gain.setValueAtTime(gain * 0.3, at);
    partialEnv.gain.exponentialRampToValueAtTime(0.001, at + dur * 0.6);
    osc.connect(env).connect(this.sfxGain!);
    partial.connect(partialEnv).connect(this.sfxGain!);
    osc.start(at);
    partial.start(at);
    osc.stop(at + dur + 0.05);
    partial.stop(at + dur + 0.05);
  }

  /** 胜利琶音（宫调五声上行）。 */
  private fanfare(at: number): void {
    const notes = [523.25, 587.33, 659.26, 783.99, 1046.5];
    notes.forEach((freq, index) => {
      this.blip(at + index * 0.11, freq, freq * 1.01, 0.22, 0.18, "triangle");
    });
    this.gong(at + notes.length * 0.11, 1046.5, 0.9, 0.22, "up");
  }

  // ─── 内部：生成式 BGM 调度 ─────────────────────────────────────────────────

  private startScheduler(): void {
    if (this.schedulerId !== null) return;
    this.schedulerId = setInterval(() => this.scheduleAhead(), 200);
  }

  private stopScheduler(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  /** lookahead：把未来 ~0.7s 的音符排进队列。 */
  private scheduleAhead(): void {
    const ctx = this.readyContext();
    if (!ctx || this.mood === "none" || !this.settings.music) return;
    const pattern = MOODS[this.mood];
    const horizon = ctx.currentTime + 0.7;
    while (this.nextStepAt < horizon) {
      const at = Math.max(this.nextStepAt, ctx.currentTime + 0.05);
      this.stepIndex += 1;
      // 相邻音级游走（避免跳跃感），偶尔休止
      if (Math.random() < pattern.density) {
        const drift = Math.floor(Math.random() * 3) - 1;
        const index = Math.max(0, Math.min(PENTATONIC.length - 1, this.lastNoteIndex + drift));
        this.lastNoteIndex = index;
        this.pluck(at, PENTATONIC[index], pattern);
      }
      if (pattern.pulse && this.stepIndex % 2 === 0) {
        this.kick(at);
      }
      this.nextStepAt += pattern.step * (0.92 + Math.random() * 0.16);
    }
  }

  private lastNoteIndex = 2;

  /** BGM 拨弦音色（接 musicGain）。 */
  private pluck(at: number, freq: number, pattern: BgmPattern): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const detuned = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = pattern.wave;
    detuned.type = pattern.wave;
    osc.frequency.value = freq;
    detuned.frequency.value = freq * 1.004;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(pattern.gain, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, at + pattern.step * 1.8);
    osc.connect(env);
    detuned.connect(env);
    env.connect(this.musicGain!);
    osc.start(at);
    detuned.start(at);
    osc.stop(at + pattern.step * 2);
    detuned.stop(at + pattern.step * 2);
    this.trackFade(env);
  }

  /** 战斗低音脉冲。 */
  private kick(at: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(98, at);
    osc.frequency.exponentialRampToValueAtTime(46, at + 0.16);
    env.gain.setValueAtTime(0.16, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    osc.connect(env).connect(this.musicGain!);
    osc.start(at);
    osc.stop(at + 0.2);
    this.trackFade(env);
  }

  /** 登记声部增益节点，切情绪时整体淡出。 */
  private trackFade(node: GainNode): void {
    this.fadeNodes.push(node);
    if (this.fadeNodes.length > 48) this.fadeNodes.splice(0, this.fadeNodes.length - 48);
  }

  private fadeOutCurrent(dur: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const node of this.fadeNodes) {
      try {
        node.gain.setTargetAtTime(0.0001, ctx.currentTime, dur / 3);
      } catch {
        // 节点已停止
      }
    }
    this.fadeNodes = [];
  }
}
