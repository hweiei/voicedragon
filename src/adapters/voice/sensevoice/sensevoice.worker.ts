/**
 * SenseVoice 识别 Worker（Classic Worker 语义，Vite 以 iife 打包以支持 importScripts）。
 *
 * 管线：Int16 音频帧 → 降采样 16kHz Float32 → CircularBuffer → Silero VAD 分段
 *       → OfflineRecognizer(SenseVoice) 解码 → 文本回传。
 * 参考 k2-fsa 官方 vad-asr wasm 示例协议（init / audio / flush / dispose）。
 */

export type UpstreamMessage =
  | {
      type: "init";
      fileUrls: Record<string, string>;
      runtimeBaseUrl: string;
      dataPackageMetadata: unknown;
    }
  | { type: "audio"; samples: Int16Array; sampleRate: number }
  | { type: "flush" }
  | { type: "dispose" };

export type DownstreamMessage =
  | { type: "ready"; loadTimeMs: number }
  | { type: "status"; message: string }
  | { type: "speech_start" }
  | {
      type: "result";
      text: string;
      durationMs: number;
      recognitionTimeMs: number;
    }
  | { type: "error"; error: string }
  | { type: "disposed" };

interface WorkerScopeLike {
  onmessage: ((event: MessageEvent<UpstreamMessage>) => void) | null;
  postMessage(message: DownstreamMessage, transfer?: Transferable[]): void;
  importScripts(...urls: string[]): void;
}

declare const self: WorkerScopeLike & typeof globalThis;

const EXPECTED_SAMPLE_RATE = 16000;

interface SherpaModule {
  [key: string]: unknown;
  onRuntimeInitialized?: () => void;
  setStatus?: (text: string) => void;
  locateFile?: (path: string) => string;
  _dataPackageMetadata?: unknown;
}

interface VadLike {
  config: { sileroVad?: { windowSize?: number } };
  acceptWaveform(samples: Float32Array): void;
  isEmpty(): boolean;
  isDetected(): boolean;
  front(): { samples: Float32Array; start: number };
  pop(): void;
  flush(): void;
  free(): void;
}

interface CircularBufferLike {
  push(samples: Float32Array): void;
  get(startIndex: number, n: number): Float32Array;
  pop(n: number): void;
  size(): number;
  head(): number;
  free(): void;
}

interface OfflineStreamLike {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  free(): void;
}

interface OfflineRecognizerLike {
  createStream(): OfflineStreamLike;
  decode(stream: OfflineStreamLike): void;
  getResult(stream: OfflineStreamLike): { text?: string };
  free(): void;
}

let vad: VadLike | null = null;
let buffer: CircularBufferLike | null = null;
let recognizer: OfflineRecognizerLike | null = null;
let isReady = false;
let isSpeaking = false;

function post(message: DownstreamMessage): void {
  self.postMessage(message);
}

/** Int16 任意采样率 → Float32/16kHz（线性插值重采样 + 归一化）。 */
export function downsampleInt16ToFloat32(
  input: Int16Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i += 1) output[i] = input[i] / 32768;
    return output;
  }
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const frac = srcIndex - srcIndexFloor;
    const sample = input[srcIndexFloor] * (1 - frac) + input[srcIndexCeil] * frac;
    output[i] = sample / 32768;
  }
  return output;
}

function stripCjkSpaces(text: string): string {
  return text.replace(/([㐀-鿿豈-﫿])\s+(?=[㐀-鿿豈-﫿])/g, "$1");
}

function decodeSegment(rec: OfflineRecognizerLike, samples: Float32Array): string {
  const stream = rec.createStream();
  stream.acceptWaveform(EXPECTED_SAMPLE_RATE, samples);
  rec.decode(stream);
  const result = rec.getResult(stream);
  stream.free();
  return stripCjkSpaces((result.text || "").trim());
}

function drainVadAndDecode(): void {
  if (!vad || !recognizer) return;
  while (!vad.isEmpty()) {
    const segment = vad.front();
    const started = performance.now();
    const text = decodeSegment(recognizer, segment.samples);
    const recognitionTimeMs = Math.round(performance.now() - started);
    const durationMs = Math.round((segment.samples.length / EXPECTED_SAMPLE_RATE) * 1000);
    if (text) post({ type: "result", text, durationMs, recognitionTimeMs });
    vad.pop();
    isSpeaking = false;
  }
}

function handleInit(msg: Extract<UpstreamMessage, { type: "init" }>): void {
  const started = performance.now();
  try {
    const Module: SherpaModule = {};
    (globalThis as Record<string, unknown>).Module = Module;
    Module._dataPackageMetadata = msg.dataPackageMetadata;
    Module.locateFile = (path: string) => msg.fileUrls[path] ?? `${msg.runtimeBaseUrl}/${path}`;
    Module.setStatus = (text: string) => post({ type: "status", message: text });

    Module.onRuntimeInitialized = () => {
      try {
        const g = globalThis as Record<string, any>;
        vad = g.createVad(Module) as VadLike;
        buffer = new g.CircularBuffer(30 * EXPECTED_SAMPLE_RATE, Module) as CircularBufferLike;
        const config = {
          modelConfig: {
            debug: 1,
            tokens: "./tokens.txt",
            senseVoice: { model: "./sense-voice.onnx", useInverseTextNormalization: 1 }
          }
        };
        recognizer = new g.OfflineRecognizer(config, Module) as OfflineRecognizerLike;
        isReady = true;
        post({ type: "ready", loadTimeMs: Math.round(performance.now() - started) });
      } catch (error) {
        post({ type: "error", error: `引擎初始化失败：${(error as Error).message || error}` });
      }
    };

    self.importScripts(
      `${msg.runtimeBaseUrl}/sherpa-onnx-wasm-main-vad-asr.js`,
      `${msg.runtimeBaseUrl}/sherpa-onnx-vad.js`,
      `${msg.runtimeBaseUrl}/sherpa-onnx-asr.js`
    );
  } catch (error) {
    post({ type: "error", error: `WASM 运行时加载失败：${(error as Error).message || error}` });
  }
}

function handleAudio(msg: Extract<UpstreamMessage, { type: "audio" }>): void {
  if (!isReady || !vad || !buffer || !recognizer) return;
  try {
    const samples = downsampleInt16ToFloat32(msg.samples, msg.sampleRate, EXPECTED_SAMPLE_RATE);
    buffer.push(samples);
    const windowSize = vad.config.sileroVad?.windowSize || 512;
    while (buffer.size() >= windowSize) {
      const segment = buffer.get(buffer.head(), windowSize);
      buffer.pop(windowSize);
      vad.acceptWaveform(segment);
      if (!isSpeaking && vad.isDetected()) {
        isSpeaking = true;
        post({ type: "speech_start" });
      }
    }
    drainVadAndDecode();
  } catch (error) {
    isSpeaking = false;
    post({ type: "error", error: `识别处理失败：${(error as Error).message || error}` });
    try {
      while (vad && !vad.isEmpty()) vad.pop();
    } catch {
      // 忽略清理期错误
    }
  }
}

function handleFlush(): void {
  if (!isReady || !vad || !recognizer) return;
  try {
    vad.flush();
    drainVadAndDecode();
  } catch (error) {
    isSpeaking = false;
    post({ type: "error", error: `判定失败：${(error as Error).message || error}` });
    try {
      while (vad && !vad.isEmpty()) vad.pop();
    } catch {
      // 忽略清理期错误
    }
  }
}

function handleDispose(): void {
  recognizer?.free();
  vad?.free();
  buffer?.free();
  recognizer = null;
  vad = null;
  buffer = null;
  isReady = false;
  post({ type: "disposed" });
}

self.onmessage = (event: MessageEvent<UpstreamMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case "init":
      handleInit(msg);
      break;
    case "audio":
      handleAudio(msg);
      break;
    case "flush":
      handleFlush();
      break;
    case "dispose":
      handleDispose();
      break;
    default:
      post({ type: "error", error: "未知消息类型" });
  }
};
