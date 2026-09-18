/**
 * 模型持久化与下载器：
 * - IndexedDB 两仓：`files`（成品文件：metadata JSON + 完整 data Blob）、`parts`（下载中的分片）
 * - Range 分片下载：每片 MODEL_PART_SIZE（8 MiB），逐片固化 → 任意中断后重进只补缺口
 * - finalize：全部到位后拼装 Blob 并校验总字节数，随后清理分片
 * - getModelHandles 产出 worker 初始化所需的 blob URL 与 Emscripten 元数据
 */

import { MODEL_PART_SIZE } from "../../../core/config/balance";
import {
  type ModelFileSpec,
  type ModelManifest,
  SENSEVOICE_MANIFEST,
  modelFileUrl
} from "./manifest";

const DB_NAME = "voicedragon-asr";
const DB_VERSION = 1;
const STORE_FILES = "files";
const STORE_PARTS = "parts";

// ─── 纯函数（可单测） ─────────────────────────────────────────────────────────

export interface PartPlan {
  index: number;
  start: number;
  /** 闭区间结束偏移 */
  end: number;
  size: number;
}

/** 按片大小切分文件：覆盖 [0, totalSize) 的分片计划。 */
export function planParts(totalSize: number, partSize: number = MODEL_PART_SIZE): PartPlan[] {
  const plans: PartPlan[] = [];
  let index = 0;
  for (let start = 0; start < totalSize; start += partSize) {
    const end = Math.min(start + partSize, totalSize) - 1;
    plans.push({ index, start, end, size: end - start + 1 });
    index += 1;
  }
  return plans;
}

/** 剔除已完成分片后的待办。 */
export function remainingParts(plans: PartPlan[], done: ReadonlySet<number>): PartPlan[] {
  return plans.filter((part) => !done.has(part.index));
}

export function partKey(fileName: string, index: number): string {
  return `${fileName}:${index}`;
}

// ─── IndexedDB 基础设施 ───────────────────────────────────────────────────────

interface FileRecord {
  name: string;
  size: number;
  blob?: Blob;
  metadata?: unknown;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_FILES)) {
        request.result.createObjectStore(STORE_FILES);
      }
      if (!request.result.objectStoreNames.contains(STORE_PARTS)) {
        request.result.createObjectStore(STORE_PARTS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 打开失败"));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = run(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB 事务失败"));
    });
  } finally {
    db.close();
  }
}

const idbGet = <T>(store: string, key: string): Promise<T | undefined> =>
  withStore<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
const idbPut = (store: string, key: string, value: unknown): Promise<IDBValidKey> =>
  withStore(store, "readwrite", (s) => s.put(value, key));
const idbDelete = (store: string, key: string): Promise<undefined> =>
  withStore(store, "readwrite", (s) => s.delete(key));
const idbKeys = (store: string): Promise<IDBValidKey[]> =>
  withStore(store, "readonly", (s) => s.getAllKeys());

// ─── 状态查询 ─────────────────────────────────────────────────────────────────

export interface ModelStatus {
  state: "none" | "partial" | "ready";
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  partCount: number;
  doneParts: number;
}

export async function getModelStatus(
  manifest: ModelManifest = SENSEVOICE_MANIFEST
): Promise<ModelStatus> {
  const { dataFile } = manifest;
  const total = dataFile.size;
  const plans = planParts(total);
  const file = await idbGet<FileRecord>(STORE_FILES, dataFile.name);
  if (file) {
    return {
      state: "ready",
      downloadedBytes: total,
      totalBytes: total,
      percent: 100,
      partCount: plans.length,
      doneParts: plans.length
    };
  }
  const keys = await idbKeys(STORE_PARTS);
  const prefix = `${dataFile.name}:`;
  const doneIndexes = new Set<number>();
  let downloaded = 0;
  for (const key of keys) {
    const k = String(key);
    if (!k.startsWith(prefix)) continue;
    const index = Number(k.slice(prefix.length));
    const plan = plans[index];
    if (plan && !doneIndexes.has(index)) {
      doneIndexes.add(index);
      downloaded += plan.size;
    }
  }
  return {
    state: doneIndexes.size ? "partial" : "none",
    downloadedBytes: downloaded,
    totalBytes: total,
    percent: Math.round((downloaded / total) * 100),
    partCount: plans.length,
    doneParts: doneIndexes.size
  };
}

export async function isModelReady(
  manifest: ModelManifest = SENSEVOICE_MANIFEST
): Promise<boolean> {
  return (await getModelStatus(manifest)).state === "ready";
}

// ─── 下载（Range 分片 + 断点续传） ─────────────────────────────────────────────

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  doneParts: number;
  partCount: number;
  currentPart: number;
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  manifest?: ModelManifest;
  fetchImpl?: typeof fetch;
}

async function fetchJson(fetchImpl: typeof fetch, url: string, signal?: AbortSignal) {
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error(`模型元数据下载失败：HTTP ${response.status}`);
  return response.json();
}

async function fetchPart(
  fetchImpl: typeof fetch,
  url: string,
  part: PartPlan,
  file: ModelFileSpec,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await fetchImpl(url, {
    headers: { Range: `bytes=${part.start}-${part.end}` },
    signal
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`分片 ${part.index} 下载失败：HTTP ${response.status}`);
  }
  const blob = await response.blob();
  if (blob.size !== part.size) {
    throw new Error(`分片 ${part.index} 字节数不符：期望 ${part.size}，实得 ${blob.size}`);
  }
  void file;
  return blob;
}

/**
 * 下载整个模型（支持重复调用：已完成分片直接跳过）。
 * 失败抛错前已落盘的分片不会丢失——再次调用即续传。
 */
export async function downloadModel(options: DownloadOptions = {}): Promise<void> {
  const manifest = options.manifest ?? SENSEVOICE_MANIFEST;
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const { dataFile, metadataFile } = manifest;
  const dataUrl = modelFileUrl(manifest, dataFile);

  // 1) 元数据（Emscripten data package metadata，小文件）
  const metaUrl = modelFileUrl(manifest, metadataFile);
  const metadata = await fetchJson(fetchImpl, metaUrl, options.signal);
  await idbPut(STORE_FILES, metadataFile.name, {
    name: metadataFile.name,
    size: metadataFile.size,
    metadata
  } satisfies FileRecord);

  // 2) data 分片
  const plans = planParts(dataFile.size);
  const existingKeys = await idbKeys(STORE_PARTS);
  const done = new Set<number>();
  for (const key of existingKeys) {
    const k = String(key);
    const prefix = `${dataFile.name}:`;
    if (k.startsWith(prefix)) done.add(Number(k.slice(prefix.length)));
  }

  let downloadedBytes = plans.filter((p) => done.has(p.index)).reduce((sum, p) => sum + p.size, 0);
  const emit = (currentPart: number) =>
    options.onProgress?.({
      downloadedBytes,
      totalBytes: dataFile.size,
      percent: Math.round((downloadedBytes / dataFile.size) * 100),
      doneParts: done.size,
      partCount: plans.length,
      currentPart
    });

  for (const part of remainingParts(plans, done)) {
    if (options.signal?.aborted) throw new Error("下载已取消");
    const blob = await fetchPart(fetchImpl, dataUrl, part, dataFile, options.signal);
    await idbPut(STORE_PARTS, partKey(dataFile.name, part.index), blob);
    done.add(part.index);
    downloadedBytes += part.size;
    emit(part.index);
  }

  // 3) finalize：拼装 → 校验 → 清理分片
  const partBlobs: Blob[] = [];
  for (const part of plans) {
    const blob = await idbGet<Blob>(STORE_PARTS, partKey(dataFile.name, part.index));
    if (!blob) throw new Error(`分片 ${part.index} 缺失，拼装中止`);
    partBlobs.push(blob);
  }
  const assembled = new Blob(partBlobs, { type: "application/octet-stream" });
  if (assembled.size !== dataFile.size) {
    throw new Error(`模型字节数不符：期望 ${dataFile.size}，实得 ${assembled.size}`);
  }
  await idbPut(STORE_FILES, dataFile.name, {
    name: dataFile.name,
    size: dataFile.size,
    blob: assembled
  } satisfies FileRecord);
  for (const part of plans) {
    await idbDelete(STORE_PARTS, partKey(dataFile.name, part.index));
  }
  emit(plans[plans.length - 1]?.index ?? 0);
}

// ─── 运行期句柄（Worker 初始化输入） ──────────────────────────────────────────

export interface ModelHandles {
  /** Module.locateFile 可解析的 data blob URL */
  dataBlobUrl: string;
  /** package-metadata.json 内容（Emscripten data package metadata） */
  dataPackageMetadata: unknown;
}

let cachedBlobUrl: string | null = null;

export async function getModelHandles(
  manifest: ModelManifest = SENSEVOICE_MANIFEST
): Promise<ModelHandles | null> {
  const dataRecord = await idbGet<FileRecord>(STORE_FILES, manifest.dataFile.name);
  const metaRecord = await idbGet<FileRecord>(STORE_FILES, manifest.metadataFile.name);
  if (!dataRecord?.blob || !metaRecord?.metadata) return null;
  if (!cachedBlobUrl) {
    cachedBlobUrl = URL.createObjectURL(dataRecord.blob);
  }
  return { dataBlobUrl: cachedBlobUrl, dataPackageMetadata: metaRecord.metadata };
}

export async function clearModel(manifest: ModelManifest = SENSEVOICE_MANIFEST): Promise<void> {
  const keys = await idbKeys(STORE_PARTS);
  const prefix = `${manifest.dataFile.name}:`;
  for (const key of keys) {
    if (String(key).startsWith(prefix)) await idbDelete(STORE_PARTS, String(key));
  }
  await idbDelete(STORE_FILES, manifest.dataFile.name);
  await idbDelete(STORE_FILES, manifest.metadataFile.name);
  if (cachedBlobUrl) {
    URL.revokeObjectURL(cachedBlobUrl);
    cachedBlobUrl = null;
  }
}
