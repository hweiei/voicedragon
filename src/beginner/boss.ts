import { LESSONS, type Lesson } from "./curriculum";
export const BOSS_STEPS = ["招呼店员", "完整点单", "礼貌回应"];
export function bossLesson(round: number): Lesson {
  if (round === 0)
    return {
      ...LESSONS[1],
      id: "boss",
      title: "天台冰室 · 招呼店员",
      question: "店员正忙着，你想请他过来点单，先说哪句？",
      answers: ["唔该", "几多钱", "多谢"],
      correct: 0
    };
  if (round === 1)
    return {
      ...LESSONS[5],
      title: "天台冰室 · 完整点单",
      question: "店员问你想要什么。你想点一杯冰奶茶，哪句符合？",
      answers: ["我要两杯冻奶茶", "唔该，我要一杯冻奶茶", "我要一杯热奶茶"],
      correct: 1
    };
  return {
    ...LESSONS[1],
    id: "boss",
    title: "天台冰室 · 礼貌回应",
    question: "店员把饮品送到桌上。你想感谢这次服务，可以说？",
    answers: ["你好", "几多钱", "唔该"],
    correct: 2,
    tip: "这次感谢的是店员送饮品的服务，常用“唔该”。收到礼物时则常说“多谢”。"
  };
}
export function bossPrompt(round: number): string {
  return (
    [
      "店员正在忙。先用一句粤语礼貌地招呼他。",
      "店员走过来。请用粤语点一杯冰奶茶。",
      "店员送来饮品。用粤语感谢这次服务。"
    ][round] ?? ""
  );
}
export function bossView(round: number): string {
  return `<section class="boss-dialogue" aria-label="茶餐厅三轮对话"><div class="boss-rounds">${BOSS_STEPS.map((step, i) => `<span class="${i === round ? "current" : i < round ? "done" : ""}">${i < round ? "✓" : i + 1} ${step}</span>`).join("")}</div><div class="npc-line"><span aria-hidden="true">茶</span><p><small>天台冰室 · 店员</small>${["店员正在柜台后忙碌，等你开口。", "店员来到桌边，等你说出要点的饮品。", "奶茶到喇，慢慢飲。<button class='text-button' data-action='npc-listen'>▷ 听店员说话</button>"][round]}</p></div><small class="boss-credit">三轮都录音才计为完整对话录音完成；混合阅读模式仍可通关。</small></section>`;
}
