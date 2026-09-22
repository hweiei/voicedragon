/**
 * P12 切磋码（核心层，纯函数）：把一局的「身份」编码成短码——种子即链接、链接即赛局。
 *
 * 零后端、零账号：码内只有幕、种子、版本束、角色与词缀，不含昵称、时间戳与设备信息。
 * 三条红线在本文件内自证：
 * 1) **同码同局**——解码只校验与还原，绝不\"就近取整\"；解码出的 bundle 原样透传开局路径；
 * 2) **不静默降级**——版本束不被本引擎支持（或内容世代重算不符）时返回 ok:false，
 *    由调用方明确拒绝，绝不开一局「近似」的局；
 * 3) **零副作用**——全纯函数：畸形输入不抛异常、不写状态、不改动入参。
 */

import { ACT_COUNT, ACT_NUMERALS, type ContentRuleset } from "./content";
import { type CharacterId, lookupCharacter } from "./content/roster";
import { dailySeedForKey } from "./daily";
import { MUTATORS, mutationList, selectMutators } from "./mutators";

/** 码格式版本；新版格式必须走新前缀，旧引擎遇到即 unsupported。 */
export const CHALLENGE_FORMAT = 1;
export const CHALLENGE_PREFIX = "VT1";
export const CHALLENGE_MAX_LENGTH = 240;
export const CHALLENGE_RECORD_LIMIT = 50;

export const CHALLENGE_MODES = ["campaign", "endless", "daily", "classic"] as const;
export type ChallengeMode = (typeof CHALLENGE_MODES)[number];

/** 版本束：每期机制的独立门控；只认 1（将来 2 必须由新引擎显式支持）。 */
export type ChallengeVersionKey =
  | "build"
  | "encounter"
  | "counter"
  | "roster"
  | "ultimate"
  | "forge";
export const CHALLENGE_VERSION_KEYS: readonly ChallengeVersionKey[] = [
  "build",
  "encounter",
  "counter",
  "roster",
  "ultimate",
  "forge"
];

/** 版本束在码内的紧凑字段名（必须与 ruleset 的 "r" 等其它字段互不冲突）。 */
const VERSION_FIELD: Record<ChallengeVersionKey, string> = {
  build: "b",
  encounter: "e",
  counter: "c",
  roster: "n",
  ultimate: "u",
  forge: "f"
};

export interface ChallengeBundle {
  mode: ChallengeMode;
  /** 战役码携带幕号；其余模式固定 1。 */
  act: number;
  seed: number;
  ruleset: ContentRuleset;
  build?: 1;
  encounter?: 1;
  counter?: 1;
  roster?: 1;
  ultimate?: 1;
  /** P15 铸剑炉内容版本；旧码无此字段 = 旧内容池，逐位同局（零破坏）。 */
  forge?: 1;
  character?: CharacterId;
  /** 每日挑战的日期键（YYYY-MM-DD）；仅 daily 模式。 */
  dateKey?: string;
  /** 无尽/每日词缀（stage 0）；解码时与本机内容世代重算比对。 */
  mutators?: string[];
  /** 自适应难度（百分点整数，+5 / -8 / 缺省 0）；码即难度，同码同难。 */
  adaptiveBoost?: number;
}

/** 解码产物：bundle + 码本身 + 归一化哈希（战绩簿键）。 */
export interface ChallengeRun extends ChallengeBundle {
  code: string;
  hash: string;
}

export type ChallengeRejectionReason = "malformed" | "unsupported" | "mismatch";

export type ChallengeRejection = {
  ok: false;
  reason: ChallengeRejectionReason;
  detail: string;
};

export type ChallengeEncodeResult =
  | { ok: true; code: string; payload: string; hash: string }
  | ChallengeRejection;

export type ChallengeDecodeResult =
  | { ok: true; code: string; payload: string; hash: string; challenge: ChallengeRun }
  | ChallengeRejection;

/** 战绩簿记录：只含展示与比较所需字段（无账号、无设备信息）。 */
export interface ChallengeRecord {
  hash: string;
  code: string;
  mode: ChallengeMode;
  act: number;
  character?: CharacterId;
  floor: number;
  victory: boolean;
  averageScore: number;
  finishedAt: string;
}

// ─── 编码原语（自实现，内核零平台依赖：不用 btoa / TextEncoder） ──────────────

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64urlFromAscii(text: string): string | null {
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 0x7f) return null;
    bytes.push(code);
  }
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const b0 = bytes[index];
    const b1 = bytes[index + 1];
    const b2 = bytes[index + 2];
    output += BASE64URL_ALPHABET[b0 >> 2];
    output += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    output += BASE64URL_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    output += BASE64URL_ALPHABET[b2 & 0x3f];
  }
  return output;
}

function asciiFromBase64url(raw: string): string | null {
  if (raw.length === 0) return null;
  if (raw.length % 4 === 1) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of raw) {
    const value = BASE64URL_ALPHABET.indexOf(char);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  // 尾部残留位必须为 0：拒绝被篡改的填充位（同一载荷只有一种合法写法）
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) return null;
  let output = "";
  for (const byte of bytes) output += String.fromCharCode(byte);
  return output;
}

/** FNV-1a 32 位：码哈希与校验位共用（稳定、无碰撞风险的短散列）。 */
export function challengeDigest(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function checksumFor(payload: string): string {
  return challengeDigest(payload).toString(36).padStart(7, "0").slice(-4);
}

/** 剥离外壳：接受裸码 / `#c=码` / 带查询串的整条链接；只取码本身。 */
function extractCode(input: string): string {
  const fragment = input.indexOf("#c=");
  if (fragment >= 0)
    return input
      .slice(fragment + 3)
      .split("&")[0]
      .trim();
  const query = input.match(/[?&]c=/);
  if (query?.index !== undefined && query.index >= 0) {
    const start = query.index + query[0].length;
    return input.slice(start).split("&")[0].split("#")[0].trim();
  }
  return input;
}

/** 紧凑 JSON：字段顺序固定 ⇒ 同一 bundle 必得同一码（编码确定性）。 */
function compactPayload(bundle: ChallengeBundle): string {
  const parts = [
    `"v":${CHALLENGE_FORMAT}`,
    `"m":"${bundle.mode}"`,
    `"a":${bundle.act}`,
    `"s":${bundle.seed}`,
    `"r":"${bundle.ruleset}"`
  ];
  for (const key of CHALLENGE_VERSION_KEYS) {
    if (bundle[key] === 1) parts.push(`"${VERSION_FIELD[key]}":1`);
  }
  if (bundle.character) parts.push(`"ch":"${bundle.character}"`);
  if (bundle.dateKey) parts.push(`"d":"${bundle.dateKey}"`);
  if (bundle.mutators?.length) parts.push(`"mu":["${bundle.mutators.join('","')}"]`);
  if (bundle.adaptiveBoost) parts.push(`"ab":${bundle.adaptiveBoost}`);
  return `{${parts.join(",")}}`;
}

// ─── 校验 ────────────────────────────────────────────────────────────────────

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYLOAD_KEYS = new Set([
  "v",
  "m",
  "a",
  "s",
  "r",
  "b",
  "e",
  "c",
  "n",
  "u",
  "f",
  "ch",
  "d",
  "mu",
  "ab"
]);

function reject(reason: ChallengeRejectionReason, detail: string): ChallengeRejection {
  return { ok: false, reason, detail };
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * 语义校验（编码与解码共用）：范围、模式互斥、版本束门控、内容世代重算。
 * 返回 null = 合法。
 */
export function validateChallengeBundle(bundle: ChallengeBundle): ChallengeRejection | null {
  if (!CHALLENGE_MODES.includes(bundle.mode)) {
    return reject("malformed", `未知模式 ${String(bundle.mode)}`);
  }
  if (!isInteger(bundle.act) || bundle.act < 1 || bundle.act > ACT_COUNT) {
    return reject("malformed", `幕号 ${String(bundle.act)} 超出 1–${ACT_COUNT}`);
  }
  if (!isInteger(bundle.seed) || bundle.seed < 0 || bundle.seed > 0xffffffff) {
    return reject("malformed", `种子 ${String(bundle.seed)} 超出 0–4294967295`);
  }
  if (bundle.ruleset !== "legacy" && bundle.ruleset !== "p7") {
    return reject("malformed", `未知规则集 ${String(bundle.ruleset)}`);
  }
  if (bundle.mode !== "campaign" && bundle.act !== 1) {
    return reject("malformed", "只有战役码携带幕号");
  }
  if (bundle.mode === "classic" && bundle.ruleset !== "legacy") {
    return reject("malformed", "经典十层只走 legacy 规则集");
  }
  if (
    isInteger(bundle.adaptiveBoost) &&
    (bundle.adaptiveBoost < -100 || bundle.adaptiveBoost > 100)
  ) {
    return reject("malformed", `自适应加成 ${bundle.adaptiveBoost} 超出 ±100`);
  }
  if (bundle.adaptiveBoost !== undefined && !isInteger(bundle.adaptiveBoost)) {
    return reject("malformed", "自适应加成必须是整数百分点");
  }

  for (const key of CHALLENGE_VERSION_KEYS) {
    const value = bundle[key];
    if (value === undefined) continue;
    if (value !== 1) {
      // 将来版本的码：本引擎无法保证同局，明确拒绝而不是当作 1 处理
      return reject("unsupported", `版本束 ${key}=${String(value)} 不被本引擎支持`);
    }
    if (bundle.mode !== "campaign" || bundle.ruleset !== "p7") {
      return reject("malformed", `${key} 版本束只在 p7 战役码中生效`);
    }
  }

  if (bundle.character !== undefined) {
    if (!bundle.roster || bundle.mode !== "campaign") {
      return reject("malformed", "角色只在携带名伶版本束的战役码中生效");
    }
    if (!lookupCharacter(bundle.character)) {
      return reject("malformed", `未知角色 ${String(bundle.character)}`);
    }
  }

  if (bundle.dateKey !== undefined) {
    if (bundle.mode !== "daily") return reject("malformed", "日期键只属于每日挑战码");
    if (!DATE_KEY_PATTERN.test(bundle.dateKey)) {
      return reject("malformed", `日期键 ${bundle.dateKey} 应为 YYYY-MM-DD`);
    }
  }
  if (bundle.mode === "daily") {
    if (!bundle.dateKey) return reject("malformed", "每日挑战码缺少日期键");
    // 种子必须与日期键一致，否则「同一天的挑战」名不副实
    if (dailySeedForKey(bundle.dateKey) !== bundle.seed) {
      return reject("mismatch", "码内种子与该日期的每日挑战种子不符");
    }
  }

  if (bundle.mutators !== undefined) {
    if (bundle.mode === "campaign" || bundle.mode === "classic") {
      return reject("malformed", "战役/经典码不含词缀");
    }
    for (const id of bundle.mutators) {
      if (!MUTATORS.some((entry) => entry.id === id)) return reject("malformed", `未知词缀 ${id}`);
    }
    const expected = selectMutators(bundle.seed, 0);
    if (bundle.mutators.join("|") !== expected.join("|")) {
      // 内容世代重算不符：同码在本机无法复现，必须拒绝
      return reject(
        "mismatch",
        `码内词缀（${bundle.mutators.join("、")}）与本机内容世代重算（${expected.join("、")}）不符`
      );
    }
  }

  return null;
}

// ─── 解码 ────────────────────────────────────────────────────────────────────

function readBundle(payload: string): { bundle: ChallengeBundle } | ChallengeRejection {
  const json = asciiFromBase64url(payload);
  if (json === null)
    return reject("malformed", "载荷不是合法 base64url（含非法字符或填充位被改写）");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return reject("malformed", "载荷不是合法 JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return reject("malformed", "载荷不是对象");
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!PAYLOAD_KEYS.has(key)) return reject("malformed", `码内含未知字段 ${key}`);
  }
  if (!isInteger(record.v)) return reject("malformed", "缺少格式版本 v");
  if (record.v !== CHALLENGE_FORMAT) {
    return reject("unsupported", `码格式 v${record.v} 不被本引擎支持（本机 v${CHALLENGE_FORMAT}）`);
  }
  if (typeof record.m !== "string" || !CHALLENGE_MODES.includes(record.m as ChallengeMode)) {
    return reject("malformed", `未知模式 ${String(record.m)}`);
  }
  if (!isInteger(record.a) || !isInteger(record.s)) {
    return reject("malformed", "幕号或种子不是整数");
  }
  if (typeof record.r !== "string" || (record.r !== "legacy" && record.r !== "p7")) {
    return reject("malformed", `未知规则集 ${String(record.r)}`);
  }
  const bundle: ChallengeBundle = {
    mode: record.m as ChallengeMode,
    act: record.a,
    seed: record.s,
    ruleset: record.r as ContentRuleset
  };
  for (const key of CHALLENGE_VERSION_KEYS) {
    const value = record[VERSION_FIELD[key]];
    if (value === undefined) continue;
    if (typeof value !== "number") return reject("malformed", `版本束 ${key} 不是数字`);
    bundle[key] = value as 1;
  }
  if (record.ch !== undefined) {
    if (typeof record.ch !== "string") return reject("malformed", "角色不是字符串");
    bundle.character = record.ch as CharacterId;
  }
  if (record.d !== undefined) {
    if (typeof record.d !== "string") return reject("malformed", "日期键不是字符串");
    bundle.dateKey = record.d;
  }
  if (record.mu !== undefined) {
    if (!Array.isArray(record.mu) || record.mu.some((entry) => typeof entry !== "string")) {
      return reject("malformed", "词缀不是字符串数组");
    }
    bundle.mutators = record.mu as string[];
  }
  if (record.ab !== undefined) {
    if (!isInteger(record.ab)) return reject("malformed", "自适应加成不是整数");
    bundle.adaptiveBoost = record.ab;
  }
  return { bundle };
}

/** 解析切磋码（零副作用）：畸形/不支持/内容世代不符都走 ok:false。 */
export function decodeChallenge(input: string): ChallengeDecodeResult {
  if (typeof input !== "string") return reject("malformed", "切磋码必须是字符串");
  const trimmed = input.trim();
  if (!trimmed) return reject("malformed", "切磋码为空");
  if (trimmed.length > CHALLENGE_MAX_LENGTH) {
    return reject("malformed", `切磋码超长（${trimmed.length} > ${CHALLENGE_MAX_LENGTH}）`);
  }
  const normalized = extractCode(trimmed);
  const segments = normalized.split(".");
  if (segments.length !== 3) {
    return reject("malformed", "码结构应为 VT1.<载荷>.<校验位>");
  }
  const [prefix, payload, checksum] = segments;
  if (prefix !== CHALLENGE_PREFIX) {
    return reject("unsupported", `未知码前缀 ${prefix}（本机支持 ${CHALLENGE_PREFIX}）`);
  }
  if (payload.length === 0) return reject("malformed", "载荷为空");
  if (!/^[A-Za-z0-9_-]{4}$/.test(checksum) || checksumFor(payload) !== checksum) {
    return reject("malformed", "校验位不符（码可能被截断、抄错或改动过）");
  }
  const parsed = readBundle(payload);
  if ("ok" in parsed) return parsed;
  const problem = validateChallengeBundle(parsed.bundle);
  if (problem) return problem;
  const code = `${prefix}.${payload}.${checksum}`;
  const hash = challengeHash(code);
  return {
    ok: true,
    code,
    payload,
    hash,
    challenge: { ...parsed.bundle, code, hash }
  };
}

/** 编码切磋码（自校验；非法 bundle 直接拒绝，绝不产出无法复现的码）。 */
export function encodeChallenge(bundle: ChallengeBundle): ChallengeEncodeResult {
  const problem = validateChallengeBundle(bundle);
  if (problem) return problem;
  const payload = base64urlFromAscii(compactPayload(bundle));
  if (payload === null) return reject("malformed", "码只支持 ASCII 载荷（内容 id 必须为 ASCII）");
  const code = `${CHALLENGE_PREFIX}.${payload}.${checksumFor(payload)}`;
  if (code.length > CHALLENGE_MAX_LENGTH) {
    return reject("malformed", `生成的码超长（${code.length} > ${CHALLENGE_MAX_LENGTH}）`);
  }
  return { ok: true, code, payload, hash: challengeHash(code) };
}

/** 码哈希（战绩簿键）：同码不同书写形式（空白/链接外壳）归一后同键。 */
export function challengeHash(code: string): string {
  const normalized = extractCode(code.trim());
  return challengeDigest(normalized).toString(16).padStart(8, "0");
}

// ─── 从状态产出码 / 展示文案 ─────────────────────────────────────────────────

/** challengeFromRun 只需读取这些字段（结构化入参，便于单测构造）。 */
export interface PassThroughState {
  seed: number;
  ruleset?: ContentRuleset;
  endless?: boolean;
  adaptiveBoost?: number;
  buildVersion?: 1;
  encounterVersion?: 1;
  counterVersion?: 1;
  rosterVersion?: 1;
  ultimateVersion?: 1;
  characterId?: CharacterId;
  challenge?: { mode: "daily" | "endless"; seed: number; dateKey?: string } | null;
  campaign?: { act: number; map: { seed: number } } | null;
}

/**
 * 从当前局反推切磋码内容（结算屏「发起切磋」用）。
 * 只读取本局身份字段，不读取任何玩家数据；无法成码的局面（无身份）返回 null。
 */
export function challengeFromRun(state: PassThroughState): ChallengeBundle | null {
  const ruleset: ContentRuleset = state.ruleset === "p7" ? "p7" : "legacy";
  const boost = Math.round((state.adaptiveBoost ?? 0) * 100);
  const withBoost = (bundle: ChallengeBundle): ChallengeBundle =>
    boost === 0 ? bundle : { ...bundle, adaptiveBoost: boost };

  if (state.challenge?.mode === "daily" && state.challenge.dateKey) {
    return withBoost({
      mode: "daily",
      act: 1,
      seed: state.challenge.seed,
      ruleset: "p7",
      dateKey: state.challenge.dateKey,
      mutators: selectMutators(state.challenge.seed, 0)
    });
  }
  if (state.endless) {
    const seed = state.challenge?.seed ?? state.seed;
    return withBoost({
      mode: "endless",
      act: 1,
      seed,
      ruleset,
      mutators: selectMutators(seed, 0)
    });
  }
  if (state.campaign) {
    const bundle: ChallengeBundle = {
      mode: "campaign",
      act: state.campaign.act,
      seed: state.campaign.map.seed,
      ruleset
    };
    if (ruleset === "p7") {
      if (state.buildVersion === 1) bundle.build = 1;
      if (state.encounterVersion === 1) bundle.encounter = 1;
      if (state.counterVersion === 1) bundle.counter = 1;
      if (state.rosterVersion === 1) bundle.roster = 1;
      if (state.ultimateVersion === 1) bundle.ultimate = 1;
      if (state.characterId) bundle.character = state.characterId;
    }
    return withBoost(bundle);
  }
  return withBoost({ mode: "classic", act: 1, seed: state.seed, ruleset: "legacy" });
}

/** 版本束标签（UI 契约卡/横幅）：一眼看清这局按哪几期规则跑。 */
export function challengeVersionLabel(bundle: ChallengeBundle): string {
  const parts: string[] = [bundle.ruleset === "p7" ? "三幕深耕" : "经典规则"];
  if (bundle.build) parts.push("构筑 v1");
  if (bundle.encounter) parts.push("对手进化 v1");
  if (bundle.counter) parts.push("守势反击 v1");
  if (bundle.roster) parts.push("名伶 v1");
  if (bundle.ultimate) parts.push("绝技 v1");
  const character = bundle.character ? lookupCharacter(bundle.character) : undefined;
  if (character) parts.push(character.name);
  for (const mutator of mutationList(bundle.mutators))
    parts.push(`${mutator.name}（${mutator.kind === "pressure" ? "试炼" : "助力"}）`);
  return parts.join(" · ");
}

/** 难度标签：切磋局不读本机自适应节律，难度由码决定（同码同难）。 */
export function challengeDifficultyLabel(bundle: ChallengeBundle): string {
  const boost = bundle.adaptiveBoost ?? 0;
  if (boost === 0) return "难度：无自适应加成";
  return `难度：随码携带 ${boost > 0 ? "+" : ""}${boost}% 自适应加成`;
}

/** 模式标签（UI 处处一致）。 */
export function challengeModeLabel(bundle: ChallengeBundle, floor = 0): string {
  if (bundle.mode === "daily") return `每日挑战 ${bundle.dateKey ?? ""}`.trim();
  if (bundle.mode === "endless") return `无尽塔${floor ? ` 第 ${floor} 层` : ""}`;
  if (bundle.mode === "classic") return "经典十层";
  return `第${ACT_NUMERALS[bundle.act - 1]}幕战役`;
}

export interface ChallengeShareInput {
  mode: ChallengeMode;
  act: number;
  floor: number;
  stars?: number;
  averageScore: number;
  victory: boolean;
  character?: CharacterId;
}

/** 无剧透战绩行（wordle 风格）：只有幕/层/★/声韵/角色，不含路线、牌组与敌人。 */
export function challengeShareLine(input: ChallengeShareInput): string {
  const head =
    input.mode === "classic"
      ? `经典十层 ${input.victory ? "通关" : `止步第 ${input.floor} 层`}`
      : input.mode === "endless"
        ? `无尽塔第 ${input.floor} 层`
        : input.mode === "daily"
          ? `每日挑战${input.victory ? "通关" : `止步第 ${input.floor} 层`}`
          : `${ACT_NUMERALS[input.act - 1]}幕${input.victory ? "通关" : `止步第 ${input.floor} 层`}`;
  const stars = Math.max(0, Math.min(3, Math.round(input.stars ?? 0)));
  const character = input.character ? lookupCharacter(input.character) : undefined;
  const parts = [`声震龙楼 · ${head}`];
  if (stars > 0) parts.push("★".repeat(stars));
  parts.push(`声韵均值 ${Math.round(input.averageScore)}`);
  parts.push(input.victory ? "🐉" : "🪶");
  if (character) parts.push(character.name);
  return parts.join(" · ");
}

/** 战绩簿记录（结算时写入；战绩簿只是本机最佳，无云端、无排行榜）。 */
export function challengeRecordFor(
  run: ChallengeRun,
  result: { floor: number; victory: boolean; averageScore: number },
  finishedAt: string
): ChallengeRecord {
  return {
    hash: run.hash,
    code: run.code,
    mode: run.mode,
    act: run.act,
    character: run.character,
    floor: result.floor,
    victory: result.victory,
    averageScore: Math.round(result.averageScore),
    finishedAt
  };
}

/** 同码战绩比较：通关 > 楼层 > 声韵（与每日挑战同一比较器语义）。 */
export function compareChallengeRecords(a: ChallengeRecord, b: ChallengeRecord): number {
  if (a.victory !== b.victory) return a.victory ? 1 : -1;
  if (a.floor !== b.floor) return a.floor - b.floor;
  return a.averageScore - b.averageScore;
}
