import { describe, expect, it, vi } from "vitest";
import { swipe } from "#lib/swipe.ts";

class Surface extends EventTarget {
  parentElement: Surface | null = null;
  scrollWidth = 100;
  clientWidth = 100;
  overflowX = "visible";
  ignored = false;
  closest() {
    return this.ignored ? this : null;
  }
}
function event(type: string, values: Record<string, unknown>) {
  const result = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(result, key, { value });
  return result;
}
function fixture(page = false) {
  const window = Object.assign(new EventTarget(), { getComputedStyle: (node: Surface) => ({ overflowX: node.overflowX }) });
  const root = new Surface();
  const document = Object.assign(new EventTarget(), { defaultView: window, documentElement: root });
  Object.assign(root, { ownerDocument: document });
  const surface = Object.assign(new Surface(), { ownerDocument: document });
  const child = new Surface();
  const element = page ? root : surface;
  child.parentElement = element;
  const onSwipe = vi.fn();
  const onDrag = vi.fn();
  const detach = swipe({ onSwipe, onDrag, scope: page ? "page" : "element" })(surface as unknown as HTMLElement);
  function pointer(type: string, x = 0, y = 0, timeStamp = 100, extra = {}) {
    const result = event(type, {
      target: child,
      pointerType: "mouse",
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      timeStamp,
      ...extra,
    });
    (type === "pointerdown" ? element : document).dispatchEvent(result);
    return result;
  }
  function touch(type: string, x = 0, y = 0, timeStamp = 100) {
    const point = { identifier: 1, clientX: x, clientY: y };
    const result = event(type, { target: child, touches: type === "touchend" ? [] : [point], changedTouches: [point], timeStamp });
    element.dispatchEvent(result);
    return result;
  }
  return { element, child, document, window, pointer, touch, onSwipe, onDrag, detach };
}

describe("horizontal swipe navigation", () => {
  it.each([false, true])("supports slow mouse dragging and suppresses only its following pointer click, page=%s", (page) => {
    const view = fixture(page);
    view.pointer("pointerdown");
    expect(view.pointer("pointermove", -80, 4, 2000).defaultPrevented).toBe(true);
    expect(view.onDrag).toHaveBeenLastCalledWith(-80, true);
    view.pointer("pointerup", -80, 4, 3000);
    expect(view.onSwipe).toHaveBeenCalledWith("left");
    const keyboard = event("click", { detail: 0, timeStamp: 3001 });
    view.element.dispatchEvent(keyboard);
    expect(keyboard.defaultPrevented).toBe(false);
    const click = event("click", { detail: 1, timeStamp: 3002 });
    view.element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    view.detach();
  });
  it("expires touch readiness even while the finger stops moving", () => {
    vi.useFakeTimers();
    const view = fixture();
    view.touch("touchstart");
    expect(view.touch("touchmove", 80, 0, 200).defaultPrevented).toBe(true);
    expect(view.onDrag).toHaveBeenLastCalledWith(80, true);
    vi.advanceTimersByTime(700);
    expect(view.onDrag).toHaveBeenLastCalledWith(80, false);
    view.touch("touchend", 80, 0, 801);
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.detach();
    vi.useRealTimers();
  });
  it("commits a quick touch swipe once and preserves vertical scroll decisions", () => {
    const view = fixture();
    view.touch("touchstart");
    view.touch("touchend", 80, 0, 300);
    expect(view.onSwipe).toHaveBeenCalledWith("right");
    view.onSwipe.mockClear();
    view.touch("touchstart");
    expect(view.touch("touchmove", 5, 30, 200).defaultPrevented).toBe(false);
    view.touch("touchend", 90, 30, 300);
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.detach();
  });
  it.each(["control", "scroller"])("preserves gestures owned by a %s", (kind) => {
    const view = fixture();
    if (kind === "control") view.child.ignored = true;
    else {
      view.child.scrollWidth = 300;
      view.child.overflowX = "auto";
    }
    view.pointer("pointerdown");
    expect(view.pointer("pointermove", 100).defaultPrevented).toBe(false);
    view.pointer("pointerup", 100);
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.detach();
  });
  it.each(["blur", "pointercancel", "buttons", "detach"])("cancels and clears feedback on %s", (kind) => {
    const view = fixture();
    view.pointer("pointerdown");
    view.pointer("pointermove", 80);
    if (kind === "blur") view.window.dispatchEvent(new Event("blur"));
    else if (kind === "detach") view.detach();
    else if (kind === "buttons") view.pointer("pointermove", 90, 0, 200, { buttons: 0 });
    else view.pointer("pointercancel");
    expect(view.onDrag).toHaveBeenLastCalledWith(0);
    view.pointer("pointerup", 100);
    expect(view.onSwipe).not.toHaveBeenCalled();
    if (kind !== "detach") view.detach();
  });
});
