/**
 * P4 玩家档案（核心层，纯函数）：跨局累计统计 + 图鉴足迹 + 自适应难度节律。
 * 存储由适配层负责（voice-tower-profile-v1）；这里只有形状与更新规则。
 * 更新全部幂等/单调：同一对（startedAt, phase）结算只记一次由调用方保证。
 */

import type { RunSummary } from "./engine";
import type { SrsStore } from "./srs";

export interface ProfileStats {
  runs: number;
  victories: number;
  classicVictories: number;
  campaignVictories: number;
  kills: number;
  elites: number;
  voiceAttempts: number;
  bestVoice: number;
  /** 当前连中（≥85）计数与历史最高 */
  combo85: number;
  maxCombo85: number;
  endlessBest: number;
  /** 自适应难度节律：>0 连胜计数，<0 连败计数 */
  adaptiveStreak: number;
  /** 战役 boss 通关次数（重打会累计） */
  campaignBossKills: number;
}

export type CodexKind = "skills" | "enemies" | "relics" | "items" | "events";

export interface ProfileStore {
  stats: ProfileStats;
  /** 已解锁成就 id */
  unlocked: string[];
  codex: Record<CodexKind, string[]>;
}

export function emptyProfile(): ProfileStore {
  return {
    stats: {
      runs: 0,
      victories: 0,
      classicVictories: 0,
      campaignVictories: 0,
      kills: 0,
      elites: 0,
      voiceAttempts: 0,
      bestVoice: 0,
      combo85: 0,
      maxCombo85: 0,
      endlessBest: 0,
      adaptiveStreak: 0,
      campaignBossKills: 0
    },
    unlocked: [],
    codex: { skills: [], enemies: [], relics: [], items: [], events: [] }
  };
}

export interface RunEndInput {
  victory: boolean;
  endless: boolean;
  campaign: boolean;
  floor: number;
  summary: RunSummary;
}

/** 一局结算：累计战绩、无尽最佳、自适应节律（胜/败各 ±1，跨零重置）。 */
export function recordRunEnd(profile: ProfileStore, input: RunEndInput): ProfileStore {
  const stats = profile.stats;
  stats.runs += 1;
  stats.kills += input.summary.enemies;
  stats.elites += input.summary.elites;
  if (input.summary.bestScore) stats.bestVoice = Math.max(stats.bestVoice, input.summary.bestScore);
  if (input.endless && input.floor > stats.endlessBest) stats.endlessBest = input.floor;
  if (input.victory) {
    stats.victories += 1;
    if (input.campaign) {
      stats.campaignVictories += 1;
      stats.campaignBossKills += 1;
    } else if (!input.endless) {
      stats.classicVictories += 1;
    }
    stats.adaptiveStreak = Math.min(3, Math.max(0, stats.adaptiveStreak) + 1);
  } else {
    stats.adaptiveStreak = Math.max(-2, Math.min(0, stats.adaptiveStreak) - 1);
  }
  return profile;
}

/** 真声施法一次（仅真实语音逐次声韵；QTE/键盘判定走 recordVoiceAttempt 之外的调用纪律）。 */
export function recordVoiceCast(profile: ProfileStore, score: number): ProfileStore {
  profile.stats.voiceAttempts += 1;
  profile.stats.bestVoice = Math.max(profile.stats.bestVoice, score);
  profile.stats.combo85 = score >= 85 ? profile.stats.combo85 + 1 : 0;
  profile.stats.maxCombo85 = Math.max(profile.stats.maxCombo85, profile.stats.combo85);
  return profile;
}

/** 图鉴点亮（幂等）。 */
export function markCodexSeen(
  profile: ProfileStore,
  kind: CodexKind,
  ids: Iterable<string>
): boolean {
  let changed = false;
  for (const id of ids) {
    if (!profile.codex[kind].includes(id)) {
      profile.codex[kind].push(id);
      changed = true;
    }
  }
  return changed;
}

/** 自适应难度系数（方案 §6.2：连胜 3 场 +5%，连败 2 场 -8%，有上下限）。 */
export function adaptiveBoostFor(streak: number): number {
  if (streak >= 3) return 0.05;
  if (streak <= -2) return -0.08;
  return 0;
}

/** 错词“驯服”计数：复习间隔已拉长到 ≥10 天的条目。 */
export function countSrsGraduated(store: SrsStore): number {
  return Object.values(store.entries).filter((entry) => entry.intervalDays >= 10).length;
}
