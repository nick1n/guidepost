import { vi } from "vitest";
import { swipe, type SwipeDirection } from "#lib/swipe.ts";

export class Element extends EventTarget {
  parentElement: Element | null;
  scrollWidth = 100;
  clientWidth = 100;
  overflowX = "visible";
  scrollTop = 0;
  scrollHeight = 100;
  clientHeight = 100;
  overflowY = "visible";
  open = true;
  swipeIgnored = false;

  constructor(
    public selector = "div",
    parent?: Element,
  ) {
    super();
    this.parentElement = parent ?? null;
  }

  closest(selectors: string): Element | null {
    if (selectors === "[data-swipe-ignore]" && this.swipeIgnored) return this;
    if (selectors.split(",").some((selector) => selector.trim().replace(":not([contenteditable='false'])", "") === this.selector))
      return this;
    return this.parentElement?.closest(selectors) ?? null;
  }
}

export function event(type: string, properties: Record<string, unknown> = {}) {
  const result = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries({ timeStamp: 100, ...properties })) Object.defineProperty(result, key, { value });
  return result;
}

export function swipeFixture({
  dialog = false,
  page = false,
  directions = ["left", "right"],
  feedback = true,
  threshold,
  duration,
}: { dialog?: boolean; page?: boolean; directions?: SwipeDirection[]; feedback?: boolean; threshold?: number; duration?: number } = {}) {
  const window = Object.assign(new EventTarget(), {
    getComputedStyle: (element: Element) => ({ overflowX: element.overflowX, overflowY: element.overflowY }),
  });
  const root = new Element("html");
  const document = Object.assign(new EventTarget(), { defaultView: window, documentElement: root });
  Object.assign(root, { ownerDocument: document });
  const surface = Object.assign(new Element(dialog ? "dialog" : "main", root), { ownerDocument: document, swipeIgnored: dialog });
  const element = page ? root : surface;
  const child = new Element("div", surface);
  const handle = new Element("[data-drag-handle]", surface);
  const onSwipe = vi.fn();
  const onDrag = vi.fn();
  const detach = swipe({
    directions,
    onSwipe,
    onDrag: feedback ? onDrag : undefined,
    threshold,
    duration,
    scope: page ? "page" : "element",
  })(surface as unknown as HTMLElement);

  function pointer(type: string, x = 0, y = 0, timeStamp = 100, extra: Record<string, unknown> = {}) {
    const result = event(type, {
      target: child,
      pointerType: "mouse",
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: type === "pointermove" ? 1 : 0,
      clientX: x,
      clientY: y,
      timeStamp,
      ...extra,
    });
    (type === "pointerdown" ? element : document).dispatchEvent(result);
    return result;
  }

  function touch(type: string, x = 0, y = 0, timeStamp = 100, extra: Record<string, unknown> = {}) {
    const point = { identifier: 1, clientX: x, clientY: y };
    const result = event(type, {
      target: child,
      touches: type === "touchend" ? [] : [point],
      changedTouches: [point],
      timeStamp,
      ...extra,
    });
    element.dispatchEvent(result);
    return result;
  }

  return { element, surface, child, handle, document, window, pointer, touch, onSwipe, onDrag, detach };
}
