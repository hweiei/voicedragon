import { describe, expect, test } from "vitest";
import { selectAdapterKind } from "../../src/adapters/voice";

describe("语音引擎选择策略", () => {
  test("auto + 无模型 → webspeech（零下载保底）", () => {
    expect(selectAdapterKind("auto", { modelCached: false })).toBe("webspeech");
  });

  test("auto + 模型已缓存 → sensevoice（离线优先）", () => {
    expect(selectAdapterKind("auto", { modelCached: true })).toBe("sensevoice");
  });

  test("显式模式优先于探测", () => {
    expect(selectAdapterKind("sensevoice", { modelCached: false })).toBe("sensevoice");
    expect(selectAdapterKind("webspeech", { modelCached: true })).toBe("webspeech");
  });
});
