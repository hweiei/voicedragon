/**
 * 平台能力适配器。微信/抖音方向已下线，本文件仅保留 Web 能力：
 * 平台标签、震动反馈、屏幕常亮（Wake Lock）。
 */

export type Platform = "web";

export function detectPlatform(): Platform {
  return "web";
}

export function getPlatformLabel(): string {
  return "网页试玩";
}

export function vibrate(kind: "light" | "heavy" = "light"): void {
  if (navigator.vibrate) navigator.vibrate(kind === "heavy" ? 45 : 18);
}

let wakeLock: { release(): Promise<void> } | null = null;

export async function setKeepScreenOn(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
    };
    if (nav.wakeLock && !wakeLock) {
      wakeLock = await nav.wakeLock.request("screen");
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void setKeepScreenOn();
      });
    }
  } catch {
    // Wake Lock 不可用时静默忽略（桌面浏览器常态）
  }
}
