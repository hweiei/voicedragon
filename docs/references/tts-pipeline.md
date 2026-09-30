# TTS 批量合成与切分 SOP（音频资产生产线）

> status: active · updated: 2026-09-30

小游戏内没有可用的系统粤语 TTS，全部示范音频走「智能体语音合成 → 批量切分 → 入库」管线。
10 次/轮的合成配额是硬约束，所以**一次调用喂多句、事后切分**是唯一规模化路线。

## 流程

1. **组批文**：按 `src/street/content/chN.ts` 的 `phrase` 字段逐字抄录（句号去掉、逗号保留）。
   3–9 句/批；**最稳是 3 句**。批内任何一字与数据表不符都会毁掉整批对位（ch3 曾漏字致一句错读）。
2. **合成**：`generate_speech`，voice-00（yue），输出到 `/home/user/audioN/`（workspace 根，勿直接进仓库）。
3. **切分**：`scripts/split-mini.py <批文件> <输出目录> "key1,key2,..." "音节:逗号数|..."`
   - key 顺序 = 文本行顺序，一个不能错。
   - meta 的音节数 = 该卡 `jp` 字段的空格分词数；逗号数 = 文本中英文逗号/中文逗号数量。
   - 时长模型：`0.734 + 0.122×音节 + 0.3×逗号` 秒；偏差 >35% 打 `<-- CHECK`。
4. **CHECK 处理**：任何 CHECK 行 → 该批相邻 2–3 句整组重生成再切。**不要用模型猜着留**。
   隔离坏句：整批输出到 tmp 目录，只 `cp` 好句入库（防覆盖已单独重录的句子）。
5. **单句修补**：`generate_speech` 的 `file_path` 直接传仓库绝对路径
   `/home/user/voicedragon/minigame/assets/audio/street/c-xxx.mp3` 即一步入库。
6. **自检**：内部长停顿检测（解码 s16le 16k，响度阈 0.018，首尾 0.25s 外静默 >0.85s 判异常）——实现见
   `scripts/harness/audio.ts`（阶段3落地）；历史命令记录在 git log 的音频 commit 说明里。
7. **构建**：`node minigame/build.mjs --web` 自动扫目录重建 manifest、路由主包/`resN` 分包。

## 命名与不变量

- key：`c-<卡id>` / `n-<街坊id>-<台词序号>`（意图 0 起）；文件名 = key + `.mp3`。
- `jp` 字段禁止逗号（内容表测试强制），音节计数只数空格分词。
- 缺失音频不崩：运行时 `audioPath` 返回 null → UI 降级「睇粤拼跟读」。
- 试听页：`/audio-check.html`（预览服务），提审前必须人工全量过耳。

## 坑（都真实踩过）

- 整批文本必须与数据表逐字核对后再生成。
- 沙箱重置会清 pip 包（imageio-ffmpeg）——见 `docs/references/sandbox-repair.md`。
- 同一 user 轮内图 10 张 + 音 10 条是硬顶，混排任务先排音频批次。

## 离线试听页（一次性生成，产物不入 git）

`audio-check-offline.html`＝把 192 条 mp3 以 base64 内嵌的单文件试听表（连播/章节过滤/问题清单导出）。音频改动后重生成（勿提交，hygiene 拒生成物入库）：

1. `rows.mts`：import `src/street/data` 出 192 行 `{key,text,jp,note,ch}` 过滤 `minigame/assets/audio/street/` 实际存在文件，`console.log(JSON.stringify(rows))`；
2. `npx esbuild rows.mts --bundle --format=esm --platform=node --outfile=rows.mjs && node rows.mjs > rows.json`；
3. python 读 rows.json + 逐个 `base64.b64encode(mp3)` 拼 `<audio src="data:audio/mpeg;base64,…">` 模板，`</` 转义 `<\\/`。

参考实现见会话交付记录（2026-09-30 版含连播状态机与「生成问题清单」按钮）。
