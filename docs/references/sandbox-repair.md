# 开发沙箱重置修复链（agent 自助）

> status: active · updated: 2026-09-30

## 症状

沙箱重置后（跨轮常见）：`node_modules` 消失、Playwright 浏览器缓存被清、pip 包丢失、
4190 预览服务掉线。**仓库文件（含音频/美术）不受影响**（快照排除列表见下）。

排除列表（不持久化）：`node_modules .cache .venv dist build out target .next` 等
——注意 `minigame/dist`、`minigame/preview` 也在排除列表：**每次重置后须重跑构建**。

## 修复链（一条命令）

```bash
cd /home/user/voicedragon && npm ci --silent \
 && npx playwright install chromium >/dev/null 2>&1 \
 && npx playwright install-deps chromium >/dev/null 2>&1 \
 && pip install -q --no-warn-script-location imageio-ffmpeg numpy pillow \
 && (curl -s -o /dev/null localhost:4190 || nohup python3 -m http.server 4190 --bind 0.0.0.0 --directory minigame/preview >/dev/null 2>&1 &)
```

（后台起服务在 arena 环境用 start_process 工具替代 `nohup`。）

## 检测

- `ls node_modules/.bin/tsc || npm ci`
- `curl -s -o /dev/null -w %{http_code} localhost:4190/` 非 200 → 起服务（须先 build --web）
- Playwright 报 Executable doesn't exist → `npx playwright install chromium`（依赖缺则 +install-deps）
- python 报 `ModuleNotFoundError: imageio_ffmpeg` → pip 重装（装在 .local，快照外）

## 其他坑

- 本地是浅克隆（可见 ~19 commit）：历史考古找远端，勿在本地 rebase 半截历史。
- commit 需要 `-c user.name=arena -c user.email=arena@local`；push 用 token（~/.ssh/gh_token，勿入库）。
- node 脚本必须从仓库根跑（相对路径假设）；biome --write 会重排长行（脚本改文件先重读）。
