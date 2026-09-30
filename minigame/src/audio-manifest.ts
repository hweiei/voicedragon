/**
 * 包内粤语示范音频清单（构建时由 build.mjs 按 minigame/assets/audio/street/*.mp3 自动生成，勿手改）。
 * key：c-<卡牌id> / n-<街坊id>-<台词序号>。未列出的 key 播放时提示看粤拼跟读。
 * 小游戏里没有系统粤语 TTS，所以示范只能靠预录音频。
 */
export const AUDIO_KEYS: ReadonlySet<string> = new Set<string>([
  "c-dangzan",
  "c-doze",
  "c-gaaifong",
  "c-geido",
  "c-houmei",
  "c-loengwai",
  "c-lokce",
  "c-maaidaan",
  "c-maanmaan",
  "c-mganjiu",
  "c-mgoi",
  "c-mhouji",
  "c-moumantai",
  "c-naaicaa",
  "c-peng",
  "c-pinji",
  "c-sengjat",
  "c-wonggok",
  "c-zaubing",
  "c-zousan"
]);

export function audioPath(key: string): string | null {
  return AUDIO_KEYS.has(key) ? `audio/street/${key}.mp3` : null;
}
