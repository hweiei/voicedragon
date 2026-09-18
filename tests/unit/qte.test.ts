import { describe, expect, test } from "vitest";
import { qteScore } from "../../src/ui/qte";

describe("破阵拍 score bands", () => {
  test("正中甜区 = 满分", () => {
    expect(qteScore(0)).toBe(100);
    expect(qteScore(0.02)).toBeGreaterThanOrEqual(94);
  });

  test("甜区边缘 ≈90 分界线", () => {
    expect(qteScore(0.05)).toBe(90);
    expect(qteScore(0.06)).toBeLessThan(90);
    expect(qteScore(0.06)).toBeGreaterThanOrEqual(70);
  });

  test("中带 70..89，外环 45..69，脱靶 20..44", () => {
    expect(qteScore(0.15)).toBe(70);
    expect(qteScore(0.16)).toBeLessThan(70);
    expect(qteScore(0.16)).toBeGreaterThanOrEqual(45);
    expect(qteScore(0.3)).toBe(45);
    expect(qteScore(0.31)).toBeLessThan(45);
    expect(qteScore(0.31)).toBeGreaterThanOrEqual(20);
  });

  test("极值钳制在 [20,100]，负输入按绝对值处理", () => {
    expect(qteScore(1)).toBeGreaterThanOrEqual(20);
    expect(qteScore(2)).toBeGreaterThanOrEqual(20);
    expect(qteScore(-0.1)).toBeLessThanOrEqual(89);
    expect(qteScore(-0.1)).toBeGreaterThanOrEqual(70);
  });
});
