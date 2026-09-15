const SAVE_KEY = "voice-tower-save-v2";
const SETTINGS_KEY = "voice-tower-settings-v1";
const SAVE_VERSION = 2;

function platformStorage() {
  const api = globalThis.wx || globalThis.tt;
  if (api?.setStorageSync && api?.getStorageSync) {
    return {
      set: (key, value) => api.setStorageSync(key, value),
      get: (key) => api.getStorageSync(key),
      remove: (key) => api.removeStorageSync?.(key)
    };
  }
  return {
    set: (key, value) => localStorage.setItem(key, value),
    get: (key) => localStorage.getItem(key),
    remove: (key) => localStorage.removeItem(key)
  };
}

export function saveGame(state) {
  try {
    const payload = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      state
    };
    platformStorage().set(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Unable to save game", error);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = platformStorage().get(SAVE_KEY);
    if (!raw) return null;
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!payload || payload.version !== SAVE_VERSION || !payload.state) {
      return null;
    }
    return payload;
  } catch (error) {
    console.warn("Unable to load game", error);
    return null;
  }
}

export function hasSave() {
  return Boolean(loadGame());
}

export function clearSave() {
  try {
    platformStorage().remove(SAVE_KEY);
  } catch (error) {
    console.warn("Unable to clear game save", error);
  }
}

export function loadSettings() {
  const defaults = { sound: true, reduceMotion: false, tutorialSeen: false };
  try {
    const raw = platformStorage().get(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  try {
    platformStorage().set(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Unable to save settings", error);
  }
}

export { SAVE_KEY, SAVE_VERSION };
