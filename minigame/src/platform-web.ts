/**
 * 浏览器预览平台：同一套游戏代码在网页 canvas 上跑，方便自测与截图。
 * ?ads=sim 时用 1.5 秒的「模拟广告」测试激励流程；默认无广告。
 */
import type { AdResult, ImageLike, Platform } from "./platform";

export function createWebPlatform(canvas: HTMLCanvasElement, assetBase: string): Platform {
  const W = Math.min(window.innerWidth, 480);
  const H = window.innerHeight;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  const images = new Map<string, HTMLImageElement>();
  const audio = new Audio();
  const simAds = new URLSearchParams(location.search).get("ads") === "sim";
  let rec: { ctx: AudioContext; stream: MediaStream; node: ScriptProcessorNode } | null = null;
  let bgmCtx: AudioContext | null = null;

  const toastEl = document.createElement("div");
  toastEl.id = "toast";
  document.body.appendChild(toastEl);
  let toastTimer = 0;

  return {
    name: "web",
    width: W,
    height: H,
    safeTop: 12,
    ctx,
    loadImage(path: string): ImageLike {
      let img = images.get(path);
      if (!img) {
        img = new Image();
        img.src = assetBase + path;
        images.set(path, img);
      }
      return img.complete && img.naturalWidth ? img : { width: 0, height: 0 };
    },
    onTouch(start, end) {
      const pos = (e: PointerEvent): [number, number] => {
        const r = canvas.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      };
      canvas.addEventListener("pointerdown", (e) => start(...pos(e)));
      canvas.addEventListener("pointerup", (e) => end(...pos(e)));
      canvas.addEventListener("pointercancel", (e) => end(...pos(e)));
    },
    getItem: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    },
    webAudioCtx() {
      try {
        bgmCtx = bgmCtx ?? new AudioContext();
        return bgmCtx;
      } catch {
        return undefined;
      }
    },
    playAudio(path, rate) {
      audio.src = assetBase + path;
      audio.playbackRate = rate;
      audio.play().catch(() => undefined);
      return true;
    },
    async startRecord(cb) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const actx = new AudioContext();
      const node = actx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) =>
        cb(new Float32Array(e.inputBuffer.getChannelData(0)), actx.sampleRate);
      actx.createMediaStreamSource(stream).connect(node);
      node.connect(actx.destination);
      rec = { ctx: actx, stream, node };
    },
    stopRecord() {
      if (!rec) return;
      rec.node.disconnect();
      for (const t of rec.stream.getTracks()) t.stop();
      rec.ctx.close().catch(() => undefined);
      rec = null;
    },
    toast(msg) {
      toastEl.textContent = msg;
      toastEl.className = "on";
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        toastEl.className = "";
      }, 1600);
    },
    confirm: (title, content) => Promise.resolve(window.confirm(`${title}\n${content}`)),
    adAvailable: () => simAds,
    showRewarded(): Promise<AdResult> {
      if (!simAds) return Promise.resolve("unavailable");
      toastEl.textContent = "（模拟激励视频 1.5 秒）";
      toastEl.className = "on";
      return new Promise((r) => setTimeout(() => r("rewarded"), 1500));
    },
    showInterstitial() {
      /* 预览不出插屏 */
    },
    now: () => performance.now()
  };
}
