import { describe, expect, it, vi } from "vitest";
import { swipeDismiss } from "#lib/swipe.ts";

class Element extends EventTarget {
  parentElement: Element | null = null;
  scrollTop = 0;
  scrollHeight = 100;
  clientHeight = 100;
  overflowY = "visible";

  constructor(
    readonly selector = "div",
    parent?: Element,
  ) {
    super();
    this.parentElement = parent ?? null;
  }

  closest(selectors: string): Element | null {
    if (selectors.split(",").some((selector) => selector.trim() === this.selector)) return this;
    return this.parentElement?.closest(selectors) ?? null;
  }
}

function event(type: string, properties: Record<string, unknown> = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries({ timeStamp: 100, ...properties })) Object.defineProperty(event, key, { value });
  return event;
}

function fixture() {
  const window = Object.assign(new EventTarget(), { getComputedStyle: (element: Element) => ({ overflowY: element.overflowY }) });
  const document = Object.assign(new EventTarget(), { defaultView: window });
  const dialog = Object.assign(new Element("dialog"), { open: true, ownerDocument: document });
  const body = new Element("div", dialog);
  const handle = new Element("[data-drag-handle]", dialog);
  const dismiss = vi.fn();
  const ondrag = vi.fn();
  const detach = swipeDismiss({ dismiss, ondrag })(dialog as unknown as HTMLDialogElement);
  const pointer = (type: string, target: EventTarget = body, x = 0, y = 0, time = 100, extra: Record<string, unknown> = {}) => {
    const pointer = event(type, {
      target,
      pointerType: "mouse",
      button: 0,
      isPrimary: true,
      pointerId: 1,
      buttons: type === "pointermove" ? 1 : 0,
      clientX: x,
      clientY: y,
      timeStamp: time,
      ...extra,
    });
    (type === "pointerdown" ? dialog : document).dispatchEvent(pointer);
    return pointer;
  };
  const touch = (type: string, y: number, time = 100, extra: Record<string, unknown> = {}) => {
    const point = { identifier: 1, clientX: 0, clientY: y };
    const touch = event(type, {
      target: body,
      timeStamp: time,
      touches: type === "touchend" ? [] : [point],
      changedTouches: [point],
      ...extra,
    });
    dialog.dispatchEvent(touch);
    return touch;
  };
  return { dialog, document, window, body, handle, dismiss, ondrag, detach, pointer, touch };
}

describe("menu swipe dismissal", () => {
  it("tracks a downward drag outside the panel without falling behind the pointer and dismisses on release", () => {
    const view = fixture();
    view.pointer("pointerdown");
    expect(view.pointer("pointermove", view.document, 4, 40, 200).defaultPrevented).toBe(true);
    expect(view.ondrag).toHaveBeenLastCalledWith(40);
    view.pointer("pointermove", view.document, 4, 240, 300);
    expect(view.ondrag).toHaveBeenLastCalledWith(240);
    view.pointer("pointerup", view.document, 4, 240, 400);
    expect(view.dismiss).toHaveBeenCalledOnce();
    view.detach();
  });

  it.each(["a", "button", "input", "select", "textarea", "summary", "[contenteditable]", "[role=button]", "[role=slider]"])(
    "leaves %s and its children in charge of their gestures",
    (selector) => {
      const view = fixture();
      const control = new Element(selector, view.body);
      const child = new Element("span", control);
      view.pointer("pointerdown", child);
      expect(view.pointer("pointermove", child, 0, 100, 200).defaultPrevented).toBe(false);
      view.pointer("pointerup", child, 0, 100, 300);
      expect(view.dismiss).not.toHaveBeenCalled();
      expect(view.ondrag).toHaveBeenLastCalledWith(0);
      view.detach();
    },
  );

  it("leaves scrolled content alone, but permits a downward dismissal at its top or from the grip", () => {
    const view = fixture();
    view.body.scrollHeight = 500;
    view.body.scrollTop = 40;
    view.body.overflowY = "auto";
    view.pointer("pointerdown");
    view.pointer("pointermove", view.body, 0, 100, 200);
    view.pointer("pointerup", view.body, 0, 100, 300);
    expect(view.dismiss).not.toHaveBeenCalled();
    view.body.scrollTop = 0;
    view.pointer("pointerdown");
    view.pointer("pointerup", view.body, 0, 100, 300);
    expect(view.dismiss).toHaveBeenCalledOnce();
    view.body.scrollTop = 40;
    view.pointer("pointerdown", view.handle);
    view.pointer("pointerup", view.handle, 0, 100, 300);
    expect(view.dismiss).toHaveBeenCalledTimes(2);
    view.detach();
  });

  it.each([
    { x: 80, y: 20, time: 200 },
    { x: 0, y: -20, time: 200 },
    { x: 0, y: 60, time: 200 },
    { x: 0, y: 100, time: 1700 },
  ])("resets a horizontal, upward, short, or slow drag: %o", ({ x, y, time }) => {
    const view = fixture();
    view.pointer("pointerdown");
    view.pointer("pointermove", view.body, x, y, time);
    view.pointer("pointerup", view.body, x, y, time + 1);
    expect(view.dismiss).not.toHaveBeenCalled();
    expect(view.ondrag).toHaveBeenLastCalledWith(0);
    view.detach();
  });

  it("handles touch events once without duplicate dismissal from touch pointer events", () => {
    const view = fixture();
    view.touch("touchstart", 0);
    view.pointer("pointerdown", view.body, 0, 0, 100, { pointerType: "touch" });
    expect(view.touch("touchmove", 100, 200).defaultPrevented).toBe(true);
    view.pointer("pointerup", view.body, 0, 100, 250, { pointerType: "touch" });
    expect(view.dismiss).not.toHaveBeenCalled();
    view.touch("touchend", 100, 300);
    expect(view.dismiss).toHaveBeenCalledOnce();
    view.detach();
  });

  it.each(["a", "button", "summary", "[role=button]"])("allows touch dismissal starting on %s without activating it", (selector) => {
    const view = fixture();
    const target = new Element("span", new Element(selector, view.body));
    view.touch("touchstart", 0, 100, { target });
    expect(view.touch("touchmove", 100, 200, { target }).defaultPrevented).toBe(true);
    view.touch("touchend", 100, 300, { target });
    expect(view.dismiss).toHaveBeenCalledOnce();
    const click = event("click", { target, detail: 1, timeStamp: 310 });
    view.dialog.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    view.detach();
  });

  it.each(["input", "select", "textarea", "[contenteditable]", "[role=slider]"])("preserves touch interaction with %s", (selector) => {
    const view = fixture();
    const target = new Element(selector, view.body);
    view.touch("touchstart", 0, 100, { target });
    expect(view.touch("touchmove", 100, 200, { target }).defaultPrevented).toBe(false);
    view.touch("touchend", 100, 300, { target });
    expect(view.dismiss).not.toHaveBeenCalled();
    view.detach();
  });

  it("does not turn a row tap into dismissal or suppress its click", () => {
    const view = fixture();
    const target = new Element("button", view.body);
    view.touch("touchstart", 0, 100, { target });
    view.touch("touchend", 2, 200, { target });
    const click = event("click", { target, detail: 1, timeStamp: 210 });
    view.dialog.dispatchEvent(click);
    expect(view.dismiss).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(false);
    view.detach();
  });

  it("suppresses a row click after an incomplete drag", () => {
    const view = fixture();
    const target = new Element("button", view.body);
    view.touch("touchstart", 0, 100, { target });
    view.touch("touchmove", 40, 200, { target });
    view.touch("touchend", 40, 300, { target });
    const click = event("click", { target, detail: 1, timeStamp: 310 });
    view.dialog.dispatchEvent(click);
    expect(view.dismiss).not.toHaveBeenCalled();
    expect(view.ondrag).toHaveBeenLastCalledWith(0);
    expect(click.defaultPrevented).toBe(true);
    view.detach();
  });

  it("cancels once native touch scrolling has taken over", () => {
    const view = fixture();
    view.touch("touchstart", 0);
    view.touch("touchmove", 30, 200, { cancelable: false });
    view.touch("touchend", 100, 300);
    expect(view.dismiss).not.toHaveBeenCalled();
    expect(view.ondrag).toHaveBeenLastCalledWith(0);
    view.detach();
  });

  it("cancels multitouch and ignores an unrelated touch ending", () => {
    const view = fixture();
    view.touch("touchstart", 0);
    view.touch("touchend", 100, 200, { changedTouches: [{ identifier: 2, clientX: 0, clientY: 100 }] });
    expect(view.dismiss).not.toHaveBeenCalled();
    view.touch("touchmove", 100, 300, { touches: [{ identifier: 1 }, { identifier: 2 }] });
    view.touch("touchend", 100, 400);
    expect(view.dismiss).not.toHaveBeenCalled();
    expect(view.ondrag).toHaveBeenLastCalledWith(0);
    view.detach();
  });

  it("suppresses the synthetic click after dismissal while retaining keyboard and later clicks", () => {
    const view = fixture();
    view.pointer("pointerdown");
    view.pointer("pointerup", view.body, 0, 100, 300);
    const keyboard = event("click", { detail: 0, timeStamp: 400 });
    view.dialog.dispatchEvent(keyboard);
    expect(keyboard.defaultPrevented).toBe(false);
    const synthetic = event("click", { detail: 1, timeStamp: 410 });
    view.dialog.dispatchEvent(synthetic);
    expect(synthetic.defaultPrevented).toBe(true);
    const later = event("click", { detail: 1, timeStamp: 420 });
    view.dialog.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
    view.detach();
  });

  it.each(["pointercancel", "blur", "detach"])("resets and stops a pending drag on %s", (action) => {
    const view = fixture();
    view.pointer("pointerdown");
    view.pointer("pointermove", view.body, 0, 40, 200);
    if (action === "detach") view.detach();
    else if (action === "pointercancel") view.pointer("pointercancel");
    else view.window.dispatchEvent(new Event(action));
    expect(view.ondrag).toHaveBeenLastCalledWith(0);
    view.pointer("pointerup", view.body, 0, 100, 300);
    expect(view.dismiss).not.toHaveBeenCalled();
    if (action !== "detach") view.detach();
    view.ondrag.mockClear();
    view.pointer("pointerdown");
    view.touch("touchstart", 0);
    view.window.dispatchEvent(new Event("blur"));
    expect(view.ondrag).not.toHaveBeenCalled();
  });

  it("ignores a closed panel, secondary buttons, and nonprimary pointers", () => {
    const view = fixture();
    for (const extra of [{ button: 1 }, { isPrimary: false }]) {
      view.pointer("pointerdown", view.body, 0, 0, 100, extra);
      view.pointer("pointerup", view.body, 0, 100, 200);
    }
    view.dialog.open = false;
    view.pointer("pointerdown");
    view.pointer("pointerup", view.body, 0, 100, 200);
    expect(view.dismiss).not.toHaveBeenCalled();
    view.detach();
  });
});
