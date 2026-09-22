/**
 * P15 铸剑炉 · 属性测试：切磋码编解码。
 *
 * 不变量（GROWTH-PLAN §7.1）：
 * 1) 任意合法 bundle：`decode(encode(b))` 与原 bundle 逐位恒等（含哈希稳定）；
 * 2) 任意字符串（畸形/截断/非 ASCII/超长/伪前缀）：解码**不抛异常**，
 *    要么 `ok:false`（带理由），要么合法结果——零副作用（连跑两次结果一致）；
 * 3) 成功编码的码长 ≤ `CHALLENGE_MAX_LENGTH`；
 * 4) 合法码的任意前缀截断同样不抛异常（分享场景常被截断）。
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  CHALLENGE_MAX_LENGTH,
  type ChallengeBundle,
  decodeChallenge,
  encodeChallenge
} from "../../src/core/challenge";
import { CHARACTERS } from "../../src/core/content/roster";
import { dailySeedForKey } from "../../src/core/daily";
import { selectMutators } from "../../src/core/mutators";

const CHARACTER_IDS = CHARACTERS.map((entry) => entry.id);
/** 码内自适应加成为整数百分点；0 不写入码（等价缺省），生成器避开以保恒等干净。 */
const adaptiveBoostArb = fc.oneof(
  fc.constant(undefined),
  fc.integer({ min: -100, max: -1 }),
  fc.integer({ min: 1, max: 100 })
);

const versionFlagsArb = fc.record({
  build: fc.boolean(),
  encounter: fc.boolean(),
  counter: fc.boolean(),
  roster: fc.boolean(),
  ultimate: fc.boolean(),
  forge: fc.boolean()
});

/** p7 战役码：可带版本束与角色（角色仅随名伶束）。 */
const campaignArb: fc.Arbitrary<ChallengeBundle> = fc
  .record({
    act: fc.integer({ min: 1, max: 3 }),
    p7: fc.boolean(),
    flags: versionFlagsArb,
    withCharacter: fc.boolean(),
    adaptiveBoost: adaptiveBoostArb
  })
  .map(({ act, p7, flags, withCharacter, adaptiveBoost }) => {
    const bundle: ChallengeBundle = {
      mode: "campaign",
      act,
      seed: 0,
      ruleset: p7 ? "p7" : "legacy",
      adaptiveBoost
    };
    if (p7) {
      if (flags.build) bundle.build = 1;
      if (flags.encounter) bundle.encounter = 1;
      if (flags.counter) bundle.counter = 1;
      if (flags.roster) bundle.roster = 1;
      if (flags.ultimate) bundle.ultimate = 1;
      if (flags.forge) bundle.forge = 1;
      if (flags.roster && withCharacter) {
        bundle.character = CHARACTER_IDS[act % CHARACTER_IDS.length];
      }
    }
    return bundle;
  })
  .chain((bundle) => fc.integer({ min: 0, max: 0xffffffff }).map((seed) => ({ ...bundle, seed })));

/**
 * 无尽码：词缀必须与本机内容世代重算一致（`selectMutators(seed, 0)`），
 * 不能任意生成——这正是「同码同局」的校验内容。
 */
const endlessArb: fc.Arbitrary<ChallengeBundle> = fc
  .record({ p7: fc.boolean(), adaptiveBoost: adaptiveBoostArb })
  .chain(({ p7, adaptiveBoost }) =>
    fc.integer({ min: 0, max: 0xffffffff }).map((seed) => ({
      mode: "endless" as const,
      act: 1,
      seed,
      ruleset: p7 ? ("p7" as const) : ("legacy" as const),
      mutators: selectMutators(seed, 0),
      adaptiveBoost
    }))
  );

const dateKeyArb = fc
  .record({
    year: fc.integer({ min: 2024, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 })
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  );

const dailyArb: fc.Arbitrary<ChallengeBundle> = dateKeyArb.map((dateKey) => ({
  mode: "daily",
  act: 1,
  seed: dailySeedForKey(dateKey),
  ruleset: "legacy",
  dateKey
}));

/** 经典十层：只走 legacy，无束无缀。 */
const classicArb: fc.Arbitrary<ChallengeBundle> = fc
  .integer({ min: 0, max: 0xffffffff })
  .map((seed) => ({ mode: "classic" as const, act: 1, seed, ruleset: "legacy" as const }));

const bundleArb = fc.oneof(campaignArb, endlessArb, dailyArb, classicArb);

describe("属性：切磋码 编码∘解码 = 恒等", () => {
  test("任意合法 bundle 往返逐位一致，码长不超上限", () => {
    fc.assert(
      fc.property(bundleArb, (bundle) => {
        const encoded = encodeChallenge(bundle);
        expect(encoded.ok).toBe(true);
        if (!encoded.ok) return;
        expect(encoded.code.length).toBeLessThanOrEqual(CHALLENGE_MAX_LENGTH);
        const decoded = decodeChallenge(encoded.code);
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;
        const got = decoded.challenge;
        expect(got.mode).toBe(bundle.mode);
        expect(got.act).toBe(bundle.act);
        expect(got.seed).toBe(bundle.seed);
        expect(got.ruleset).toBe(bundle.ruleset);
        for (const key of [
          "build",
          "encounter",
          "counter",
          "roster",
          "ultimate",
          "forge"
        ] as const) {
          expect(got[key]).toBe(bundle[key]);
        }
        expect(got.character).toBe(bundle.character);
        expect(got.dateKey).toBe(bundle.dateKey);
        expect(got.mutators ?? []).toEqual(bundle.mutators ?? []);
        expect(got.adaptiveBoost ?? 0).toBe(bundle.adaptiveBoost ?? 0);
        // 哈希稳定：同一码再编码哈希不变（战绩簿键不漂移）
        const reEncoded = encodeChallenge({ ...bundle });
        expect(reEncoded.ok).toBe(true);
        if (reEncoded.ok) expect(reEncoded.hash).toBe(encoded.hash);
      }),
      { numRuns: 200 }
    );
  });

  test("同一 bundle 编码两次得同一码（紧凑 JSON 字段序固定）", () => {
    fc.assert(
      fc.property(bundleArb, (bundle) => {
        const a = encodeChallenge(bundle);
        const b = encodeChallenge({ ...bundle });
        expect(a).toEqual(b);
      }),
      { numRuns: 100 }
    );
  });
});

describe("属性：切磋码 畸形输入零副作用", () => {
  // fast-check v4：字符串统一走 `fc.string({ unit })`；binary 单元覆盖任意码点
  const garbageArb = fc.oneof(
    fc.string(),
    fc.string({ unit: "binary" }),
    fc.string({ unit: "grapheme" }),
    fc.constant(""),
    fc.constant("VT1."),
    fc.constant("VT1.eyJ2IjoxfQ."),
    fc.string().map((body) => `VT1.${body}.zz`),
    fc.string().map((body) => `https://example.com/#c=VT1.${body}`)
  );

  test("任意字符串解码不抛异常、结果自洽、跑两次一致（纯函数）", () => {
    fc.assert(
      fc.property(garbageArb, (raw) => {
        const first = decodeChallenge(raw);
        const second = decodeChallenge(raw);
        expect(second).toEqual(first);
        if (first.ok) {
          // 侥幸解析成功也必须是结构完整的挑战（并可直接再编码回同一码）
          expect(typeof first.challenge.seed).toBe("number");
          const reEncoded = encodeChallenge(first.challenge);
          expect(reEncoded.ok).toBe(true);
          if (reEncoded.ok) expect(reEncoded.code).toBe(first.code);
        } else {
          expect(["malformed", "unsupported", "mismatch"]).toContain(first.reason);
          expect(first.detail.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 300 }
    );
  });

  test("合法码的任意前缀截断不抛异常（链接被截断的分享场景）", () => {
    fc.assert(
      fc.property(bundleArb, fc.integer({ min: 0, max: CHALLENGE_MAX_LENGTH }), (bundle, cut) => {
        const encoded = encodeChallenge(bundle);
        if (!encoded.ok) return;
        const truncated = encoded.code.slice(0, Math.min(cut, encoded.code.length));
        expect(() => decodeChallenge(truncated)).not.toThrow();
      }),
      { numRuns: 150 }
    );
  });
});
