/**
 * P3 实时 F0 跟踪器（适配层）：pitchy McLeod 方法，2048 样本窗 / 512 步进。
 * 只吃 Float32 流，与识别链路并行不悖；产出帧序列交 core/tone 评分。
 * 约 10.7ms 一帧（48kHz 下 512 样本），练习场可按 60fps 直绘。
 */

import { PitchDetector } from "pitchy";
import type { PitchFrame } from "../../core/tone";

const WINDOW = 2048;
const HOP = 512;

export class PitchTracker {
  private detector = PitchDetector.forFloat32Array(WINDOW);
  private samples = new Float32Array(0);
  private sampleCount = 0;
  private nextWindowEnd = WINDOW;
  readonly frames: PitchFrame[] = [];
  private volume = 0;
  private sampleRate = 48000;

  /** 由采集器侧注入当前片段能量，落进帧里备用（能量门限扩展位）。 */
  noteVolume(rms: number): void {
    this.volume = rms;
  }

  push(chunk: Float32Array, sampleRate: number, onFrame?: (frame: PitchFrame) => void): void {
    this.sampleRate = sampleRate;
    const merged = new Float32Array(this.sampleCount + chunk.length);
    merged.set(this.samples.subarray(0, this.sampleCount), 0);
    merged.set(chunk, this.sampleCount);
    this.samples = merged;
    this.sampleCount += chunk.length;

    while (this.nextWindowEnd <= this.sampleCount) {
      const window = this.samples.subarray(this.nextWindowEnd - WINDOW, this.nextWindowEnd);
      const [freq, clarity] = this.detector.findPitch(window, sampleRate);
      const frame: PitchFrame = {
        t: (this.nextWindowEnd - WINDOW / 2) / sampleRate,
        freq: Number.isFinite(freq) ? freq : 0,
        clarity,
        rms: this.volume
      };
      this.frames.push(frame);
      onFrame?.(frame);
      this.nextWindowEnd += HOP;
    }
  }

  /** 整段时长（秒）。 */
  get duration(): number {
    return this.sampleCount / this.sampleRate;
  }
}
