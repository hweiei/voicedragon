import { describe, expect, test } from "vitest";
import {
  CHALLENGE_FORMAT,
  CHALLENGE_MAX_LENGTH,
  type ChallengeBundle,
  challengeDifficultyLabel,
  challengeDigest,
  challengeFromRun,
  challengeHash,
  challengeModeLabel,
  challengeRecordFor,
  challengeShareLine,
  challengeVersionLabel,
  compareChallengeRecords,
  decodeChallenge,
  encodeChallenge
} from "../../src/core/challenge";
import { dailySeedForKey } from "../../src/core/daily";
import { selectMutators } from "../../src/core/mutators";

const DAILY_KEY = "2026-09-20";
const DAILY_SEED = dailySeedForKey(DAILY_KEY);

/** 测试侧用 Node Buffer 复刻载荷编码（交叉验证：两套实现必须逐位一致）。 */
function forge(json: string, prefix = "VT1"): string {
  const payload = Buffer.from(json, "ascii").toString("base64url");
  return `${prefix}.${payload}.${challengeDigest(payload).toString(36).padStart(7, "0").slice(-4)}`;
}

const CAMPAIGN_FULL: ChallengeBundle = {
  mode: "campaign",
  act: 2,
  seed: 123456789,
  ruleset: "p7",
  build: 1,
  encounter: 1,
  counter: 1,
  roster: 1,
  ultimate: 1,
  character: "faa-daan"
};

describe("P12 切磋码 · 编解码", () => {
  test("编码∘解码恒等：四种模式与版本束组合", () => {
    const bundles: ChallengeBundle[] = [
      { mode: "campaign", act: 1, seed: 0, ruleset: "legacy" },
      CAMPAIGN_FULL,
      { mode: "campaign", act: 3, seed: 4294967295, ruleset: "p7", build: 1 },
      {
        mode: "endless",
        act: 1,
        seed: 777,
        ruleset: "p7",
        mutators: selectMutators(777, 0)
      },
      {
        mode: "endless",
        act: 1,
        seed: 42,
        ruleset: "legacy",
        adaptiveBoost: -8
      },
      {
        mode: "daily",
        act: 1,
        seed: DAILY_SEED,
        ruleset: "p7",
        dateKey: DAILY_KEY,
        mutators: selectMutators(DAILY_SEED, 0)
      },
      { mode: "classic", act: 1, seed: 9, ruleset: "legacy" }
    ];
    for (const bundle of bundles) {
      const encoded = encodeChallenge(bundle);
      expect(encoded.ok).toBe(true);
      if (!encoded.ok) continue;
      const decoded = decodeChallenge(encoded.code);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) continue;
      const { code, hash, ...rest } = decoded.challenge;
      expect(code).toBe(encoded.code);
      expect(hash).toBe(encoded.hash);
      expect(rest).toEqual(bundle);
      // 再编码一次必须逐位一致（编码确定性）
      expect(encodeChallenge(rest)).toEqual(encoded);
    }
  });

  test("载荷格式锁定：紧凑 JSON 字段顺序固定，长度在预算内", () => {
    const encoded = encodeChallenge(CAMPAIGN_FULL);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const json = Buffer.from(encoded.payload, "base64url").toString("ascii");
    expect(json).toBe(
      '{"v":1,"m":"campaign","a":2,"s":123456789,"r":"p7","b":1,"e":1,"c":1,"n":1,"u":1,"ch":"faa-daan"}'
    );
    expect(encoded.code.length).toBeLessThan(CHALLENGE_MAX_LENGTH);
    expect(CHALLENGE_FORMAT).toBe(1);
  });

  test("接受整条链接与带空白的码（宽容接收，严格校验）", () => {
    const encoded = encodeChallenge(CAMPAIGN_FULL);
    if (!encoded.ok) throw new Error("编码失败");
    const forms = [
      encoded.code,
      `  ${encoded.code}  `,
      `#c=${encoded.code}`,
      `https://example.com/voicedragon/#c=${encoded.code}`,
      `https://example.com/voicedragon/?c=${encoded.code}&from=share`,
      `#c=${encoded.code}&utm=x`
    ];
    for (const form of forms) {
      const decoded = decodeChallenge(form);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(decoded.code).toBe(encoded.code);
    }
    // 归一化后哈希一致 ⇒ 战绩簿不会因书写形式不同而分裂
    expect(challengeHash(forms[3])).toBe(encoded.hash);
    expect(challengeHash(`#c=${encoded.code}`)).toBe(encoded.hash);
  });
});

describe("P12 切磋码 · 拒绝路径（零副作用）", () => {
  const malformedCases: Array<[string, string]> = [
    ["空串", ""],
    ["全空白", "   "],
    ["非字符串", 42 as unknown as string],
    ["缺段", "VT1.abcdef"],
    ["多段", "VT1.abcdef.ghij.kl"],
    ["非 ASCII", "VT1.你好.あいう"],
    ["非法 base64url 字符", "VT1.abc$efg.zzzz"],
    ["校验位长度不对", "VT1.abcdef.zz"],
    ["校验位不符", "VT1.abcdef.zzzz"],
    ["载荷为空", "VT1..zzzz"]
  ];
  test.each(malformedCases)("malformed：%s", (_label, input) => {
    const result = decodeChallenge(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  test("malformed：前缀不符归 unsupported（本机只认 VT1）", () => {
    const result = decodeChallenge(forge('{"v":1,"m":"classic","a":1,"s":9,"r":"legacy"}', "VT2"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unsupported");
  });

  test("unsupported：码格式版本与版本束数值", () => {
    const futureFormat = decodeChallenge(forge('{"v":2,"m":"classic","a":1,"s":9,"r":"legacy"}'));
    expect(futureFormat.ok).toBe(false);
    if (!futureFormat.ok) expect(futureFormat.reason).toBe("unsupported");

    const futureVersion = decodeChallenge(
      forge('{"v":1,"m":"campaign","a":1,"s":9,"r":"p7","b":2}')
    );
    expect(futureVersion.ok).toBe(false);
    if (!futureVersion.ok) expect(futureVersion.reason).toBe("unsupported");
  });

  test("malformed：字段类型、范围与互斥规则", () => {
    const cases: string[] = [
      '{"v":1,"m":"campaign","a":9,"s":9,"r":"p7"}', // 幕越界
      '{"v":1,"m":"campaign","a":1,"s":-1,"r":"p7"}', // 种子为负
      '{"v":1,"m":"campaign","a":1,"s":4294967296,"r":"p7"}', // 种子越界
      '{"v":1,"m":"campaign","a":1,"s":9,"r":"p8"}', // 未知规则集
      '{"v":1,"m":"arena","a":1,"s":9,"r":"p7"}', // 未知模式
      '{"v":1,"m":"endless","a":2,"s":9,"r":"p7"}', // 非战役码带幕号
      '{"v":1,"m":"classic","a":1,"s":9,"r":"p7"}', // 经典只能 legacy
      '{"v":1,"m":"classic","a":1,"s":9,"r":"legacy","b":1}', // 版本束只在 p7 战役
      '{"v":1,"m":"endless","a":1,"s":9,"r":"p7","b":1}', // 无尽不带版本束
      '{"v":1,"m":"campaign","a":1,"s":9,"r":"p7","ch":"man-mou-saang"}', // 角色缺名伶版本
      '{"v":1,"m":"campaign","a":1,"s":9,"r":"p7","n":1,"ch":"unknown-actor"}', // 未知角色
      '{"v":1,"m":"campaign","a":1,"s":9,"r":"p7","d":"2026-09-20"}', // 日期键只属每日
      '{"v":1,"m":"daily","a":1,"s":9,"r":"p7"}', // 每日缺日期键
      '{"v":1,"m":"campaign","a":1,"s":9,"r":"p7","mu":["ironcoat","fierce"]}', // 战役不含词缀
      '{"v":1,"m":"endless","a":1,"s":9,"r":"p7","mu":["nope","fierce"]}', // 未知词缀
      '{"v":1,"m":"endless","a":1,"s":9,"r":"p7","ab":7.5}', // 自适应加成非整数
      '{"v":1,"m":"endless","a":1,"s":9,"r":"p7","ab":999}', // 自适应加成越界
      '{"v":1,"m":"endless","a":1,"s":9,"r":"p7","extra":1}', // 未知字段（隐私白名单）
      '{"v":1,"m":"endless","a":1,"s":9,"r":"p7","mu":"ironcoat"}', // 词缀类型错误
      "[]"
    ];
    for (const json of cases) {
      const result = decodeChallenge(forge(json));
      expect(result.ok, json).toBe(false);
      if (!result.ok) expect(result.reason, json).toBe("malformed");
    }
  });

  test("malformed：载荷是合法 base64url 但不是合法 JSON", () => {
    const payload = Buffer.from("{not json", "ascii").toString("base64url");
    const code = `VT1.${payload}.${challengeDigest(payload).toString(36).padStart(7, "0").slice(-4)}`;
    const result = decodeChallenge(code);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  test("mismatch：内容世代重算不符（词缀 / 每日种子）", () => {
    const wrongMutators = decodeChallenge(
      forge('{"v":1,"m":"endless","a":1,"s":777,"r":"p7","mu":["ironcoat","fierce"]}')
    );
    expect(wrongMutators.ok).toBe(false);
    if (!wrongMutators.ok) {
      expect(wrongMutators.reason).toBe("mismatch");
      expect(wrongMutators.detail).toContain("内容世代");
    }

    const wrongDailySeed = decodeChallenge(
      forge(`{"v":1,"m":"daily","a":1,"s":123,"r":"p7","d":"${DAILY_KEY}"}`)
    );
    expect(wrongDailySeed.ok).toBe(false);
    if (!wrongDailySeed.ok) expect(wrongDailySeed.reason).toBe("mismatch");
  });

  test("零副作用：解码不抛异常、不改动入参；编码不改动 bundle", () => {
    const bundle: ChallengeBundle = { ...CAMPAIGN_FULL, mutators: undefined };
    const snapshot = JSON.stringify(bundle);
    const frozen = Object.freeze({ ...bundle });
    expect(() => encodeChallenge(frozen)).not.toThrow();
    const encoded = encodeChallenge(bundle);
    expect(JSON.stringify(bundle)).toBe(snapshot);

    const code = encoded.ok ? encoded.code : "";
    const broken = `${code.slice(0, -1)}X`;
    expect(() => decodeChallenge(broken)).not.toThrow();
    expect(() => decodeChallenge("VT1.###.###")).not.toThrow();
    expect(code).toBe(encoded.ok ? encoded.code : "");
    expect(decodeChallenge(code).ok).toBe(true);
  });
});

describe("P12 切磋码 · 展示与战绩簿（纯函数）", () => {
  test("版本束标签与难度标签", () => {
    expect(challengeVersionLabel(CAMPAIGN_FULL)).toBe(
      "三幕深耕 · 构筑 v1 · 对手进化 v1 · 守势反击 v1 · 名伶 v1 · 绝技 v1 · 花旦"
    );
    const endless: ChallengeBundle = {
      mode: "endless",
      act: 1,
      seed: 777,
      ruleset: "p7",
      mutators: selectMutators(777, 0),
      adaptiveBoost: 5
    };
    expect(challengeVersionLabel(endless)).toContain("三幕深耕");
    expect(challengeDifficultyLabel(endless)).toBe("难度：随码携带 +5% 自适应加成");
    expect(challengeDifficultyLabel({ mode: "classic", act: 1, seed: 1, ruleset: "legacy" })).toBe(
      "难度：无自适应加成"
    );
    expect(challengeModeLabel({ mode: "campaign", act: 2, seed: 1, ruleset: "p7" })).toBe(
      "第二幕战役"
    );
    expect(
      challengeModeLabel({ mode: "daily", act: 1, seed: 1, ruleset: "p7", dateKey: DAILY_KEY })
    ).toBe(`每日挑战 ${DAILY_KEY}`);
    expect(challengeModeLabel({ mode: "endless", act: 1, seed: 1, ruleset: "p7" }, 12)).toBe(
      "无尽塔 第 12 层"
    );
  });

  test("战绩行：无剧透、★钳制、含角色名", () => {
    expect(
      challengeShareLine({
        mode: "campaign",
        act: 2,
        floor: 12,
        stars: 3,
        averageScore: 84.4,
        victory: true,
        character: "man-mou-saang"
      })
    ).toBe("声震龙楼 · 二幕通关 · ★★★ · 声韵均值 84 · 🐉 · 文武生");
    expect(
      challengeShareLine({
        mode: "campaign",
        act: 1,
        floor: 7,
        stars: 9,
        averageScore: 61.6,
        victory: false
      })
    ).toBe("声震龙楼 · 一幕止步第 7 层 · ★★★ · 声韵均值 62 · 🪶");
    expect(
      challengeShareLine({ mode: "endless", act: 1, floor: 23, averageScore: 70, victory: false })
    ).toBe("声震龙楼 · 无尽塔第 23 层 · 声韵均值 70 · 🪶");
    expect(
      challengeShareLine({ mode: "classic", act: 1, floor: 10, averageScore: 88, victory: true })
    ).toBe("声震龙楼 · 经典十层 通关 · 声韵均值 88 · 🐉");
  });

  test("challengeFromRun：四种模式反推，字段完整", () => {
    expect(
      challengeFromRun({
        seed: 4242,
        ruleset: "p7",
        buildVersion: 1,
        encounterVersion: 1,
        counterVersion: 1,
        rosterVersion: 1,
        ultimateVersion: 1,
        characterId: "faa-daan",
        campaign: { act: 2, map: { seed: 4242 } }
      })
    ).toEqual({ ...CAMPAIGN_FULL, seed: 4242 });

    expect(
      challengeFromRun({ seed: 5, endless: true, challenge: { mode: "endless", seed: 5 } })
    ).toEqual({
      mode: "endless",
      act: 1,
      seed: 5,
      ruleset: "legacy",
      mutators: selectMutators(5, 0)
    });

    expect(
      challengeFromRun({
        seed: DAILY_SEED,
        ruleset: "p7",
        challenge: { mode: "daily", seed: DAILY_SEED, dateKey: DAILY_KEY }
      })
    ).toEqual({
      mode: "daily",
      act: 1,
      seed: DAILY_SEED,
      ruleset: "p7",
      dateKey: DAILY_KEY,
      mutators: selectMutators(DAILY_SEED, 0)
    });

    // 自适应=0 时不写字段；非零时随码携带（同码同难）
    expect(challengeFromRun({ seed: 9 })).toEqual({
      mode: "classic",
      act: 1,
      seed: 9,
      ruleset: "legacy"
    });
    expect(challengeFromRun({ seed: 9, adaptiveBoost: 0.05 })).toEqual({
      mode: "classic",
      act: 1,
      seed: 9,
      ruleset: "legacy",
      adaptiveBoost: 5
    });
    // 战役局 legacy 规则集不带版本束字段
    expect(challengeFromRun({ seed: 7, campaign: { act: 1, map: { seed: 7 } } })).toEqual({
      mode: "campaign",
      act: 1,
      seed: 7,
      ruleset: "legacy"
    });
  });

  test("战绩簿：比较器与记录", () => {
    const base = {
      hash: "deadbeef",
      code: "VT1.x.y",
      mode: "campaign" as const,
      act: 1,
      floor: 10,
      victory: false,
      averageScore: 70,
      finishedAt: "2026-09-20T00:00:00.000Z"
    };
    expect(compareChallengeRecords({ ...base, victory: true }, base)).toBeGreaterThan(0);
    expect(compareChallengeRecords({ ...base, floor: 12 }, base)).toBeGreaterThan(0);
    expect(compareChallengeRecords({ ...base, averageScore: 60 }, base)).toBeLessThan(0);
    expect(compareChallengeRecords(base, base)).toBe(0);

    const record = challengeRecordFor(
      { ...CAMPAIGN_FULL, code: "VT1.x.y", hash: "deadbeef" },
      { floor: 11, victory: false, averageScore: 83.6 },
      "2026-09-20T01:02:03.000Z"
    );
    expect(record).toEqual({
      hash: "deadbeef",
      code: "VT1.x.y",
      mode: "campaign",
      act: 2,
      character: "faa-daan",
      floor: 11,
      victory: false,
      averageScore: 84,
      finishedAt: "2026-09-20T01:02:03.000Z"
    });
  });
});
