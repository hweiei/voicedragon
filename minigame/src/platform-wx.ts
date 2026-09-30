/// <reference path="./wx.d.ts" />
/**
 * 微信小游戏平台实现。所有 wx.* 调用集中在这里，便于按官方文档升级。
 */
import { AD_UNITS, INTERSTITIAL_AFTER_RUNS, INTERSTITIAL_MIN_GAP_MS } from "./config";
import type { AdResult, AdSlot, ImageLike, Platform } from "./platform";

export function createWxPlatform(): Platform {
  // getWindowInfo 为新接口，老基础库回退 getSystemInfoSync（以官方文档为准）
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const dpr = Math.min(3, info.pixelRatio || 2);
  const canvas = wx.createCanvas(); // 首次创建的是上屏 canvas
  canvas.width = info.windowWidth * dpr;
  canvas.height = info.windowHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const images = new Map<string, WxMini.Image>();
  const audio = wx.createInnerAudioContext({ useWebAudioImplement: true });
  audio.onError(() => undefined);
  const recorder = wx.getRecorderManager();
  let onPcm: ((pcm: Float32Array, rate: number) => void) | null = null;
  const RATE = 16000;
  recorder.onFrameRecorded(({ frameBuffer }) => {
    if (!onPcm || !frameBuffer.byteLength) return;
    const i16 = new Int16Array(frameBuffer);
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
    onPcm(f32, RATE);
  });
  recorder.onError(() => {
    onPcm = null;
  });

  // 激励视频：每个广告位一个实例，提前 load
  const rewarded = new Map<AdSlot, WxMini.RewardedVideoAd>();
  for (const slot of ["extraCard", "revive"] as AdSlot[]) {
    const id = AD_UNITS[slot];
    if (!id) continue;
    try {
      const ad = wx.createRewardedVideoAd({ adUnitId: id });
      ad.onError(() => undefined);
      rewarded.set(slot, ad);
    } catch {
      /* 基础库过低等情况：视为无广告 */
    }
  }
  let interstitial: WxMini.InterstitialAd | null = null;
  if (AD_UNITS.interstitial) {
    try {
      interstitial = wx.createInterstitialAd({ adUnitId: AD_UNITS.interstitial });
      interstitial.onError(() => undefined);
    } catch {
      interstitial = null;
    }
  }
  let lastInterstitial = 0;
  let endedRuns = 0;

  // 转发：只开放普通分享菜单，不做任何分享奖励（避免诱导分享）
  try {
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
    wx.onShareAppMessage(() => ({ title: "声震龙楼 · 用粤语搞掂成条街" }));
  } catch {
    /* ignore */
  }

  return {
    name: "wx",
    width: info.windowWidth,
    height: info.windowHeight,
    safeTop: Math.max(info.safeArea?.top ?? 20, 20) + 30,
    ctx,
    loadImage(path: string): ImageLike {
      let img = images.get(path);
      if (!img) {
        img = wx.createImage();
        img.src = path;
        images.set(path, img);
      }
      return img;
    },
    onTouch(start, end) {
      wx.onTouchStart((e) => {
        const t = e.changedTouches[0];
        if (t) start(t.clientX, t.clientY);
      });
      const up = (e: WxMini.TouchEvent) => {
        const t = e.changedTouches[0];
        if (t) end(t.clientX, t.clientY);
      };
      wx.onTouchEnd(up);
      wx.onTouchCancel(up);
    },
    getItem(key) {
      try {
        const v = wx.getStorageSync(key);
        return typeof v === "string" && v ? v : null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        wx.setStorageSync(key, value);
      } catch {
        /* 存储满时静默 */
      }
    },
    playAudio(path, rate) {
      try {
        audio.stop();
        audio.src = path;
        audio.playbackRate = rate;
        audio.play();
        return true;
      } catch {
        return false;
      }
    },
    startRecord(cb) {
      return new Promise((resolve, reject) => {
        wx.authorize({
          scope: "scope.record",
          success: () => {
            onPcm = cb;
            // PCM + frameSize 才会触发 onFrameRecorded（以官方文档为准）
            recorder.start({
              duration: 10000,
              sampleRate: RATE,
              numberOfChannels: 1,
              format: "PCM",
              frameSize: 2
            });
            resolve();
          },
          fail: () => reject(new Error("no-record-permission"))
        });
      });
    },
    stopRecord() {
      onPcm = null;
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    },
    toast(msg) {
      wx.showToast({ title: msg.slice(0, 18), icon: "none", duration: 1600 });
    },
    confirm(title, content) {
      return new Promise((resolve) =>
        wx.showModal({ title, content, success: (r) => resolve(r.confirm) })
      );
    },
    adAvailable(slot) {
      return rewarded.has(slot);
    },
    showRewarded(slot): Promise<AdResult> {
      const ad = rewarded.get(slot);
      if (!ad) return Promise.resolve("unavailable");
      return new Promise((resolve) => {
        const onClose = (res?: { isEnded: boolean }) => {
          ad.offClose(onClose);
          // 基础库 < 2.1.0 时 res 为 undefined，视为看完（以官方文档为准）
          resolve(!res || res.isEnded ? "rewarded" : "skipped");
        };
        ad.onClose(onClose);
        ad.show().catch(() =>
          ad
            .load()
            .then(() => ad.show())
            .catch(() => {
              ad.offClose(onClose);
              resolve("unavailable");
            })
        );
      });
    },
    showInterstitial() {
      endedRuns += 1;
      const now = Date.now();
      if (!interstitial || endedRuns <= INTERSTITIAL_AFTER_RUNS) return;
      if (now - lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return;
      lastInterstitial = now;
      interstitial.show().catch(() => undefined);
    },
    now: () => Date.now()
  };
}
