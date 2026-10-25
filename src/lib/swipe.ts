export type SwipeDirection = "left" | "right" | "up" | "down";

type SwipeOptions = {
  directions: readonly SwipeDirection[];
  onSwipe: (direction: SwipeDirection) => void;
  /** Signed travel along the active axis and whether releasing now will trigger a swipe. Zero resets feedback. */
  onDrag?: (distance: number, ready?: boolean) => void;
  /** Minimum travel in CSS pixels. Defaults to 50. */
  threshold?: number;
  /** Maximum gesture duration in milliseconds. Defaults to 700 for touch and unlimited for mouse. */
  duration?: number;
  /** Listen across the whole page instead of just the attached element. */
  scope?: "element" | "page";
};
type Gesture = { id: number; x: number; y: number; mouse: boolean; expires: number; directions: Set<SwipeDirection> };
const touchDuration = 700;
const gestureSlop = 10;
const axisRatio = 1.5;
const clickSuppressionDuration = 500;

function movement(origin: Gesture, x: number, y: number) {
  const dx = x - origin.x;
  const dy = y - origin.y;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const distance = horizontal ? dx : dy;
  const cross = horizontal ? dy : dx;
  let direction: SwipeDirection;
  if (horizontal) direction = dx < 0 ? "left" : "right";
  else direction = dy < 0 ? "up" : "down";
  return { direction, distance, aligned: Math.abs(distance) > Math.abs(cross) * axisRatio };
}

/** Attach directional swipes while preserving editable controls, nested dialogs, and native scrolling. */
export function swipe({ directions, onSwipe, onDrag, threshold = 50, duration, scope = "element" }: SwipeOptions) {
  return (surface: HTMLElement) => {
    const element = scope === "page" ? surface.ownerDocument.documentElement : surface;
    const document = element.ownerDocument;
    const window = document.defaultView;
    const dialog = surface.closest<HTMLDialogElement>("dialog");
    let start: Gesture | undefined;
    let suppressUntil = 0;
    let distance = 0;
    let readinessTimer: Timeout;

    function cancel() {
      clearTimeout(readinessTimer);
      start = undefined;
      distance = 0;
      onDrag?.(0);
    }

    function available(target: EventTarget | null) {
      if (!target || !("closest" in target)) return;
      const origin = target as Element;
      if ((dialog && !dialog.open) || origin.closest("dialog") !== dialog) return;
      const ignored = origin.closest("[data-swipe-ignore]");
      if (ignored && ignored !== surface) return;
      const allowed = new Set(directions);
      if (origin.closest("[data-drag-handle]")) return allowed;
      if (origin.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role=slider]")) return;
      for (let node: Element | null = origin; node && node !== element; node = node.parentElement) {
        const style = window?.getComputedStyle(node);
        if (node.scrollWidth > node.clientWidth && /^(auto|scroll)$/.test(style?.overflowX ?? "")) {
          allowed.delete("left");
          allowed.delete("right");
        }
        if (node.scrollHeight > node.clientHeight && /^(auto|scroll)$/.test(style?.overflowY ?? "")) {
          if (node.scrollTop > 0) allowed.delete("down");
          if (node.scrollTop + node.clientHeight < node.scrollHeight) allowed.delete("up");
        }
      }
      return allowed;
    }

    function begin(target: EventTarget | null, x: number, y: number, time: number, id: number, mouse: boolean) {
      cancel();
      suppressUntil = 0;
      const allowed = available(target);
      if (!allowed?.size) return;
      const limit = duration ?? (mouse ? Infinity : touchDuration);
      start = { x, y, id, mouse, expires: time + limit, directions: allowed };
      if (onDrag && Number.isFinite(limit))
        readinessTimer = setTimeout(() => {
          if (start && distance) onDrag(distance, false);
        }, limit);
    }

    function move(x: number, y: number, time: number, event: Event) {
      if (!start) return;
      const travel = movement(start, x, y);
      if (Math.abs(travel.distance) <= gestureSlop) return;
      // Once native scrolling or an opposing gesture wins, it cannot become a swipe later.
      if (!start.directions.has(travel.direction) || (!start.mouse && !event.cancelable)) return cancel();
      if (!travel.aligned) {
        distance = 0;
        onDrag?.(0);
        return;
      }
      if (event.cancelable) event.preventDefault();
      distance = travel.distance;
      onDrag?.(distance, Math.abs(distance) >= threshold && time <= start.expires);
    }

    function finish(x: number, y: number, time: number) {
      if (!start) return;
      const { direction, distance: travel, aligned } = movement(start, x, y);
      const complete = aligned && start.directions.has(direction) && Math.abs(travel) >= threshold && time <= start.expires;
      const dragged = distance !== 0;
      cancel();
      if (complete || dragged) suppressUntil = time + clickSuppressionDuration;
      if (complete) onSwipe(direction);
    }

    function ontouchstart(event: TouchEvent) {
      if (event.touches.length !== 1) return cancel();
      const touch = event.touches[0];
      begin(event.target, touch.clientX, touch.clientY, event.timeStamp, touch.identifier, false);
    }
    function ontouchmove(event: TouchEvent) {
      if (event.touches.length !== 1) return cancel();
      const touch = event.touches[0];
      if (start && !start.mouse && touch.identifier === start.id) move(touch.clientX, touch.clientY, event.timeStamp, event);
    }
    function ontouchend(event: TouchEvent) {
      if (!start || start.mouse) return;
      const touch = Array.from(event.changedTouches).find((touch) => touch.identifier === start?.id);
      if (touch && !event.touches.length) finish(touch.clientX, touch.clientY, event.timeStamp);
    }
    function onpointerdown(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      if (!event.isPrimary || event.button !== 0) return cancel();
      begin(event.target, event.clientX, event.clientY, event.timeStamp, event.pointerId, true);
    }
    function onpointermove(event: PointerEvent) {
      if (!start?.mouse || event.pointerId !== start.id) return;
      if (!(event.buttons & 1)) return cancel();
      move(event.clientX, event.clientY, event.timeStamp, event);
    }
    function onpointerup(event: PointerEvent) {
      if (start?.mouse && event.pointerId === start.id && event.button === 0) finish(event.clientX, event.clientY, event.timeStamp);
    }
    function onpointercancel(event: PointerEvent) {
      if (start?.mouse && event.pointerId === start.id) cancel();
    }
    function onclick(event: MouseEvent) {
      if (!suppressUntil || event.timeStamp > suppressUntil || event.detail === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressUntil = 0;
    }
    function preventDrag(event: Event) {
      if (start?.mouse) event.preventDefault();
    }

    const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
      [element, "touchstart", ontouchstart as EventListener, { passive: true }],
      [element, "touchmove", ontouchmove as EventListener, { passive: false }],
      [element, "touchend", ontouchend as EventListener, { passive: true }],
      [element, "touchcancel", cancel],
      [element, "pointerdown", onpointerdown as EventListener, { passive: true }],
      [element, "click", onclick as EventListener, { capture: true }],
      [element, "dragstart", preventDrag],
      [element, "selectstart", preventDrag],
      [document, "pointermove", onpointermove as EventListener],
      [document, "pointerup", onpointerup as EventListener],
      [document, "pointercancel", onpointercancel as EventListener],
    ];
    if (window) listeners.push([window, "blur", cancel]);
    for (const [target, type, listener, options] of listeners) target.addEventListener(type, listener, options);
    return () => {
      for (const [target, type, listener, options] of listeners) target.removeEventListener(type, listener, options);
      cancel();
    };
  };
}
