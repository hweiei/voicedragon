# -*- coding: utf-8 -*-
"""小批量（2~5 句）TTS 切分：穷举 gap 组合 + ch1 语速模型判优。
用法：python3 scripts/split-mini.py 输入.mp3 输出目录 "key1,key2" "音节数:逗号数|音节数:逗号数"
音节数 = 粤拼 token 数。模型 dur = 0.734 + 0.122*音节 + 0.30*逗号，按总时长整体缩放。
"""
import re, subprocess, sys, itertools, imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
src, outdir, names, meta = sys.argv[1], sys.argv[2], sys.argv[3].split(","), sys.argv[4].split("|")
syl = [tuple(int(x) for x in m.split(":")) for m in meta]
n = len(names)
assert len(syl) == n


def decode():
    r = subprocess.run(
        [FF, "-v", "error", "-i", src, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True
    )
    import numpy as np

    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768


a = decode()
sr = 16000
loud = abs(a) > 0.018
on = a.nonzero() if False else None
import numpy as np

on = np.flatnonzero(loud)
lo, hi = on[0] / sr, (on[-1] + 1) / sr
gaps = []
i = int(lo * sr)
while i < int(hi * sr):
    if not loud[i]:
        j = i
        while j < int(hi * sr) and not loud[j]:
            j += 1
        if (j - i) / sr >= 0.1:
            gaps.append(((i + j) / 2 / sr, (j - i) / sr))
        i = j
    else:
        i += 1
raw = [0.734 + 0.122 * s + 0.3 * c for s, c in syl]
alpha = (hi - lo) / sum(raw)
pred = [p * alpha for p in raw]
best = None
for combo in itertools.combinations(range(len(gaps)), n - 1):
    if list(combo) != sorted(combo):
        continue
    cuts = [lo] + [gaps[k][0] for k in combo] + [hi]
    segs = [cuts[i + 1] - cuts[i] for i in range(n)]
    if any(s < 0.45 for s in segs):
        continue
    cost = sum(((s - p) / p) ** 2 for s, p in zip(segs, pred)) - 0.25 * sum(gaps[k][1] for k in combo)
    if best is None or cost < best[0]:
        best = (cost, combo)
combo = best[1]
cuts = [lo] + [gaps[k][0] for k in combo] + [hi]
for k, nm in enumerate(names):
    s, e = cuts[k], cuts[k + 1]
    seg = a[int(s * sr) : int(e * sr)]
    idx = np.flatnonzero(abs(seg) > 0.015)
    s2 = s + (idx[0] - 700) / sr
    e2 = s + (idx[-1] + 1500) / sr
    fo = max(0.01, e2 - s2 - 0.06)
    subprocess.run(
        [
            FF, "-y", "-v", "error", "-i", src,
            "-ss", f"{s2:.3f}", "-to", f"{e2:.3f}",
            "-af", f"afade=t=in:d=0.02,afade=t=out:st={fo:.3f}:d=0.05",
            "-ar", "22050", "-b:a", "48k", f"{outdir}/{nm}.mp3",
        ],
        capture_output=True,
    )
    print(f"{nm:18s} {e2 - s2:.2f}s 模型 {pred[k]:.2f}s" + ("  <-- CHECK" if abs(e2 - s2 - pred[k]) / pred[k] > 0.35 else ""))
