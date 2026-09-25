import { LESSONS, type Lesson } from "./curriculum";
export type RouteKind = "coach" | "challenge";
export const ROUTE_INFO = {
  coach: {
    name: "教学巷",
    icon: "灯",
    subtitle: "慢慢学，有提示",
    description: "完整粤语、粤拼与发音提示先展示，再做基础场景题。",
    reward: "从至多 3 件未拥有的锦囊中选 1 件"
  },
  challenge: {
    name: "实战街",
    icon: "试",
    subtitle: "少提示，换个场景",
    description: "先听示范与看普通话任务，自己组织回答；随时可展开提示，不扣血。",
    reward: "下一次奖励开放全部未拥有锦囊"
  }
} as const;
export const RELIC_INFO: Record<string, { icon: string; description: string }> = {
  慢声耳机: { icon: "◷", description: "慢速示范降至 0.55 倍，听清音节。" },
  粤拼灯牌: { icon: "灯", description: "实战街隐藏答案时，仍提供粤拼辅助。" },
  分句书签: { icon: "句", description: "解锁短句分段示范；每段可单独听。" },
  情境罗盘: { icon: "向", description: "额外展示场景用法线索，不直接选答案。" },
  随身词卡: { icon: "卡", description: "练习中可展开本局已经学过的表达。" },
  回声纪念章: { icon: "↺", description: "旧版纪念奖励；回放无需消耗。" }
};
export const NEW_RELICS = ["慢声耳机", "粤拼灯牌", "分句书签", "情境罗盘", "随身词卡"];
export const CHUNKS: Record<string, string[]> = {
  greeting: ["你好"],
  please: ["唔该"],
  order: ["我要", "一杯", "冻奶茶"],
  price: ["几多钱"],
  thanks: ["多谢"],
  boss: ["唔该", "我要", "一杯", "冻奶茶"]
};
export const CONTEXT_HINTS: Record<string, string> = {
  greeting: "这是见面时的问候，不是道别或感谢。",
  please: "先引起对方注意，请求服务与收到礼物时的感谢要区分。",
  order: "粤语菜单里的“冻”是温度选择；“杯”是饮品的量词。",
  price: "先区分你是在问金额，还是在问地点。",
  thanks: "这里收到的是一份心意，不是请店员提供服务。",
  boss: "完整点单可以先礼貌招呼，再说明数量和饮品；送到后再感谢服务。"
};
const SCENARIOS: Record<string, Array<Pick<Lesson, "question" | "answers" | "correct">>> = {
  greeting: [
    {
      question: "电梯门打开，遇到第一次见面的邻居，你会先说？",
      answers: ["你好", "几多钱", "多谢"],
      correct: 0
    }
  ],
  please: [
    {
      question: "你的座位缺了一双筷子。想请店员帮忙，先说？",
      answers: ["多谢", "唔该", "几多钱"],
      correct: 1
    },
    {
      question: "前面有人挡着取餐口，想礼貌地请他让一让，先说？",
      answers: ["唔该", "你好", "几多钱"],
      correct: 0
    }
  ],
  order: [
    {
      question: "你想要冷饮，不是热饮。下面哪句点单符合你的意思？",
      answers: ["我要一杯热奶茶", "我要一杯冻奶茶", "几多钱"],
      correct: 1
    },
    {
      question: "店员问你要什么，你想点一杯冰奶茶。你会说？",
      answers: ["我要一杯冻奶茶", "我要两杯冻奶茶", "我要一杯热奶茶"],
      correct: 0
    }
  ],
  price: [
    {
      question: "夜市的饮品没有标价。你想知道要付多少钱，会问？",
      answers: ["喺边度？", "几多钱？", "冻唔冻？"],
      correct: 1
    },
    {
      question: "准备付款，你需要确认金额。哪句是在问价格？",
      answers: ["几多钱？", "几多杯？", "几时开门？"],
      correct: 0
    }
  ],
  thanks: [
    {
      question: "邻居特意送来一盒点心，你想感谢这份心意。会说？",
      answers: ["多谢", "唔该借借", "几多钱"],
      correct: 0
    },
    {
      question: "朋友送了一份生日礼物给你，你会说？",
      answers: ["唔该借借", "多谢", "早晨"],
      correct: 1
    }
  ],
  boss: [
    {
      question: "店员刚把你点的饮品送到桌上，你想感谢这次服务。会说？",
      answers: ["几多钱", "唔该", "你好"],
      correct: 1
    },
    {
      question: "你要礼貌地招呼店员，并点一杯冷奶茶。哪句最完整？",
      answers: ["唔该，我要一杯冻奶茶", "我要一杯热奶茶", "多谢，几多钱"],
      correct: 0
    }
  ]
};
/** Seed controls scenario and answer order, never curriculum prerequisites. */
export function branchLesson(floor: number, kind: RouteKind, seed: number): Lesson {
  const original = LESSONS[floor];
  if (kind === "coach") return original;
  const pool = SCENARIOS[original.id];
  const scenario = pool[(seed + floor) % pool.length];
  const offset = (seed + floor * 7) % scenario.answers.length;
  const answers = [...scenario.answers.slice(offset), ...scenario.answers.slice(0, offset)];
  return {
    ...original,
    ...scenario,
    answers,
    correct: (scenario.correct - offset + answers.length) % answers.length
  };
}
export function rewardChoices(
  owned: string[],
  kind: RouteKind,
  seed: number,
  floor: number
): string[] {
  const available = NEW_RELICS.filter((id) => !owned.includes(id));
  if (kind === "challenge") return available;
  if (floor === 0) return available.slice(0, 3);
  const shift = available.length ? (seed + floor) % available.length : 0;
  return [...available.slice(shift), ...available.slice(0, shift)].slice(0, 3);
}
export function branchSelected(routes: RouteKind[], floor: number): boolean {
  return routes.length > floor;
}
