/**
 * 本项目实际用到的微信小游戏 API 最小类型声明（只声明用到的字段）。
 * 字段以官方文档为准：https://developers.weixin.qq.com/minigame/dev/api/
 */
declare namespace WxMini {
  interface Touch {
    identifier: number;
    clientX: number;
    clientY: number;
  }
  interface TouchEvent {
    touches: Touch[];
    changedTouches: Touch[];
  }
  interface Image {
    src: string;
    width: number;
    height: number;
    onload: (() => void) | null;
    onerror: (() => void) | null;
  }
  interface Canvas {
    width: number;
    height: number;
    getContext(type: "2d"): CanvasRenderingContext2D;
  }
  interface WindowInfo {
    windowWidth: number;
    windowHeight: number;
    pixelRatio: number;
    safeArea?: { top: number; bottom: number; left: number; right: number };
  }
  interface InnerAudioContext {
    src: string;
    playbackRate: number;
    play(): void;
    stop(): void;
    destroy(): void;
    onError(cb: (e: { errMsg: string }) => void): void;
  }
  interface RecorderManager {
    start(opts: {
      duration?: number;
      sampleRate?: number;
      numberOfChannels?: number;
      encodeBitRate?: number;
      format?: "aac" | "mp3" | "PCM" | "wav";
      frameSize?: number;
    }): void;
    stop(): void;
    onFrameRecorded(cb: (res: { frameBuffer: ArrayBuffer; isLastFrame: boolean }) => void): void;
    onStop(cb: () => void): void;
    onError(cb: (e: { errMsg: string }) => void): void;
  }
  interface RewardedVideoAd {
    load(): Promise<void>;
    show(): Promise<void>;
    onLoad(cb: () => void): void;
    onError(cb: (e: { errMsg: string; errCode: number }) => void): void;
    onClose(cb: (res?: { isEnded: boolean }) => void): void;
    offClose(cb?: (res?: { isEnded: boolean }) => void): void;
  }
  interface InterstitialAd {
    load(): Promise<void>;
    show(): Promise<void>;
    onError(cb: (e: { errMsg: string; errCode: number }) => void): void;
    onClose(cb: () => void): void;
  }
  interface Wx {
    createCanvas(): Canvas;
    createImage(): Image;
    getWindowInfo?(): WindowInfo;
    getSystemInfoSync(): WindowInfo;
    onTouchStart(cb: (e: TouchEvent) => void): void;
    onTouchEnd(cb: (e: TouchEvent) => void): void;
    onTouchCancel(cb: (e: TouchEvent) => void): void;
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: string): void;
    removeStorageSync(key: string): void;
    createInnerAudioContext(opts?: { useWebAudioImplement?: boolean }): InnerAudioContext;
    getRecorderManager(): RecorderManager;
    authorize(opts: { scope: string; success?: () => void; fail?: () => void }): void;
    openSetting(opts?: { success?: () => void }): void;
    showToast(opts: { title: string; icon?: "none" | "success"; duration?: number }): void;
    showModal(opts: {
      title: string;
      content: string;
      confirmText?: string;
      cancelText?: string;
      showCancel?: boolean;
      success?: (res: { confirm: boolean }) => void;
    }): void;
    createRewardedVideoAd(opts: { adUnitId: string }): RewardedVideoAd;
    createInterstitialAd(opts: { adUnitId: string }): InterstitialAd;
    showShareMenu(opts: { menus: string[] }): void;
    onShareAppMessage(cb: () => { title: string; imageUrl?: string }): void;
    onShow(cb: () => void): void;
    onHide(cb: () => void): void;
  }
}
declare const wx: WxMini.Wx;
declare function requestAnimationFrame(cb: (t: number) => void): number;
