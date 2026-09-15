# 新会话启动步骤
1. 读 D:/work/wechatgame/.wxmg-port/feature-ledger.json 和 progress.md
2. cd D:/work/wechatgame && node --test 确认 9/9
3. 从 ledger 挑一个 passes!=yes 的 item（按顺序）
4. 完成后只改 ledger 的 passes 字段并追加 progress.md
