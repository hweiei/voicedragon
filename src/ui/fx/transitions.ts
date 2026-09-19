/**
 * P6-F1 场景转场：View Transitions API（0 KB，2025-10 起 Baseline）+ 优雅回退。
 *
 * 调研 §8.1 落位：same-document VT 已覆盖 Chrome 111+ / Safari 18+ / Firefox 133+；
 * 不支持的浏览器直接渲染——`.screen` 原有的 screen-in 入场动画仍在，观感无损。
 * reduce-motion 时不调用 startViewTransition（与全局无障碍承诺一致）。
 */

type ViewTransitionHandle = { finished: Promise<void> };

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionHandle;
};

/** 若能力可用则以视图过渡执行本次重渲染；否则直接执行。 */
export function startScreenTransition(apply: () => void): void {
  if (document.body.classList.contains("reduce-motion")) {
    apply();
    return;
  }
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(apply);
    return;
  }
  apply();
}
