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

type Gesture = { id: number; x: number; y: number; time: number };
const touchDuration = 700;

/**
 * Detect horizontal mouse drags and single-finger swipes completed within 700 ms.
 * Use with `{@attach swipe({ onSwipe })}`
 * or call the returned function with an element and retain its cleanup function.
 * Inputs, editable content, horizontal scrollers, and `data-swipe-ignore` areas
 * keep their own gestures. Vertical scrolling and pinch zoom remain native.
 */
export function swipe({ onSwipe, onDrag, threshold = 50, scope = "element" }: SwipeOptions) {
  return (surface: HTMLElement) => {
    const element = scope === "page" ? surface.ownerDocument.documentElement : surface;
    let start: Gesture | undefined;
    let mouse: Gesture | undefined;
    let suppressClick = false;
    let touchDistance = 0;
    let readinessTimer: ReturnType<typeof setTimeout> | undefined;

    function ignored(target: EventTarget | null) {
      if (!(target instanceof Element)) return true;
      if (target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [data-swipe-ignore]")) return true;
      for (let node: Element | null = target; node && node !== element; node = node.parentElement) {
        if (node.scrollWidth > node.clientWidth && /^(auto|scroll)$/.test(getComputedStyle(node).overflowX)) return true;
      }
      return false;
    }

    function ontouchstart(event: TouchEvent) {
      clearTimeout(readinessTimer);
      touchDistance = 0;
      start = undefined;
      onDrag?.(0);
      suppressClick = false;
      if (event.touches.length !== 1 || ignored(event.target)) return;
      const touch = event.touches[0];
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: event.timeStamp };
      readinessTimer = setTimeout(() => {
        if (start && touchDistance) onDrag?.(touchDistance, false);
      }, touchDuration);
    }

    function ontouchmove(event: TouchEvent) {
      if (!start) return;
      if (event.touches.length !== 1) {
        start = undefined;
        onDrag?.(0);
        return;
      }
      const touch = event.touches[0];
      const x = Math.abs(touch.clientX - start.x);
      const y = Math.abs(touch.clientY - start.y);
      // Once a gesture becomes vertical, never turn that scroll into a swipe.
      if (y > 10 && y >= x) {
        start = undefined;
        onDrag?.(0);
      } else if (x > 10 && x > y * 1.5) {
        if (event.cancelable) event.preventDefault();
        touchDistance = touch.clientX - start.x;
        onDrag?.(touchDistance, x >= threshold && event.timeStamp - start.time <= touchDuration);
      } else {
        touchDistance = 0;
        onDrag?.(0);
      }
    }

    function ontouchend(event: TouchEvent) {
      clearTimeout(readinessTimer);
      const origin = start;
      start = undefined;
      onDrag?.(0);
      if (!origin || event.touches.length) return;
      const touch = Array.from(event.changedTouches).find((touch) => touch.identifier === origin.id);
      if (!touch) return;
      finishSwipe(origin, touch.clientX, touch.clientY, event.timeStamp);
    }

    function finishSwipe(origin: Gesture, clientX: number, clientY: number, time: number, maxDuration = touchDuration) {
      const x = clientX - origin.x;
      const y = clientY - origin.y;
      if (Math.abs(x) < threshold || Math.abs(x) <= Math.abs(y) * 1.5 || time - origin.time > maxDuration) return;
      // A completed swipe must not also activate the control beneath the pointer.
      suppressClick = true;
      onSwipe(x < 0 ? "left" : "right");
    }

    function ontouchcancel() {
      clearTimeout(readinessTimer);
      start = undefined;
      onDrag?.(0);
    }

    function onclick(event: MouseEvent) {
      if (event.detail === 0 || !suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }

    function onpointerdown(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      suppressClick = false;
      mouse = undefined;
      onDrag?.(0);
      if (!event.isPrimary || event.button !== 0 || ignored(event.target)) return;
      mouse = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
    }

    function onpointermove(event: PointerEvent) {
      if (mouse?.id !== event.pointerId) return;
      if (!(event.buttons & 1)) {
        mouse = undefined;
        onDrag?.(0);
        return;
      }
      const x = Math.abs(event.clientX - mouse.x);
      const y = Math.abs(event.clientY - mouse.y);
      if (y > 10 && y >= x) {
        mouse = undefined;
        onDrag?.(0);
      } else if (x > 10 && x > y * 1.5) {
        event.preventDefault();
        onDrag?.(event.clientX - mouse.x, x >= threshold);
      } else onDrag?.(0);
    }

    function onpointerup(event: PointerEvent) {
      if (mouse?.id !== event.pointerId || event.button !== 0) return;
      const origin = mouse;
      mouse = undefined;
      onDrag?.(0);
      // Mouse dragging can be deliberate and slower than a touch flick.
      finishSwipe(origin, event.clientX, event.clientY, event.timeStamp, Infinity);
    }

    function onpointercancel(event: PointerEvent) {
      if (mouse?.id !== event.pointerId) return;
      mouse = undefined;
      onDrag?.(0);
    }

    function onblur() {
      clearTimeout(readinessTimer);
      mouse = undefined;
      start = undefined;
      onDrag?.(0);
    }

    function preventDrag(event: Event) {
      if (mouse) event.preventDefault();
    }

    element.addEventListener("touchstart", ontouchstart, { passive: true });
    element.addEventListener("touchmove", ontouchmove, { passive: false });
    element.addEventListener("touchend", ontouchend, { passive: true });
    element.addEventListener("touchcancel", ontouchcancel, { passive: true });
    element.addEventListener("click", onclick, { capture: true });
    element.addEventListener("pointerdown", onpointerdown, { passive: true });
    element.addEventListener("dragstart", preventDrag);
    element.addEventListener("selectstart", preventDrag);
    // Track release outside the surface without taking capture from child controls.
    const document = element.ownerDocument;
    const window = document.defaultView;
    document.addEventListener("pointermove", onpointermove);
    document.addEventListener("pointerup", onpointerup);
    document.addEventListener("pointercancel", onpointercancel);
    window?.addEventListener("blur", onblur);

    return () => {
      clearTimeout(readinessTimer);
      onDrag?.(0);
      element.removeEventListener("touchstart", ontouchstart);
      element.removeEventListener("touchmove", ontouchmove);
      element.removeEventListener("touchend", ontouchend);
      element.removeEventListener("touchcancel", ontouchcancel);
      element.removeEventListener("click", onclick, { capture: true });
      element.removeEventListener("pointerdown", onpointerdown);
      element.removeEventListener("dragstart", preventDrag);
      element.removeEventListener("selectstart", preventDrag);
      document.removeEventListener("pointermove", onpointermove);
      document.removeEventListener("pointerup", onpointerup);
      document.removeEventListener("pointercancel", onpointercancel);
      window?.removeEventListener("blur", onblur);
    };
  };
}
