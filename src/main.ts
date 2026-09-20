/**
 * 应用入口：组装内核 + 适配器 + 渲染层（组合根）。
 * 语音编排：按 settings.voiceMode 构造适配器；模型缓存探测走 model-store；
 * 设置页事件（引擎切换/下载模型/清除缓存）经 VoiceServices 注入 UI。
 */

import "./ui/styles.css";
import { GameAudio, bgmLayersFor, bgmMoodForPhase, sfxForEffect } from "./adapters/audio";
import { setKeepScreenOn } from "./adapters/platform";
import {
  loadCampaignMeta,
  loadProfile,
  loadSettings,
  saveCampaignMeta,
  saveGame,
  saveSettings
} from "./adapters/storage";
import type { CampaignActMeta } from "./adapters/storage";
import { SpeechTts } from "./adapters/tts";
import { createVoiceAdapter } from "./adapters/voice";
import type { VoiceAdapter, VoiceMode, VoiceScoreResult } from "./adapters/voice";
import type { SenseVoiceAdapter } from "./adapters/voice/sensevoice/adapter";
import {
  clearModel,
  downloadModel,
  getModelStatus,
  isModelReady
} from "./adapters/voice/sensevoice/model-store";
import type { DownloadProgress } from "./adapters/voice/sensevoice/model-store";
import { type ChallengeBundle, decodeChallenge, encodeChallenge } from "./core/challenge";
import { SCORING_WEIGHTS_V2 } from "./core/config/balance";
import { GameEngine } from "./core/engine";
import type { CampaignConfig, EmitOptions, GameState, StartCampaignArgs } from "./core/engine";
import { adaptiveBoostFor } from "./core/profile";
import { registerBurstSink } from "./ui/fx";
import { FpsGovernor } from "./ui/fx/governor";
import { burstSpecFor } from "./ui/fx/particles/emitter";
import { ParticleField, actThemeFor } from "./ui/fx/particles/field";
import { startScreenTransition } from "./ui/fx/transitions";
import { GameUI } from "./ui/ui";
import type { VoiceServices } from "./ui/ui";

const settings = loadSettings();
document.body.classList.toggle("reduce-motion", settings.reduceMotion);
// P4 主题皮肤：data-theme 由设置档驱动（ink 为根变量默认，无需覆盖）
document.body.dataset.theme = settings.theme ?? "ink";

const engine = new GameEngine();
const tts = new SpeechTts();

// ─── P5 音效与演出：合成音效 + 生成式 BGM + 氛围粒子 ─────────────────────────

const audio = new GameAudio();
audio.attachSettings({ sound: settings.sound, music: settings.music ?? true });
// P6-F2：粒子场（三幕主题 + 爆发 + 音频响应，替代 P5 AmbientField）
// P6-F3：帧率治理器注入，自动降载 + 设置页「特效强度」手动覆盖
const governor = new FpsGovernor();
governor.setManualIntensity(settings.fxIntensity ?? "auto");

const ambientCanvas = document.querySelector<HTMLCanvasElement>("#ambient-canvas");
const ambient = ambientCanvas
  ? new ParticleField(ambientCanvas, { reducedMotion: settings.reduceMotion })
  : null;
if (ambient) {
  ambient.setAudioLevel(() => audio.level());
  ambient.setGovernor(governor);
  // P6-F1/F2 联动：战斗演出按语义点火粒子爆发（敌人舞台约在画面上 1/3）
  registerBurstSink((kind) => {
    const x = 0.35 + Math.random() * 0.3;
    const y = 0.3 + Math.random() * 0.12;
    ambient.burst(burstSpecFor(kind, x, y));
    if (kind === "crit") {
      // P6-F3 签名演出：暴击瞬间「声」字汇聚成形
      ambient.kanjiBurst("声", x, y - 0.05, 46);
    }
    if (kind === "firework") {
      // 胜利三连：左右补两发，位置与色相错开；中央浮出「震」字
      window.setTimeout(() => ambient.burst(burstSpecFor("firework", 0.25, 0.34, 40)), 180);
      window.setTimeout(() => ambient.burst(burstSpecFor("firework", 0.75, 0.3, -20)), 360);
      window.setTimeout(() => ambient.kanjiBurst("震", 0.5, 0.42, 44), 420);
    }
  });
}

// 自动播放合规：首次手势解锁 AudioContext；顺手给所有动作按钮配轻点击音
document.addEventListener(
  "pointerdown",
  (event) => {
    audio.unlock();
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (button) audio.playSfx("click");
  },
  { capture: true }
);
document.addEventListener("visibilitychange", () => {
  audio.handleVisibility(document.hidden);
});

// P4 自适应难度注入：连胜略加难 / 连败略减压（设置页可关），随每局开局采样
engine.adaptiveProvider = () =>
  settings.adaptiveEnabled !== false ? adaptiveBoostFor(loadProfile().stats.adaptiveStreak) : 0;

// ─── 战役元存档（P2 单幕 → P5 按幕）：同幕同种子★最高纪录跨局累计 ─────────────

/** 幕号 → 该幕元数据（读不到给空对象）。 */
export function campaignActMeta(act: number): CampaignActMeta | null {
  return loadCampaignMeta()?.acts[String(act)] ?? null;
}

/** 开新战役时，把本地同种子同幕的历史★注入新局（重打刷新只升不降；同幕地图种子复用）。 */
const startCampaignBase = engine.startCampaign.bind(engine);
engine.startCampaign = (...args: StartCampaignArgs) => {
  // P10：参数对象与旧位置形态归一化后注入同幕种子（两种入口行为等价）
  const config: CampaignConfig =
    typeof args[0] === "object" && args[0] !== null
      ? args[0]
      : {
          act: args[0],
          seed: args[1],
          ruleset: args[2],
          buildVersion: args[3],
          encounterVersion: args[4],
          counterVersion: args[5]
        };
  const act = config.act ?? 1;
  const actMeta = campaignActMeta(act);
  startCampaignBase({ ...config, seed: config.seed ?? actMeta?.mapSeed });
  const campaign = engine.state.campaign;
  if (campaign && actMeta && actMeta.mapSeed === campaign.map.seed) {
    Object.assign(campaign.stars, actMeta.stars);
  }
};

/** 每次状态广播都把战役★同步进元存档（含败北——星辉不随倒下丢失；Boss 通关标记只升不降）。 */
function syncCampaignMeta(state: GameState): void {
  const campaign = state.campaign;
  if (!campaign) return;
  const meta = loadCampaignMeta() ?? { version: 2, acts: {}, updatedAt: "" };
  const key = String(campaign.act);
  const prev = meta.acts[key];
  const stars = { ...campaign.stars };
  if (prev) {
    for (const [nodeId, best] of Object.entries(prev.stars)) {
      stars[nodeId] = Math.max(stars[nodeId] ?? 0, best);
    }
  }
  meta.acts[key] = {
    mapSeed: campaign.map.seed,
    stars,
    bossCleared: Boolean(prev?.bossCleared) || campaign.clearedIds.includes(campaign.map.bossId)
  };
  saveCampaignMeta({ ...meta, updatedAt: new Date().toISOString() });
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
      // P5：音效/音乐/氛围即时生效
      audio.attachSettings({ sound: settings.sound, music: settings.music ?? true });
      ambient?.setReducedMotion(settings.reduceMotion);
      // P6-F3：特效强度即时生效
      governor.setManualIntensity(settings.fxIntensity ?? "auto");
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

let lastBroadcastPhase: string | null = null;

engine.subscribe((state: GameState, options: EmitOptions) => {
  syncCampaignMeta(state);
  if (options.save && state.phase !== "title") saveGame(state);
  // P6-F1 场景转场：相位变更经 View Transitions（不支持/reduce-motion 时自动直渲）
  if (lastBroadcastPhase !== null && state.phase !== lastBroadcastPhase) {
    startScreenTransition(() => ui.render(state, options));
  } else {
    ui.render(state, options);
  }
  lastBroadcastPhase = state.phase;
  // P6-F2：氛围主题随幕切换（战役第二/三幕换粒子动力学与色板）
  if (ambient) {
    const theme = actThemeFor(state);
    if (ambient.currentTheme.id !== theme.id) {
      ambient.clearBursts();
      ambient.setTheme(theme);
    }
  }
  // P5 演出与声音：按 emit 效果播放（未解锁/关闭时适配器内部 no-op）
  const sfx = sfxForEffect(options.effect);
  if (sfx) audio.playSfx(sfx);
  audio.setMood(bgmMoodForPhase(state.phase));
  // P11 纵向分层与 stinger：层开关由纯函数计算，音乐关闭时适配器内部 no-op
  audio.setLayers(bgmLayersFor(state));
  if (options.effect === "ultimate") audio.stinger("ultimate");
  if (options.effect === "star") audio.stinger("star");
  if (options.effect === "hit" || options.effect === "victory") ambient?.pulse();
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
  startCampaign: (...args: Parameters<GameEngine["startCampaign"]>) =>
    engine.startCampaign(...args),
  /** P12 切磋码调试口：E2E 与仿真工具据此编解码/应战（UI 入口见标题屏「切磋码」）。 */
  challenge: {
    encode: (bundle: ChallengeBundle) => encodeChallenge(bundle),
    decode: (code: string) => decodeChallenge(code),
    start: (code: string) => {
      const decoded = decodeChallenge(code);
      if (!decoded.ok) return decoded;
      engine.startChallenge(decoded.challenge);
      return { ok: true as const, hash: decoded.hash, code: decoded.code };
    }
  },
  showVoiceResult: (result: VoiceScoreResult) => ui.debugShowVoiceResult(result),
  voiceServices
};
