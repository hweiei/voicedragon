"""把一条多句合成音频切成 N 句：候选静音 + 按字数预测时长做动态规划对齐，并做自检。"""
# 用法：python3 scripts/split-batch-audio.py 合成.mp3 输出目录 "key1,key2" "句1|句2"（依赖 pip install imageio-ffmpeg）
import math, re, subprocess, sys, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
src, outdir, names, texts = sys.argv[1], sys.argv[2], sys.argv[3].split(","), sys.argv[4].split("|")
n = len(names)
log = subprocess.run([FF, "-hide_banner", "-i", src, "-af", "silencedetect=noise=-35dB:d=0.08", "-f", "null", "-"], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", log).groups()
dur = int(h) * 3600 + int(m) * 60 + float(s)
lead = en[0] if st and st[0] < 0.05 else 0.0
tail = st[-1] if st and en[-1] >= dur - 0.05 else dur
gaps = [(a, b) for a, b in zip(st, en) if a > lead + 0.05 and b < tail - 0.05]
chars = [max(1, len(re.sub(r"[，。！？、\s]", "", t))) for t in texts]
# 语速模型：句长 ≈ k * 字数 + c（c 为句首尾拖音）
speech = (tail - lead) - sum(b - a for a, b in gaps if b - a > 0.25)
k = max(0.12, (speech - 0.25 * n - 0.35 * sum(len(re.findall(r"[，！？](?=.)", t.strip("！？。 "))) for t in texts)) / sum(chars))
commas = [len(re.findall(r"[，！？](?=.)", t.strip("！？。 "))) for t in texts]
pred = [k * c + 0.25 + 0.35 * cm for c, cm in zip(chars, commas)]
P = [lead] + [(a + b) / 2 for a, b in gaps] + [tail]
G = [0.0] + [b - a for a, b in gaps] + [0.0]
m = len(P)
INF = float("inf")
best = [[INF] * m for _ in range(n + 1)]
back = [[-1] * m for _ in range(n + 1)]
best[0][0] = 0.0
for i in range(1, n + 1):
    for j in range(1, m):
        if i < n and j == m - 1:
            continue
        if i == n and j != m - 1:
            continue
        for q in range(j):
            if best[i - 1][q] == INF:
                continue
            d = P[j] - P[q]
            err = ((d - pred[i - 1]) / pred[i - 1]) ** 2
            cost = best[i - 1][q] + 4 * err - (math.log(G[j] + 1e-3) if j < m - 1 else 0)
            if cost < best[i][j]:
                best[i][j], back[i][j] = cost, q
cuts = [m - 1]
for i in range(n, 0, -1):
    cuts.append(back[i][cuts[-1]])
cuts = [P[c] for c in reversed(cuts)]
ok = True
for i, name in enumerate(names):
    a, b = cuts[i], cuts[i + 1]
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-ss", f"{max(0, a - 0.03):.3f}", "-to", f"{b + 0.03:.3f}",
                    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,afade=t=in:d=0.01",
                    "-ac", "1", "-b:a", "56k", f"{outdir}/{name}.mp3"], check=True)
    r = (b - a) / pred[i]
    flag = "" if 0.6 < r < 1.6 else "  <-- 可疑"
    ok &= not flag
    print(f"{name:14s} {b-a:5.2f}s 预测{pred[i]:4.2f}s {texts[i]}{flag}")
print("OK" if ok else "CHECK")
