import { describe, expect, test } from "vitest";
import {
  partKey,
  planParts,
  remainingParts
} from "../../src/adapters/voice/sensevoice/model-store";

const SENSEVOICE_SIZE = 238075295;
const PART = 8 * 1024 * 1024;

describe("模型分片计划", () => {
  test("SenseVoice 238MB 按 8MiB 切分，覆盖 [0,size) 且无重叠与缺口", () => {
    const plans = planParts(SENSEVOICE_SIZE, PART);
    expect(plans.length).toBe(Math.ceil(SENSEVOICE_SIZE / PART)); // 29
    for (let i = 0; i < plans.length; i += 1) {
      const part = plans[i];
      expect(part.index).toBe(i);
      expect(part.start).toBe(i === 0 ? 0 : plans[i - 1].end + 1);
      expect(part.size).toBe(part.end - part.start + 1);
    }
    // 首尾与末片精确校验
    expect(plans[0].start).toBe(0);
    expect(plans[plans.length - 1].end).toBe(SENSEVOICE_SIZE - 1);
    const total = plans.reduce((sum, p) => sum + p.size, 0);
    expect(total).toBe(SENSEVOICE_SIZE);
  });

  test("小于一片的文件只有一片", () => {
    const plans = planParts(229, PART);
    expect(plans.length).toBe(1);
    expect(plans[0]).toMatchObject({ index: 0, start: 0, end: 228, size: 229 });
  });

  test("remainingParts 正确剔除已完成分片（续传语义）", () => {
    const plans = planParts(PART * 3 + 7, PART);
    expect(plans.length).toBe(4);
    const rest = remainingParts(plans, new Set([0, 2]));
    expect(rest.map((p) => p.index)).toEqual([1, 3]);
  });

  test("partKey 命名稳定", () => {
    expect(partKey("model.data", 5)).toBe("model.data:5");
  });
});
