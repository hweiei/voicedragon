/**
 * 活跃线 HTML 围栏（H-14 半段）：src/street 模板字符串若必须插值，过这里。
 * 小游戏端不受影响（canvas 无 innerHTML）。
 */
const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

/** 任意值 → 文本节点安全（用于 ${} 内的一切用户/数据字符串） */
export function esc(v: unknown): string {
  return String(v).replace(/[&<>"']/g, (ch) => ESC[ch]);
}

/** 可信静态骨架 + 已转义片段的拼装白名单：仅放行我们自己生成的标记 */
const OK_TAGS = /^(\/?(b|i|em|strong|span|div|br)\b[^<>]*)$/i;
export function safeHtml(s: string): string {
  const stripped = s.replace(/<!--[\s\S]*?-->/g, "");
  for (const m of stripped.matchAll(/<([^>]*)>/g)) {
    if (!OK_TAGS.test(m[1].trim())) throw new Error(`xss:safeHtml 拒绝标记 <${m[1].slice(0, 24)}>`);
  }
  if (/javascript:|onerror|onload|srcdoc/i.test(stripped))
    throw new Error("xss:safeHtml 拒绝事件/协议属性");
  return stripped;
}
