/**
 * 应用入口：组装内核 + 适配器 + 渲染层（组合根）。
 * 语音编排：按 settings.voiceMode 构造适配器；模型缓存探测走 model-store；
 * 设置页事件（引擎切换/下载模型/清除缓存）经 VoiceServices 注入 UI。
 */

import "./ui/styles.css";
import { setKeepScreenOn } from "./adapters/platform";
import {
  loadCampaignMeta,
  loadProfile,
  loadSettings,
  saveCampaignMeta,
  saveGame,
  saveSettings
} from "./adapters/storage";
import { SpeechTts } from "./adapters/tts";
import { createVoiceAdapter } from "./adapters/voice";
import type { VoiceAdapter, VoiceMode } from "./adapters/voice";
import type { SenseVoiceAdapter } from "./adapters/voice/sensevoice/adapter";
import {
  clearModel,
  downloadModel,
  getModelStatus,
  isModelReady
} from "./adapters/voice/sensevoice/model-store";
import type { DownloadProgress } from "./adapters/voice/sensevoice/model-store";
import { SCORING_WEIGHTS_V2 } from "./core/config/balance";
import { GameEngine } from "./core/engine";
import type { EmitOptions, GameState } from "./core/engine";
import { adaptiveBoostFor } from "./core/profile";
import { GameUI } from "./ui/ui";
import type { VoiceServices } from "./ui/ui";

const settings = loadSettings();
document.body.classList.toggle("reduce-motion", settings.reduceMotion);
// P4 主题皮肤：data-theme 由设置档驱动（ink 为根变量默认，无需覆盖）
document.body.dataset.theme = settings.theme ?? "ink";

const engine = new GameEngine();
const tts = new SpeechTts();

// P4 自适应难度注入：连胜略加难 / 连败略减压（设置页可关），随每局开局采样
engine.adaptiveProvider = () =>
  settings.adaptiveEnabled !== false ? adaptiveBoostFor(loadProfile().stats.adaptiveStreak) : 0;

// ─── P2 战役元存档：同一幕的节点★最高纪录跨局累计 ─────────────────────────────

/** 开新战役时，把本地同种子同幕的历史★注入新局（重打刷新只升不降）。 */
const startCampaignBase = engine.startCampaign.bind(engine);
engine.startCampaign = (act = 1, seed?: number) => {
  const meta = loadCampaignMeta();
  const resolvedSeed = seed ?? meta?.mapSeed;
  startCampaignBase(act, resolvedSeed);
  const campaign = engine.state.campaign;
  if (campaign && meta && meta.act === campaign.act && meta.mapSeed === campaign.map.seed) {
    Object.assign(campaign.stars, meta.stars);
  }
};

/** 每次状态广播都把战役★同步进元存档（含败北——星辉不随倒下丢失）。 */
function syncCampaignMeta(state: GameState): void {
  const campaign = state.campaign;
  if (!campaign) return;
  saveCampaignMeta({
    act: campaign.act,
    mapSeed: campaign.map.seed,
    stars: { ...campaign.stars },
    updatedAt: new Date().toISOString()
  });
}

// ─── 语音编排 ────────────────────────────────────────────────────────────────

let voiceAdapter: VoiceAdapter;
const modelListeners = new Set<(progress: DownloadProgress | null) => void>();

async function buildAdapter(mode: VoiceMode): Promise<VoiceAdapter> {
  const modelCached = await isModelReady().catch(() => false);
  return createVoiceAdapter(
    mode,
    { modelCached },
    {
      toneWeight: () => settings.toneWeight ?? SCORING_WEIGHTS_V2.tone
    }
  );
}

const voiceServices: VoiceServices = {
  tts: {
    speak: (text) => tts.speak(text),
    stop: () => tts.stop()
  },
  settings: {
    get: () => settings,
    save: (next) => {
      Object.assign(settings, next);
      saveSettings(settings);
      document.body.classList.toggle("reduce-motion", settings.reduceMotion);
    }
  },
  model: {
    getStatus: () => getModelStatus(),
    async download() {
      await downloadModel({
        onProgress: (progress) => {
          for (const listener of modelListeners) listener(progress);
        }
      });
      const senseAdapter = voiceAdapter as Partial<SenseVoiceAdapter>;
      senseAdapter.markModelReady?.();
      for (const listener of modelListeners) listener(null);
    },
    async clear() {
      await clearModel();
      for (const listener of modelListeners) listener(null);
    },
    onProgress(listener) {
      modelListeners.add(listener);
      return () => modelListeners.delete(listener);
    }
  },
  async setVoiceMode(mode) {
    voiceServices.settings.save({ voiceMode: mode });
    voiceAdapter = await buildAdapter(mode);
    ui.setVoiceAdapter(voiceAdapter);
    return voiceAdapter.id;
  }
};

// ─── 启动 ────────────────────────────────────────────────────────────────────

const ui = new GameUI({
  engine,
  voiceAdapter: undefined as unknown as VoiceAdapter,
  services: voiceServices
});

engine.subscribe((state: GameState, options: EmitOptions) => {
  syncCampaignMeta(state);
  if (options.save && state.phase !== "title") saveGame(state);
  ui.render(state, options);
});

void setKeepScreenOn();

void buildAdapter(settings.voiceMode).then((adapter) => {
  voiceAdapter = adapter;
  ui.setVoiceAdapter(adapter);
  ui.render(engine.state);
});

// 调试/自动化验收钩子：Playwright 与仿真工具从此读取/驱动引擎。
(globalThis as Record<string, unknown>).__VOICE_TOWER__ = {
  engine,
  get voiceAdapter() {
    return voiceAdapter;
  },
  getState: () => engine.state,
  startCampaign: (act?: number, seed?: number) => engine.startCampaign(act, seed),
  voiceServices
};
