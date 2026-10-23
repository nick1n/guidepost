export type SwipeDirection = "left" | "right";

type SwipeOptions = {
  onSwipe: (direction: SwipeDirection) => void;
  /** Signed travel and whether releasing now will switch. Zero resets feedback. */
  onDrag?: (distance: number, ready?: boolean) => void;
  /** Minimum horizontal travel in CSS pixels. Defaults to 50. */
  threshold?: number;
  /** Listen across the whole page instead of just the attached element. */
  scope?: "element" | "page";
};
type DismissOptions = { dismiss: () => void; ondrag: (distance: number) => void };
type Gesture = { id: number; x: number; y: number; time: number; mouse: boolean };
const touchDuration = 700;
const gestureSlop = 10;
const axisRatio = 1.5;
const dismissDistance = 64;
const dismissDuration = 1500;
const clickSuppressionDuration = 500;

/** Horizontal navigation preserves native vertical scrolling, editable controls, and horizontal scrollers. */
export function swipe({ onSwipe, onDrag, threshold = 50, scope = "element" }: SwipeOptions) {
  return (surface: HTMLElement) =>
    listen(scope === "page" ? surface.ownerDocument.documentElement : surface, { onSwipe, onDrag, threshold });
}

/** Downward sheet dismissal preserves native input gestures and scrolled content. */
export function swipeDismiss({ dismiss, ondrag }: DismissOptions) {
  return (element: HTMLDialogElement) => listen(element, { dismiss, onDrag: ondrag });
}

type Policy = { onDrag?: (distance: number, ready?: boolean) => void } & (
  | { onSwipe: (direction: SwipeDirection) => void; threshold: number; dismiss?: never }
  | { dismiss: () => void; onSwipe?: never; threshold?: never }
);

function listen(element: HTMLElement, policy: Policy) {
  const document = element.ownerDocument;
  const window = document.defaultView;
  const downward = !!policy.dismiss;
  let start: Gesture | undefined;
  let suppressUntil = 0;
  let distance = 0;
  let readinessTimer: Timeout;

  function cancel() {
    clearTimeout(readinessTimer);
    start = undefined;
    distance = 0;
    policy.onDrag?.(0);
  }

  function ignored(target: EventTarget | null) {
    if (!target || !("closest" in target)) return true;
    const origin = target as Element;
    if (downward) {
      if (!(element as HTMLDialogElement).open) return true;
      if (origin.closest("[data-drag-handle]")) return false;
      if (origin.closest("input, select, textarea, [contenteditable], [role=slider]")) return true;
    } else if (origin.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [data-swipe-ignore]"))
      return true;
    for (let node: Element | null = origin; node && node !== element; node = node.parentElement) {
      const style = window?.getComputedStyle(node);
      if (downward) {
        if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight && /auto|scroll/.test(style?.overflowY ?? "")) return true;
      } else if (node.scrollWidth > node.clientWidth && /^(auto|scroll)$/.test(style?.overflowX ?? "")) return true;
    }
    return false;
  }

  function begin(target: EventTarget | null, x: number, y: number, time: number, id: number, mouse: boolean) {
    cancel();
    suppressUntil = 0;
    if (ignored(target)) return;
    start = { x, y, time, id, mouse };
    if (!downward && !mouse)
      readinessTimer = setTimeout(() => {
        if (start && distance) policy.onDrag?.(distance, false);
      }, touchDuration);
  }

  function move(x: number, y: number, time: number, event: Event) {
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    const primary = downward ? dy : Math.abs(dx);
    const cross = downward ? Math.abs(dx) : Math.abs(dy);
    // Once native scrolling or an opposing gesture wins, it cannot become a swipe later.
    if (downward) {
      const movingUp = dy < -gestureSlop;
      const movingAcross = cross > gestureSlop && cross > Math.abs(dy);
      if (movingUp || movingAcross) return cancel();
    } else if (cross > gestureSlop && cross >= primary) return cancel();
    if (primary > gestureSlop && primary > cross * axisRatio) {
      // A noncancelable touch move means the browser already owns native scrolling.
      if (downward && !start.mouse && !event.cancelable) return cancel();
      if (event.cancelable) event.preventDefault();
      distance = downward ? dy : dx;
      if (policy.dismiss) policy.onDrag?.(distance);
      else {
        const withinDuration = start.mouse || time - start.time <= touchDuration;
        policy.onDrag?.(distance, primary >= policy.threshold && withinDuration);
      }
    } else if (!downward) {
      distance = 0;
      policy.onDrag?.(0);
    }
  }

  function finish(x: number, y: number, time: number) {
    if (!start) return;
    const origin = start;
    const dx = x - origin.x;
    const dy = y - origin.y;
    let complete: boolean;
    if (policy.dismiss) {
      const movingDown = dy >= dismissDistance && dy > Math.abs(dx) * axisRatio;
      complete = movingDown && time - origin.time < dismissDuration;
    } else {
      const movingAcross = Math.abs(dx) >= policy.threshold && Math.abs(dx) > Math.abs(dy) * axisRatio;
      const withinDuration = origin.mouse || time - origin.time <= touchDuration;
      complete = movingAcross && withinDuration;
    }
    if (!complete) {
      const dragged = downward && distance > 0;
      cancel();
      if (dragged) suppressUntil = time + clickSuppressionDuration;
      return;
    }
    clearTimeout(readinessTimer);
    start = undefined;
    suppressUntil = downward ? time + clickSuppressionDuration : Infinity;
    if (policy.dismiss) policy.dismiss();
    else {
      policy.onDrag?.(0);
      policy.onSwipe(dx < 0 ? "left" : "right");
    }
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
}
