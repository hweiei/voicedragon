import { CHUNKS, CONTEXT_HINTS, RELIC_INFO, ROUTE_INFO, rewardChoices } from "./branches";
import { LESSONS } from "./curriculum";
import type { Progress } from "./progress";

export function branchView(progress: Progress): string {
  const lesson = LESSONS[progress.floor];
  return `<article class="lesson-card branch-picker"><div class="tag">CHOOSE YOUR PATH / 第 ${progress.floor + 1} 层</div><h2>下一条街，由你选。</h2><p>这一层都练「${lesson.title.split(" · ")[1]}」。<br>知识不跳级，选适合自己的练法。</p><div class="branch-fork" aria-hidden="true"><span>◈</span><i></i></div><div class="branch-options">${(
    ["coach", "challenge"] as const
  )
    .map((kind) => {
      const info = ROUTE_INFO[kind];
      return `<button data-route="${kind}" class="branch-option ${kind}"><span class="branch-icon">${info.icon}</span><small>${kind === "coach" ? "GUIDED PATH" : "SCENARIO PATH"}</small><strong>${info.name}</strong><b>${info.subtitle}</b><p>${info.description}</p><div>${progress.floor === 5 ? "完成后直接结算本局，不再掉落锦囊" : info.reward}</div><em>走这条路 ↗</em></button>`;
    })
    .join(
      ""
    )}</div><p class="branch-note">实战街也可随时查看提示或切换阅读模式；不会因口音、识别失败或求助扣血。</p></article>`;
}
export function rewardView(progress: Progress): string {
  const kind = progress.routes[progress.floor] ?? "coach";
  const choices = rewardChoices(progress.relics, kind, progress.seed, progress.floor);
  return `<article class="lesson-card reward"><div class="tag">${ROUTE_INFO[kind].name}完成 / CHOOSE YOUR REWARD</div><div class="reward-symbol">✦</div><h2>一句入袋，一步向上。</h2><p>${kind === "challenge" ? "实战路线奖励：可从全部未拥有的锦囊中选择。" : "从本次出现的未拥有锦囊中选一个。"}<br>锦囊提供学习辅助，不加发音分数。</p><div class="reward-options">${choices
    .map((name) => {
      const info = RELIC_INFO[name];
      return `<button data-relic="${name}"><b>${info.icon}</b><strong>${name}</strong><span>${info.description}</span></button>`;
    })
    .join(
      ""
    )}</div><p class="reward-note">每种锦囊本局只领取一次。越早选到，越早用上。</p></article>`;
}
export function aidsView(progress: Progress, lessonId: string, knownIds: string[]): string {
  const chunks = CHUNKS[lessonId] ?? [];
  const learned = LESSONS.filter((l) => knownIds.includes(l.id));
  return `<div class="learning-aids">${progress.relics.includes("分句书签") ? `<div class="chunk-aid"><span>分句书签 · 点击听一段</span><div>${chunks.map((text, i) => `<button class="soft-button" data-chunk="${i}">${text} ▷</button>`).join("")}</div></div>` : ""}
  ${progress.relics.includes("情境罗盘") ? `<p class="compass-aid">✧ 情境罗盘：${CONTEXT_HINTS[lessonId]}</p>` : ""}
  ${progress.relics.includes("随身词卡") ? `<details class="pocket-aid"><summary>随身词卡 · 本局已学 ${learned.length} 句</summary>${learned.length ? learned.map((l) => `<p><strong>${l.phrase}</strong><small>${l.jyutping}</small></p>`).join("") : "<p>先完成一层，这里就会出现第一张词卡。</p>"}</details>` : ""}</div>`;
}
