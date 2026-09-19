/**
 * 兼容壳（P6-F2）：AmbientField → ParticleField。
 * main.ts 已迁移到 src/ui/fx/particles/field.ts 的 ParticleField；
 * 本壳保留一版以防外部引用，签名与 P5 完全一致。
 *
 * @deprecated 请直接使用 `ParticleField`（支持三幕主题 / 爆发粒子 / 音频响应）。
 */

import { ACT_THEMES, ParticleField } from "./fx/particles/field";

export class AmbientField extends ParticleField {
  constructor(canvas: HTMLCanvasElement, reducedMotion = false) {
    super(canvas, { reducedMotion, theme: ACT_THEMES.act1 });
  }
}
