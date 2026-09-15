export function detectPlatform() {
  if (globalThis.wx?.getSystemInfoSync) return "wechat";
  if (globalThis.tt?.getSystemInfoSync) return "douyin";
  return "web";
}

export function getPlatformLabel(platform = detectPlatform()) {
  if (platform === "wechat") return "微信小游戏";
  if (platform === "douyin") return "抖音小游戏";
  return "网页试玩";
}

export function vibrate(kind = "light") {
  const api = globalThis.wx || globalThis.tt;
  if (api?.vibrateShort) {
    api.vibrateShort({ type: kind });
    return;
  }
  if (navigator.vibrate) navigator.vibrate(kind === "heavy" ? 45 : 18);
}

export function setKeepScreenOn() {
  const api = globalThis.wx || globalThis.tt;
  api?.setKeepScreenOn?.({ keepScreenOn: true });
}
