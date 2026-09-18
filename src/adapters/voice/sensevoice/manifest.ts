/**
 * SenseVoice 模型清单：文件、尺寸、权威下载源。
 *
 * 模型：sherpa-onnx SenseVoice int8（中/英/日/韩/粤 五语，FunAudioLLM 出品）
 * 托管：Hugging Face Datasets（resolve 302 → hf.co CDN，CORS 白名单 + Range 支持，已实测）
 * 运行时：vendor 于 public/vendors/sherpa/（Emscripten glue + wasm + sherpa 助手 JS，
 *         与 .data 为同一 Emscripten 包，来源 sokuji/k2-fsa 构建产物，Apache-2.0）
 *
 * 更换模型镜像时只需改 baseUrl/大小（升级版模型需同步更新 loadPackage 元数据文件）。
 */

export interface ModelFileSpec {
  name: string;
  size: number;
}

export interface ModelManifest {
  id: string;
  /** sherpa 引擎类型（worker 端构造 OfflineRecognizer 配置用） */
  engine: "sensevoice";
  label: string;
  languages: string[];
  baseUrl: string;
  dataFile: ModelFileSpec;
  metadataFile: ModelFileSpec;
  /** Emscripten Module 期望的 data 文件名（Module.locateFile 的 key） */
  emscriptenDataName: string;
}

export const SENSEVOICE_MANIFEST: ModelManifest = {
  id: "sensevoice-int8-zh-en-ja-ko-yue",
  engine: "sensevoice",
  label: "SenseVoice 粤语（端侧 · 离线）",
  languages: ["zh", "en", "ja", "ko", "yue"],
  baseUrl:
    "https://huggingface.co/datasets/jiangzhuo9357/sherpa-onnx-asr-models/resolve/main/wasm-sensevoice-int8",
  dataFile: { name: "sherpa-onnx-wasm-main-vad-asr.data", size: 238075295 },
  metadataFile: { name: "package-metadata.json", size: 229 },
  emscriptenDataName: "sherpa-onnx-wasm-main-vad-asr.data"
};

export function modelFileUrl(manifest: ModelManifest, file: ModelFileSpec): string {
  return `${manifest.baseUrl}/${file.name}`;
}

/** public/vendors/sherpa 的部署基路径（同源，规避第三方脚本 CSP 问题）。 */
export function runtimeBaseUrl(): string {
  return new URL("vendors/sherpa/", document.baseURI).toString();
}
