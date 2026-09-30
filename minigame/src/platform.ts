/**
 * 平台抽象：游戏逻辑只依赖这个接口。
 * - platform-wx.ts：真机 / 微信开发者工具
 * - platform-web.ts：浏览器预览（开发自测、Playwright 截图）
 */
export interface ImageLike {
  width: number;
  height: number;
}

export type AdResult = "rewarded" | "skipped" | "unavailable";

export interface Platform {
  readonly name: "wx" | "web";
  width: number;
  height: number;
  /** 顶部安全区（刘海 / 胶囊按钮下沿） */
  safeTop: number;
  ctx: CanvasRenderingContext2D;
  loadImage(path: string): ImageLike;
  /** 预载分包资源（wx 才有；web 端资源同源直接可用） */
  loadRes?(name: string): void;
  onTouch(start: (x: number, y: number) => void, end: (x: number, y: number) => void): void;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** 播放包内音频；返回 false 表示无此文件 / 播放失败 */
  playAudio(path: string, rate: number): boolean;
  /** 开始录音，按帧回调 Float32 PCM；reject = 无权限 */
  startRecord(onPcm: (pcm: Float32Array, sampleRate: number) => void): Promise<void>;
  stopRecord(): void;
  toast(msg: string): void;
  confirm(title: string, content: string): Promise<boolean>;
  /** 激励视频：只有看完才返回 rewarded */
  showRewarded(slot: AdSlot): Promise<AdResult>;
  showInterstitial(): void;
  adAvailable(slot: AdSlot): boolean;
  now(): number;
}

export type AdSlot = "extraCard" | "revive";
