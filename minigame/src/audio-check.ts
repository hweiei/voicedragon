/**
 * 示范音频校对页（仅浏览器预览）：逐条列出音频、原文、粤拼，方便人耳核对。
 * 打开 preview/audio-check.html，听完在右侧勾选「有问题」，最后复制清单反馈。
 */
import { CARDS, NPCS } from "../../src/street/data";
import { AUDIO_KEYS, audioPath } from "./audio-manifest";

interface Row {
  key: string;
  text: string;
  jp: string;
  note: string;
}

const rows: Row[] = [
  ...Object.values(CARDS).map((c) => ({
    key: `c-${c.id}`,
    text: c.phrase,
    jp: c.jp,
    note: c.meaning
  })),
  ...Object.values(NPCS).flatMap((n) =>
    n.intents.map((it, i) => ({
      key: `n-${n.id}-${i}`,
      text: it.line,
      jp: it.jp,
      note: `${n.name} · ${it.gloss}`
    }))
  )
];

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const have = rows.filter((r) => AUDIO_KEYS.has(r.key)).length;
const app = document.getElementById("app") as HTMLElement;
app.innerHTML = `<h1>示范音频校对</h1>
<p>共 ${rows.length} 条，已有音频 ${have} 条。逐条试听，发现读错、切错、断句不对就勾「有问题」。</p>
<table><thead><tr><th>#</th><th>原文 / 粤拼</th><th>意思</th><th>试听</th><th>有问题</th></tr></thead><tbody>
${rows
  .map((r, i) => {
    const path = audioPath(r.key);
    return `<tr><td>${i + 1}</td><td><b>${esc(r.text)}</b><br><code>${esc(r.jp)}</code></td><td>${esc(r.note)}</td>
<td>${path ? `<audio controls preload="none" src="./${path}"></audio>` : '<span class="miss">未生成</span>'}</td>
<td><input type="checkbox" data-key="${r.key}" data-text="${esc(r.text)}"></td></tr>`;
  })
  .join("")}
</tbody></table>
<button id="copy">生成问题清单</button><pre id="out"></pre>`;
(document.getElementById("copy") as HTMLButtonElement).onclick = () => {
  const bad = [...document.querySelectorAll<HTMLInputElement>("input[data-key]:checked")].map(
    (el) => `${el.dataset.key}  ${el.dataset.text}`
  );
  (document.getElementById("out") as HTMLElement).textContent = bad.length
    ? bad.join("\n")
    : "全部通过";
};
