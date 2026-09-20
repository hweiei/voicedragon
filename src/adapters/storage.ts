/**
 * 存档适配器（StoragePort 的 localStorage 实现）。
 * 与原版键名/版本完全兼容：voice-tower-save-v2 / SAVE_VERSION 2。
 * 后续 P2 起在此文件追加 migrations（v2→v3 迁移链，见 REDESIGN-PLAN §9）。
 */

import {
  CHALLENGE_RECORD_LIMIT,
  type ChallengeRecord,
  compareChallengeRecords
} from "../core/challenge";
import { SCORING_WEIGHTS_V2 } from "../core/config/balance";
import type { DailyRecord } from "../core/daily";
import { compareDailyRecords } from "../core/daily";
import type { GameState } from "../core/engine";
import { emptyProfile } from "../core/profile";
import type { ProfileStore } from "../core/profile";
import { emptySrsStore, normalizeLearningHistory, normalizeToneMastery } from "../core/srs";
import type { SrsStore } from "../core/srs";
import type { VoiceMode } from "./voice";

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
  /** P5 背景音乐（生成式五声音阶环境乐；音效开关沿用 sound） */
  music?: boolean;
  reduceMotion: boolean;
  tutorialSeen: boolean;
  /** 语音引擎选择（P1 起）：auto=自动降级链 / sensevoice=端侧 / webspeech=在线 */
  voiceMode: VoiceMode;
  /** P3 声调权重（调准占比 0–0.8，默认 0.4 = 字 60% / 调 40%）。 */
  toneWeight?: number;
  /** P4 主题皮肤（默认 ink 墨色；成就点解锁其余） */
  theme?: string;
  /** P4 自适应难度（默认开；连胜微加难、连败微减压） */
  adaptiveEnabled?: boolean;
  /** P6-F3 特效强度：auto=按帧率自动降载（默认）；手动档固定覆盖 */
  fxIntensity?: "auto" | "full" | "balanced" | "eco";
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
  const defaults: GameSettings = {
    sound: true,
    music: true,
    reduceMotion: false,
    tutorialSeen: false,
    voiceMode: "auto",
    toneWeight: SCORING_WEIGHTS_V2.tone,
    theme: "ink",
    adaptiveEnabled: true,
    fxIntensity: "auto"
  };
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

// ─── 战役元存档（P2 单幕 → P5 按幕）：每幕的地图种子 / 节点★最高纪录 / Boss 通关标记 ──
// 键名沿用 v1（voice-tower-campaign-meta-v1），内容升级为 { version: 2, acts: {...} }；
// 旧单幕结构 { act, mapSeed, stars } 首读自动迁移，不丢历史星辉。

const CAMPAIGN_META_KEY = "voice-tower-campaign-meta-v1";

export interface CampaignActMeta {
  mapSeed: number;
  /** nodeId → 历史最高★（只升不降） */
  stars: Record<string, number>;
  /** 本幕 Boss 是否已通关（标题屏解锁下一幕的依据） */
  bossCleared: boolean;
}

export interface CampaignMeta {
  version: 2;
  /** 幕号（字符串键）→ 该幕元数据 */
  acts: Record<string, CampaignActMeta>;
  updatedAt: string;
}

interface LegacyCampaignMeta {
  act?: number;
  mapSeed?: number;
  stars?: Record<string, number>;
}

function migrateLegacy(raw: LegacyCampaignMeta): CampaignMeta | null {
  if (typeof raw.mapSeed !== "number" || !raw.stars) return null;
  return {
    version: 2,
    acts: {
      [String(raw.act ?? 1)]: { mapSeed: raw.mapSeed, stars: { ...raw.stars }, bossCleared: false }
    },
    updatedAt: ""
  };
}

export function loadCampaignMeta(): CampaignMeta | null {
  try {
    const raw = platformStorage().get(CAMPAIGN_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CampaignMeta> & Partial<LegacyCampaignMeta>;
    if (!parsed) return null;
    if (parsed.version === 2 && parsed.acts) {
      const acts: Record<string, CampaignActMeta> = {};
      for (const [key, entry] of Object.entries(parsed.acts)) {
        if (!entry || typeof entry.mapSeed !== "number" || !entry.stars) continue;
        acts[key] = {
          mapSeed: entry.mapSeed,
          stars: { ...entry.stars },
          bossCleared: Boolean(entry.bossCleared)
        };
      }
      return { version: 2, acts, updatedAt: parsed.updatedAt ?? "" };
    }
    return migrateLegacy(parsed as LegacyCampaignMeta);
  } catch {
    return null;
  }
}

export function saveCampaignMeta(meta: CampaignMeta): void {
  try {
    platformStorage().set(CAMPAIGN_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.warn("Unable to save campaign meta", error);
  }
}

// ─── P3 学习闭环：错词本（SRS）与每日挑战战绩 ─────────────────────────────────

const SRS_KEY = "voice-tower-srs-v1";
const DAILY_KEY = "voice-tower-daily-v1";

export function loadSrsStore(): SrsStore {
  try {
    const raw = platformStorage().get(SRS_KEY);
    if (!raw) return emptySrsStore();
    const parsed = JSON.parse(raw) as Partial<SrsStore>;
    const base = emptySrsStore();
    const stats = { ...base.stats, ...(parsed.stats ?? {}) };
    stats.toneMastery = normalizeToneMastery(parsed.stats?.toneMastery);
    return {
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
      stats,
      history: normalizeLearningHistory(parsed.history)
    };
  } catch {
    return emptySrsStore();
  }
}

export function saveSrsStore(store: SrsStore): void {
  try {
    platformStorage().set(SRS_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn("Unable to save srs store", error);
  }
}

export function loadDailyRecords(ruleset: "legacy" | "p7" = "legacy"): Record<string, DailyRecord> {
  try {
    const raw = platformStorage().get(ruleset === "p7" ? `${DAILY_KEY}-p7` : DAILY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DailyRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDailyRecord(record: DailyRecord): void {
  try {
    const records = loadDailyRecords(record.ruleset);
    const existing = records[record.dateKey];
    if (!existing || compareDailyRecords(record, existing) > 0) {
      records[record.dateKey] = record;
      platformStorage().set(
        record.ruleset === "p7" ? `${DAILY_KEY}-p7` : DAILY_KEY,
        JSON.stringify(records)
      );
    }
  } catch (error) {
    console.warn("Unable to save daily record", error);
  }
}

// ─── P12 切磋码战绩簿：本机同码最佳（无云端、无排行榜，凭码自证） ──────────────

const CHALLENGE_KEY = "voice-tower-challenge-v1";

/** 战绩簿读取：按完成时间倒序（新纪录在前），最多 CHALLENGE_RECORD_LIMIT 条。 */
export function loadChallengeRecords(): ChallengeRecord[] {
  try {
    const raw = platformStorage().get(CHALLENGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, ChallengeRecord>;
    if (!parsed || typeof parsed !== "object") return [];
    return Object.values(parsed)
      .filter(
        (record) => record && typeof record.hash === "string" && typeof record.code === "string"
      )
      .sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1));
  } catch {
    return [];
  }
}

/**
 * 战绩簿写入：同一码只保留更优者（比较器与每日挑战一致）；
 * 超过上限按完成时间淘汰最旧的一条。返回是否发生写入。
 */
export function saveChallengeRecord(record: ChallengeRecord): boolean {
  try {
    const records = loadChallengeRecords();
    const key = record.hash;
    const existing = records.find((entry) => entry.hash === key);
    if (existing && compareChallengeRecords(record, existing) <= 0) return false;
    const next = records.filter((entry) => entry.hash !== key);
    next.unshift(record);
    const trimmed = next
      .sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1))
      .slice(0, CHALLENGE_RECORD_LIMIT);
    const payload: Record<string, ChallengeRecord> = {};
    for (const entry of trimmed) payload[entry.hash] = entry;
    platformStorage().set(CHALLENGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Unable to save challenge record", error);
    return false;
  }
}

// ─── P4 玩家档案：跨局统计 / 成就 / 图鉴 / 无尽最佳 / 自适应节律 ───────────────

const PROFILE_KEY = "voice-tower-profile-v1";

export function loadProfile(): ProfileStore {
  try {
    const raw = platformStorage().get(PROFILE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<ProfileStore>;
    const base = emptyProfile();
    return {
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      codex: {
        skills: parsed.codex?.skills ?? [],
        enemies: parsed.codex?.enemies ?? [],
        relics: parsed.codex?.relics ?? [],
        items: parsed.codex?.items ?? [],
        events: parsed.codex?.events ?? []
      }
    };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile: ProfileStore): void {
  try {
    platformStorage().set(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Unable to save profile", error);
  }
}
