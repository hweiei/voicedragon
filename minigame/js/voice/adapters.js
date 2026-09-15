import { scorePronunciation } from "./scoring.js";

export class BrowserVoiceAdapter {
  constructor() {
    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    this.Recognition = Recognition || null;
    this.recognition = null;
    this.active = false;
  }

  get id() {
    return "web-speech";
  }

  get supported() {
    return Boolean(this.Recognition);
  }

  start({ targets, onInterim, onResult, onError, onState }) {
    if (!this.supported) {
      onError?.(new Error("当前浏览器不支持 Web Speech API"));
      return;
    }
    this.cancel();
    const recognition = new this.Recognition();
    let delivered = false;
    let failed = false;
    this.recognition = recognition;
    recognition.lang = "zh-HK";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 4;

    recognition.onstart = () => {
      this.active = true;
      onState?.("listening");
    };

    recognition.onspeechend = () => {
      onState?.("processing");
      recognition.stop();
    };

    recognition.onresult = (event) => {
      let interim = "";
      const candidates = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) {
          interim += result[0]?.transcript || "";
          continue;
        }
        for (let j = 0; j < result.length; j += 1) {
          const alternative = result[j];
          const confidence = Number.isFinite(alternative.confidence) && alternative.confidence > 0
            ? alternative.confidence
            : 0.72;
          const scored = scorePronunciation(targets, alternative.transcript, confidence);
          candidates.push({ ...scored, rawConfidence: confidence });
        }
      }
      if (interim) onInterim?.(interim);
      if (candidates.length) {
        candidates.sort((a, b) => b.score - a.score);
        delivered = true;
        onResult?.({ ...candidates[0], source: this.id });
      }
    };

    recognition.onerror = (event) => {
      this.active = false;
      failed = true;
      const error = new Error(event.error === "not-allowed" ? "麦克风权限未开启" : `语音识别失败：${event.error}`);
      error.code = event.error;
      onError?.(error);
    };

    recognition.onend = () => {
      this.active = false;
      onState?.("idle");
      if (!delivered && !failed) onError?.(new Error("没有识别到清晰语音"));
    };

    try {
      recognition.start();
    } catch (error) {
      this.active = false;
      onError?.(error);
    }
  }

  stop() {
    if (this.recognition && this.active) this.recognition.stop();
  }

  cancel() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // The recognition may already be idle.
      }
    }
    this.active = false;
    this.recognition = null;
  }
}

export class MiniGameRecorderAdapter {
  constructor({ platform, api, endpoint }) {
    this.platform = platform;
    this.api = api;
    this.endpoint = endpoint;
    this.recorder = api?.getRecorderManager?.() || null;
    this.pending = null;
    this.timeout = null;
    this.bound = false;
    this.bindEvents();
  }

  get id() {
    return `${this.platform}-recorder`;
  }

  get supported() {
    return Boolean(this.recorder && this.api?.uploadFile && this.endpoint);
  }

  bindEvents() {
    if (!this.recorder || this.bound) return;
    this.bound = true;
    this.recorder.onStart?.(() => this.pending?.onState?.("listening"));
    this.recorder.onError?.((detail) => {
      this.clearTimer();
      this.pending?.onError?.(new Error(detail?.errMsg || "录音失败"));
      this.pending = null;
    });
    this.recorder.onStop?.((result) => {
      this.clearTimer();
      if (!this.pending) return;
      this.pending.onState?.("processing");
      this.upload(result.tempFilePath);
    });
  }

  start({ targets, jyutping, onResult, onError, onState }) {
    if (!this.endpoint) {
      onError?.(new Error("尚未配置服务端语音识别地址"));
      return;
    }
    if (!this.supported) {
      onError?.(new Error("当前小游戏录音环境不可用"));
      return;
    }
    this.pending = { targets, jyutping, onResult, onError, onState };
    this.recorder.start({
      duration: 6000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: "mp3"
    });
    this.timeout = setTimeout(() => this.stop(), 6000);
  }

  stop() {
    if (this.pending) this.recorder.stop();
  }

  cancel() {
    this.clearTimer();
    this.pending = null;
    this.recorder?.stop?.();
  }

  clearTimer() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
  }

  upload(filePath) {
    const request = this.pending;
    if (!request) return;
    this.api.uploadFile({
      url: this.endpoint,
      filePath,
      name: "audio",
      formData: {
        expected: request.targets[0] || "",
        alternatives: JSON.stringify(request.targets),
        jyutping: request.jyutping || "",
        language: "yue",
        engineModelType: "16k_yue"
      },
      success: (response) => {
        try {
          const payload = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
          if (!payload?.transcript) throw new Error("服务端未返回识别文本");
          const confidence = Number.isFinite(payload.confidence) ? payload.confidence : 0.72;
          const scored = scorePronunciation(request.targets, payload.transcript, confidence);
          request.onResult?.({ ...scored, source: this.id, audioRef: filePath });
        } catch (error) {
          request.onError?.(error);
        } finally {
          this.pending = null;
        }
      },
      fail: (error) => {
        request.onError?.(new Error(error?.errMsg || "上传语音失败"));
        this.pending = null;
      }
    });
  }
}

export function createVoiceAdapter() {
  const endpoint = globalThis.__VOICE_API_ENDPOINT__ || "";
  if (globalThis.wx?.getRecorderManager) {
    return new MiniGameRecorderAdapter({ platform: "wechat", api: globalThis.wx, endpoint });
  }
  if (globalThis.tt?.getRecorderManager) {
    return new MiniGameRecorderAdapter({ platform: "douyin", api: globalThis.tt, endpoint });
  }
  return new BrowserVoiceAdapter();
}
