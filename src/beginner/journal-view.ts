import { LESSONS } from "./curriculum";
import { type Journal, dueCount } from "./journal";

export function journalView(journal: Journal, now: number): string {
  const entries = Object.values(journal.entries);
  const due = dueCount(journal, now);
  return `<article class="lesson-card journal-view"><div class="tag">LEARNING JOURNAL / 学习手账</div><h2>学过的话，不留在上一局。</h2><p class="journal-intro">重开冒险不会清空这本手账。先回想，再看提示；今天只复习三句，也很好。</p>
    <div class="journal-metrics"><div><strong>${entries.length}</strong><span>已练表达 · 不代表掌握</span></div><div><strong>${due}</strong><span>当前到期复习</span></div><div><strong>${entries.reduce((sum, e) => sum + e.recording, 0)}</strong><span>累计录音尝试</span></div></div>
    <div class="journal-actions"><button class="primary" data-action="review-start" ${entries.length ? "" : "disabled"}>${due ? "开始到期复习" : "主动回顾三句"} ↗</button><button class="soft-button" data-action="journal-close">返回本局</button></div>
    ${
      entries.length
        ? `<div class="journal-entries">${LESSONS.filter((l) => journal.entries[l.id])
            .map((lesson) => {
              const e = journal.entries[lesson.id];
              const schedule =
                e.dueAt <= now
                  ? "已到复习时间"
                  : `下次：${new Date(e.dueAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
              return `<div class="journal-entry"><div><strong>${lesson.phrase}</strong><small>${lesson.jyutping}</small></div><div><span>录音 ${e.recording} 次 · 阅读 ${e.reading} 次</span><small>${schedule}</small><small>${e.rating === "again" ? "上次自评：还要练" : e.rating === "remembered" ? "上次自评：记起来了" : "尚未自评回忆"}</small></div></div>`;
            })
            .join("")}</div>`
        : '<div class="journal-empty">手账还是空的。<br>完成任意一层后，第一句就会自动记在这里。</div>'
    }
    <p class="journal-disclaimer">仅保存本浏览器的练习次数、复习时间和自评。清除网站数据会丢失记录；不保存音频，不提供发音评分，也不会与原版学习档案自动合并。</p></article>`;
}
