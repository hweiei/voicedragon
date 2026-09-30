/** 内容总账（H-09 半段）：六章卡池为 v1 发布基线，句面全局唯一防复读，音频映射齐备 */
import { describe, expect, it } from "vitest";
import { audioPath } from "../minigame/src/audio-manifest";
import { CHAPTERS } from "../src/street/chapters";
import { CARDS } from "../src/street/data";

describe("内容总账", () => {
  const all = Object.values(CARDS);
  it("卡池总句数 = 110（v1 冻结实测值）", () => {
    expect(all.length).toBe(110);
  });
  it("phrase 全局唯一", () => {
    const seen = new Set<string>();
    for (const c of all) {
      expect(seen.has(c.phrase), `「${c.phrase}」重复`).toBe(false);
      seen.add(c.phrase);
    }
  });
  it("六章全部 ready", () => {
    for (const ch of CHAPTERS) expect(ch.ready, `第${ch.id}章未 ready`).toBe(true);
    expect(CHAPTERS.length).toBe(6);
  });
  it("每句都有示范音频映射", () => {
    for (const c of all) {
      expect(audioPath(`c-${c.id}`) ?? audioPath(c.id), `${c.id} 缺音频`).toBeTruthy();
    }
  });
});
