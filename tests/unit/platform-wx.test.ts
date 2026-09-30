/** platform-wx：wx 全局 mock 下的纯行为面（不触真机 API） */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../minigame/src/config", async (importOriginal) => {
  const m = (await (importOriginal as () => Promise<Record<string, unknown>>))();
  return { ...m, AD_UNITS: { extraCard: "adunit-x1", revive: "adunit-x2", interstitial: "" } };
});

type Task = {
  onSuccess: (f: () => void) => void;
  onFail: (f: (e: { errMsg: string }) => void) => void;
};
let listeners: Record<string, unknown[]>;
function fakeWx() {
  listeners = {};
  const on = (k: string) => (f: (e?: unknown) => void) => {
    if (!listeners[k]) listeners[k] = [];
    listeners[k].push(f);
  };
  return {
    getWindowInfo: () => ({
      windowWidth: 390,
      windowHeight: 844,
      pixelRatio: 3,
      safeArea: { top: 47 }
    }),
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2 }),
    createCanvas: () => ({
      width: 0,
      height: 0,
      getContext: () =>
        new Proxy({}, { get: (t, k) => (k === "scale" ? vi.fn() : () => undefined) })
    }),
    loadSubpackage: ({ name }: { name: string }): Task => {
      const cur = subs.get(name) ?? { ok: [], fail: [] };
      subs.set(name, cur);
      const ok = cur.ok;
      const fail = cur.fail;
      return { onSuccess: (f) => ok.push(f), onFail: (f) => fail.push(f) };
    },
    createInnerAudioContext: () => ({
      src: "",
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onError: on("audioErr"),
      onEnded: on("audioEnd")
    }),
    getRecorderManager: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      onFrameRecorded: on("frame"),
      onError: on("recErr"),
      onStart: on("recStart"),
      onStop: on("recStop")
    }),
    createRewardedVideoAd: ({ adUnitId }: { adUnitId: string }) => ({
      adUnitId,
      load: () => Promise.resolve(),
      offClose: on("adOff"),
      show: () => (adUnitId === "bad" ? Promise.reject(new Error("no fill")) : Promise.resolve()),
      onClose: on("adClose"),
      onError: on("adErr")
    }),
    createInterstitialAd: () => ({
      load: () => Promise.resolve(),
      show: () => Promise.resolve(),
      onClose: on("iClose"),
      onError: on("iErr")
    }),
    showToast: vi.fn(),
    vibrateShort: vi.fn(),
    getStorageSync: (k: string) => store[k] ?? "",
    setStorageSync: (k: string, v: string) => {
      store[k] = v;
    },
    getGameClubButton: undefined
  };
}
const subs = new Map<string, { ok: (() => void)[]; fail: ((e: { errMsg: string }) => void)[] }>();
let store: Record<string, string>;
type P = ReturnType<typeof import("../../minigame/src/platform-wx").createWxPlatform>;
let p!: P;
async function load(): Promise<{ createWxPlatform: () => P }> {
  return import("../../minigame/src/platform-wx");
}

beforeEach(async () => {
  store = {};
  vi.resetModules();
  (globalThis as Record<string, unknown>).wx = fakeWx();
  const m = await load();
  p = m.createWxPlatform();
});
afterEach(() => {
  (globalThis as Record<string, unknown>).wx = undefined;
});

describe("wx platform", () => {
  it("dpr 钳制 ≤3 且 safeTop 取 safeArea.top", () => {
    expect(p.safeTop).toBe(77); // safeArea.top 47 + 状态栏补偿 30
  });
  it("storage JSON 往返 + 空串视为无档", () => {
    p.setItem("k", JSON.stringify({ a: 1 }));
    expect(JSON.parse(p.getItem("k") ?? "{}").a).toBe(1);
    expect(p.getItem("nope")).toBeNull();
  });
  it("loadRes 触发 wx.loadSubpackage 且就绪后不重复触发", async () => {
    p.loadRes?.("res6");
    await vi.waitFor(() => expect(subs.has("res6")).toBe(true));
    for (const f of subs.get("res6")!.ok) f();
    await vi.waitFor(() => expect(subs.get("res6")!.ok.length).toBe(1));
    p.loadRes?.("res6"); // 已 ready：不再新建任务
    expect(subs.get("res6")!.ok.length).toBe(1);
  });
  it("loadRes 失败后清缓存供下次重试", async () => {
    p.loadRes?.("res4");
    await vi.waitFor(() => expect(subs.has("res4")).toBe(true));
    for (const f of subs.get("res4")!.fail) f({ errMsg: "net" });
    await Promise.resolve();
    p.loadRes?.("res4"); // 失败清缓存后重试：重新建 wx 任务（同一 name 第二次注册）
    await vi.waitFor(() => expect(subs.get("res4")!.ok.length).toBe(2));
  });
  it("showRewarded：看完 rewarded、中途关 skipped、无广告位 unavailable", async () => {
    const pr = p.showRewarded("extraCard");
    await vi.waitFor(() => expect(listeners.adClose?.length).toBeGreaterThan(0));
    for (const f of listeners.adClose as ((e: { isEnded: boolean }) => void)[])
      f({ isEnded: true });
    await expect(pr).resolves.toBe("rewarded");
    const pr2 = p.showRewarded("extraCard");
    await vi.waitFor(() =>
      expect(((listeners.adClose ?? []) as unknown[]).length).toBeGreaterThan(1)
    );
    const fns = listeners.adClose as ((e: { isEnded: boolean }) => void)[];
    fns[fns.length - 1]?.({ isEnded: false });
    await expect(pr2).resolves.toBe("skipped");
  });
  it("toast 冒烟", () => {
    p.toast("你好");
    expect(
      (globalThis as never as { wx: { showToast: ReturnType<typeof vi.fn> } }).wx.showToast
    ).toHaveBeenCalledWith(expect.objectContaining({ title: "你好" }));
  });
});
