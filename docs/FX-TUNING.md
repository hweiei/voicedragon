# FX-TUNING · 演出调参手册（P6）

> 打击感与特效必须"玩着调"。本表是所有旋钮的单一事实源：
> 改参数 → `npm run dev` 实机手感 → `npm run ci` 守门。
> 架构与取舍见 `FX-UPGRADE-PLAN.md`；符号定位用 `npx codegraph node <符号>`。

## 1. 打击感（src/ui/fx/plans.ts + juice.ts）

| 参数 | 值 | 位置 | 手感说明 |
|---|---|---|---|
| `HITSTOP_NORMAL_MS` | 40 | plans.ts | 普攻冻结帧。>60 会读成卡顿 |
| `HITSTOP_HEAVY_MS` | 80 | plans.ts | 重击（≥30% 敌方上限）冻结帧 |
| `HEAVY_HIT_RATIO` | 0.3 | plans.ts | 重击判定线（伤害/敌方上限） |
| `CRIT_SCORE` | 90 | plans.ts | 暴击线（与评分「正中」同源） |
| `SHAKE_MIN/MAX_AMP` | 2 / 8 px | plans.ts | 震屏振幅带。`ampFor = 2 + 6×min(1, dmg/maxHp)` |
| 受击抖动时长 | 320ms | plans.ts | 敌方受击；`juice.shakeKeyframes` 4 拍衰减 |
| 敌方攻击震屏 | amp 5 / 280ms | plans.ts | 只震受击侧，永远不震出招者 |
| 交错节奏 | 0 / 16 / 40ms | director.ts | 闪光 → 抖动 → 浮字。拉开到 0/24/60 更"重" |

调参纪律：**震屏只给重击与暴击，普攻只震目标不震全屏**；单次抖动 ≤8px ≤320ms，
防晕动是硬约束（方案 §7）。

## 2. 调度（src/ui/fx/scheduler.ts）

| 参数 | 值 | 说明 |
|---|---|---|
| 去抖窗口 | 60ms | 同 id 计划去重；priority 2（胜负）豁免 |
| 浮字并发 | 6 | 超出弃子保帅（防叠字糊屏） |
| `HITSTOP_RATE` | 0.05 | WAAPI playbackRate 冻结倍率 |

## 3. 粒子（src/ui/fx/particles/）

| 参数 | 值 | 位置 | 说明 |
|---|---|---|---|
| 对象池容量 | 512 | field.ts | Float32Array，零运行时分配 |
| `POOL_DRAG` | 0.9/s | pool.ts | 阻尼：爆发粒子的"刹车感" |
| 微尘数 | 36/44/30 | field.ts ACT_THEMES | 龙楼/雾海/云顶 |
| 火花/暴击/烟花/灰烬 | 26/46/84/40 | emitter.ts BURST_PRESETS | 数量；运行时乘档位倍率 |
| 汉字演出 | 28×28 采样、≤220 粒 | kanji.ts / field.ts | 「声」随暴击、「震」随胜利 |
| 汉字驻留 | 620ms | field.ts kanjiBurst | 汇聚→驻留→散开的节拍 |

## 4. 帧率治理（src/ui/fx/governor.ts）

| 参数 | 值 | 说明 |
|---|---|---|
| 升/降档阈值 | 24 / 18ms | 帧耗 EMA 越线才考虑迁移 |
| 迟滞 | 3000ms | 条件需持续才换档（防抖） |
| 预热 | 90 帧 | 页面加载抖动不决策 |
| 档位预算 | 100% / 50% / 25% | 爆发粒子倍率；微尘 100/60/30% |
| 告警档 | 关汉字演出 | 回退普通环爆，反馈不缺席 |
| 手动强度 | auto/full/balanced/eco | 设置页；手动档固定覆盖自动 |

## 5. 语音光环（src/ui/fx/voice-aura.ts）

| 参数 | 值 | 说明 |
|---|---|---|
| 音量映射 | `rms × 4` | MicRecorder RMS（0..~0.35）→ 0..1 |
| 能量平滑 | 0.22 / 回落 ×0.9 | 涨落不抖 |
| 六调域色相 | 48/168/16/210/280/150 | 阴平金→阳去翠（TONE_HUES） |
| 龙鳞条件 | 连续 ≥6 有声帧 | 环缘凝聚 12 段 |
| 清晰度门限 | clarity ≥ 0.5 | 低于此判无声、龙鳞断开 |
| 音域护栏 | 50–800Hz | 人声之外的基频不参与归一 |

## 6. 转场（styles.css + fx/transitions.ts）

| 参数 | 值 | 说明 |
|---|---|---|
| `vt-screen-out` | 240ms | 旧屏淡出收拢（0.984 缩放） |
| `vt-screen-in` | 300ms | 新屏上浮入场 |
| 缓动 | `--ease-out-hard` | cubic-bezier(0.16, 1, 0.3, 1) |
| 回退 | 原 `screen-in` | 不支持 VT 的浏览器无感 |

## 7. 验证清单

- `npm run ci`：biome + tsc + vitest + build + perf-budget（350KB 一票否决）
- `npx playwright test`：E2E（含 reduce-motion 降级断言）
- 真机三连：① 暴击看「声」字汇聚 ② 说一句话看环色随调域漂移
  ③ 设置页切「省电」档确认粒子削减且战斗演出仍在
