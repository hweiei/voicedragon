/**
 * 包内粤语示范音频清单（由 scripts 生成的 mp3 放在 minigame/assets/audio/street/）。
 * key：c-<卡牌id> / n-<街坊id>-<台词序号>。未列出的 key 播放时提示看粤拼跟读。
 * 小游戏里没有系统粤语 TTS，所以示范只能靠预录音频。
 */
export const AUDIO_KEYS: ReadonlySet<string> = new Set<string>([]);

export function audioPath(key: string): string | null {
  return AUDIO_KEYS.has(key) ? `audio/street/${key}.mp3` : null;
}
