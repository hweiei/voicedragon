/** P7 挑战词缀。纯数据 + 独立种子派生；绝不推进引擎的 rngState。 */
import { mulberry32 } from "./levelgen";

export interface MutationEffects {
  hpScale?: number;
  attackScale?: number;
  enemyArmor?: number;
  armorPerTurn?: number;
  playerArmor?: number;
  energy?: number;
  voiceBoost?: number;
  vulnerable?: number;
  heal?: number;
  strength?: number;
}
export interface Mutator {
  id: string;
  name: string;
  kind: "pressure" | "boon";
  description: string;
  effects: MutationEffects;
}
export const MUTATORS: readonly Mutator[] = [
  {
    id: "ironcoat",
    name: "铁衣",
    kind: "pressure",
    description: "敌人开场护甲 +6。",
    effects: { enemyArmor: 6 }
  },
  {
    id: "fierce",
    name: "猛攻",
    kind: "pressure",
    description: "敌人基础攻击 ×1.12、生命 ×0.9（固定吞音伤害不变）。",
    effects: { attackScale: 1.12, hpScale: 0.9 }
  },
  {
    id: "giant",
    name: "巨躯",
    kind: "pressure",
    description: "敌人生命 ×1.18、基础攻击 ×0.95。",
    effects: { hpScale: 1.18, attackScale: 0.95 }
  },
  {
    id: "noise",
    name: "噪潮",
    kind: "pressure",
    description: "每场首句判定 -6（原始语音得分不变）。",
    effects: { voiceBoost: -6 }
  },
  {
    id: "headwind",
    name: "逆风",
    kind: "pressure",
    description: "首回合声气 -1，开场护甲 +8。",
    effects: { energy: -1, playerArmor: 8 }
  },
  {
    id: "plating",
    name: "层甲",
    kind: "pressure",
    description: "敌人每次行动后护甲 +2。",
    effects: { armorPerTurn: 2 }
  },
  {
    id: "shelter",
    name: "护身",
    kind: "boon",
    description: "我方开场护甲 +8。",
    effects: { playerArmor: 8 }
  },
  {
    id: "rush",
    name: "抢拍",
    kind: "boon",
    description: "首回合声气 +1。",
    effects: { energy: 1 }
  },
  {
    id: "clarity",
    name: "清音",
    kind: "boon",
    description: "每场首句判定 +10（原始语音得分不变）。",
    effects: { voiceBoost: 10 }
  },
  {
    id: "breach",
    name: "破阵",
    kind: "boon",
    description: "敌人开场易伤 2 回合，所受攻击伤害 +25%。",
    effects: { vulnerable: 2 }
  },
  {
    id: "spring",
    name: "回春",
    kind: "boon",
    description: "每场开战回复 4 点生命，不超过上限。",
    effects: { heal: 4 }
  },
  {
    id: "momentum",
    name: "昂扬",
    kind: "boon",
    description: "本场初始声势 +1，每段攻击都受益。",
    effects: { strength: 1 }
  }
];

export interface ChallengeState {
  mode: "daily" | "endless";
  /** 使用开局 seed，独立于每幕地图 seed 与局内 RNG。 */
  seed: number;
  dateKey?: string;
  stage: number;
  mutatorIds: string[];
}

/** 每日固定 stage 0；无尽第 1–5 层为 0，第 6–10 层为 1…… */
export function mutationStage(mode: ChallengeState["mode"], floor: number): number {
  return mode === "daily" ? 0 : Math.max(0, Math.floor((floor - 1) / 5));
}

export function selectMutators(seed: number, stage = 0): string[] {
  const rng = mulberry32((seed ^ 0x70375eed ^ Math.imul(stage + 1, 0x9e3779b9)) >>> 0);
  return (["pressure", "boon"] as const).map((kind) => {
    const pool = MUTATORS.filter((entry) => entry.kind === kind);
    return pool[Math.floor(rng() * pool.length)].id;
  });
}

/** 忽略未知/重复 ID，旧存档或未来词缀不会使读取崩溃。 */
export function mutationList(ids: readonly string[] = []): Mutator[] {
  return MUTATORS.filter((entry) => ids.includes(entry.id));
}

export function mutationEffects(ids: readonly string[] = []): Required<MutationEffects> {
  const result: Required<MutationEffects> = {
    hpScale: 1,
    attackScale: 1,
    enemyArmor: 0,
    armorPerTurn: 0,
    playerArmor: 0,
    energy: 0,
    voiceBoost: 0,
    vulnerable: 0,
    heal: 0,
    strength: 0
  };
  for (const entry of mutationList(ids)) {
    for (const key of Object.keys(entry.effects) as Array<keyof MutationEffects>) {
      const value = entry.effects[key]!;
      if (key === "hpScale" || key === "attackScale") result[key] *= value;
      else result[key] += value;
    }
  }
  return result;
}
