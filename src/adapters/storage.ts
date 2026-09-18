/**
 * 存档适配器（StoragePort 的 localStorage 实现）。
 * 与原版键名/版本完全兼容：voice-tower-save-v2 / SAVE_VERSION 2。
 * 后续 P2 起在此文件追加 migrations（v2→v3 迁移链，见 REDESIGN-PLAN §9）。
 */

import type { GameState } from "../core/engine";

export const SAVE_KEY = "voice-tower-save-v2";
const SETTINGS_KEY = "voice-tower-settings-v1";
export const SAVE_VERSION = 2;

export interface SavePayload {
  version: number;
  savedAt: string;
  state: GameState;
}

export interface GameSettings {
  sound: boolean;
  reduceMotion: boolean;
  tutorialSeen: boolean;
}

interface KVStore {
  set(key: string, value: string): void;
  get(key: string): string | null;
  remove(key: string): void;
}

function platformStorage(): KVStore {
  return {
    set: (key, value) => localStorage.setItem(key, value),
    get: (key) => localStorage.getItem(key),
    remove: (key) => localStorage.removeItem(key)
  };
}

export function saveGame(state: GameState): boolean {
  try {
    const payload: SavePayload = {
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

export function loadGame(): SavePayload | null {
  try {
    const raw = platformStorage().get(SAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as Partial<SavePayload>;
    if (!payload || payload.version !== SAVE_VERSION || !payload.state) {
      return null;
    }
    return payload as SavePayload;
  } catch (error) {
    console.warn("Unable to load game", error);
    return null;
  }
}

export function hasSave(): boolean {
  return Boolean(loadGame());
}

export function clearSave(): void {
  try {
    platformStorage().remove(SAVE_KEY);
  } catch (error) {
    console.warn("Unable to clear game save", error);
  }
}

export function loadSettings(): GameSettings {
  const defaults: GameSettings = { sound: true, reduceMotion: false, tutorialSeen: false };
  try {
    const raw = platformStorage().get(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    platformStorage().set(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Unable to save settings", error);
  }
}
