/**
 * P6-F1 池化浮字：对象池回收（长战斗零 GC 尖峰）+ animationend 守卫。
 *
 * 调研 §8.6 的两条教训落位：
 * - 浮字必须在 animationend 回收（否则长战斗泄漏数百死 span）；
 * - animationName 守卫（同元素多动画时首个 animationend 不属于浮字动画）。
 */

const POOL_CAP = 24;
/** 安全网：极端情况下（动画被禁用/卡死）强制回收 */
const SAFETY_MS = 1600;

const pool: HTMLSpanElement[] = [];

export interface FloaterVisualOptions {
  /** 宿主内水平位置百分比（缺省随机 18%..74%，避免连击叠字） */
  leftPct?: number;
  /** 暴击：放大金光（样式见 .fx-crit） */
  crit?: boolean;
  /** reduce-motion 降级：仅透明度渐显渐隐、无位移（样式见 .fx-calm） */
  calm?: boolean;
  /** 元素退场（回收）时回调——director 用它归还浮字预算 */
  onRemove?: () => void;
}

function recycle(el: HTMLSpanElement, onRemove?: () => void): void {
  el.remove();
  if (pool.length < POOL_CAP) pool.push(el);
  onRemove?.();
}

/** 在 host 内生成一枚上浮渐隐的数字/符号（池化）。 */
export function spawnFloater(
  host: HTMLElement,
  text: string,
  kind: string,
  options: FloaterVisualOptions = {}
): HTMLSpanElement {
  const el = pool.pop() ?? document.createElement("span");
  const classes = ["fx-floater", `fx-${kind}`];
  if (options.crit) classes.push("fx-crit");
  if (options.calm) classes.push("fx-calm");
  el.className = classes.join(" ");
  el.textContent = text;
  el.style.left = `${options.leftPct ?? 18 + Math.random() * 56}%`;
  host.appendChild(el);

  const onEnd = (event: AnimationEvent): void => {
    window.clearTimeout(safetyTimer);
    if (event.animationName !== "fx-float-up" && event.animationName !== "fx-fade-calm") {
      // 不是浮字本体动画（理论上不会发生）：继续等真正的那一拍
      el.addEventListener("animationend", onEnd, { once: true });
      return;
    }
    recycle(el, options.onRemove);
  };
  el.addEventListener("animationend", onEnd, { once: true });

  const safetyTimer = window.setTimeout(() => {
    el.removeEventListener("animationend", onEnd);
    if (el.isConnected) recycle(el, options.onRemove);
  }, SAFETY_MS);

  return el;
}
