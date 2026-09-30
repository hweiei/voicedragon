import { describe, expect, it } from "vitest";
import { createSound, musicPlan } from "../minigame/src/sound";

describe("程序化配乐", () => {
  it("musicPlan：64 拍循环、每拍 1–4 个音、音高都在五声音阶内", () => {
    const scale = [220, 246.94, 293.66, 329.63, 392, 440, 587.33, 659.25];
    for (let t = 0; t < 64; t++) {
      const n = musicPlan(t);
      expect(n.length, String(t)).toBeGreaterThanOrEqual(1);
      expect(n.length).toBeLessThanOrEqual(4);
      for (const f of n) expect(scale).toContain(f);
    }
    expect(musicPlan(70)).toEqual(musicPlan(6)); // 64 拍一循环
  });
  it("无 WebAudio 环境：createSound 全 API 静默可用不抛", () => {
    const snd = createSound(() => null);
    snd.unlock();
    snd.sfx("play");
    snd.sfx("win");
    snd.setMuted(true);
    snd.destroy();
  });
  it("假 AudioContext：init 建链、muted 后不再发声", () => {
    let started = 0;
    const gain = () => ({
      gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}
    });
    const osc = () => ({
      type: "",
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {
        started++;
      },
      stop() {}
    });
    const ctx = {
      currentTime: 0,
      destination: {},
      state: "running",
      resume() {},
      createGain: gain,
      createOscillator: osc
    };
    const snd = createSound(() => ctx as never, 60);
    snd.sfx("play");
    expect(started).toBeGreaterThan(0);
    const before = started;
    snd.setMuted(true);
    for (let i = 0; i < 5; i++) snd.sfx("win");
    expect(started).toBe(before);
    snd.destroy();
  });
});
