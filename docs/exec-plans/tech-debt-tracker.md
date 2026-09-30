> status: active · updated: 2026-09-30 · 周期：每个 harness 阶段末扫一次

# 技术债账本（harness 收口后的遗留）

| ID | 项 | 级别 | 偿还触发 |
|----|----|------|---------|
| ~~H-17~~ PNG 压缩 | — | **已结案 wontfix**：无损仅 14KB，有损伤霓虹渐变画风（MAD 实测 2.5–5.3>2.0） |
| — | playwright devDep 使 npm ci 变慢（web 冻结线专属） | P2 | web 线彻底归档（非冻结）时随 e2e 剥离 |
| — | docs/harness/registry 中 wontfix 项复审 | 每半年 | 解冻条件（web-freeze.md §3）达成时 |
| H-06 | pre-commit hook 仅样例、未强制 | P2 | 团队 >1 人时评估 husky |
