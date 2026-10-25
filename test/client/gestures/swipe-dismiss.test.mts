import { describe, expect, it } from "vitest";
import { Element, event, swipeFixture } from "./swipe-fixture.mts";

function fixture() {
  return swipeFixture({ dialog: true, directions: ["down"], threshold: 64, duration: 1500 });
}

describe("menu swipe dismissal", () => {
  it("tracks a downward drag outside the panel without falling behind the pointer and dismisses on release", () => {
    const view = fixture();
    view.pointer("pointerdown");
    expect(view.pointer("pointermove", 4, 40, 200, { target: view.document }).defaultPrevented).toBe(true);
    expect(view.onDrag).toHaveBeenLastCalledWith(40, false);
    view.pointer("pointermove", 4, 240, 300, { target: view.document });
    expect(view.onDrag).toHaveBeenLastCalledWith(240, true);
    view.pointer("pointerup", 4, 240, 400, { target: view.document });
    expect(view.onSwipe).toHaveBeenCalledOnce();
    view.detach();
  });

  it.each(["input", "select", "textarea", "[contenteditable]", "[role=slider]"])(
    "leaves %s and its children in charge of their gestures",
    (selector) => {
      const view = fixture();
      const control = new Element(selector, view.child);
      const child = new Element("span", control);
      view.pointer("pointerdown", 0, 0, 100, { target: child });
      expect(view.pointer("pointermove", 0, 100, 200, { target: child }).defaultPrevented).toBe(false);
      view.pointer("pointerup", 0, 100, 300, { target: child });
      expect(view.onSwipe).not.toHaveBeenCalled();
      expect(view.onDrag).toHaveBeenLastCalledWith(0);
      view.detach();
    },
  );

  it.each(["a", "button", "summary", "[role=button]"])("allows mouse dismissal starting on %s without activating it", (selector) => {
    const view = fixture();
    const target = new Element("span", new Element(selector, view.child));
    view.pointer("pointerdown", 0, 0, 100, { target });
    expect(view.pointer("pointermove", 0, 100, 200, { target }).defaultPrevented).toBe(true);
    view.pointer("pointerup", 0, 100, 300, { target });
    expect(view.onSwipe).toHaveBeenCalledOnce();
    const click = event("click", { target, detail: 1, timeStamp: 310 });
    view.surface.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    view.detach();
  });

  it("preserves a mouse click on a row and suppresses its click after an incomplete drag", () => {
    const view = fixture();
    const target = new Element("button", view.child);
    view.pointer("pointerdown", 0, 0, 100, { target });
    view.pointer("pointerup", 0, 2, 200, { target });
    const click = event("click", { target, detail: 1, timeStamp: 210 });
    view.surface.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    view.pointer("pointerdown", 0, 0, 300, { target });
    view.pointer("pointermove", 0, 40, 400, { target });
    view.pointer("pointerup", 0, 40, 500, { target });
    const dragClick = event("click", { target, detail: 1, timeStamp: 510 });
    view.surface.dispatchEvent(dragClick);
    expect(dragClick.defaultPrevented).toBe(true);
    expect(view.onSwipe).not.toHaveBeenCalled();
    expect(view.onDrag).toHaveBeenLastCalledWith(0);
    view.detach();
  });

  it.each(["dragstart", "selectstart"])("prevents native %s from taking over a mouse dismissal", (type) => {
    const view = fixture();
    const target = new Element("a", view.child);
    view.pointer("pointerdown", 0, 0, 100, { target });
    const native = event(type, { target });
    view.surface.dispatchEvent(native);
    expect(native.defaultPrevented).toBe(true);
    view.pointer("pointermove", 0, 100, 200, { target });
    view.pointer("pointerup", 0, 100, 300, { target });
    expect(view.onSwipe).toHaveBeenCalledOnce();
    view.detach();
  });

  it("leaves scrolled content alone, but permits a downward dismissal at its top or from the grip", () => {
    const view = fixture();
    view.child.scrollHeight = 500;
    view.child.scrollTop = 40;
    view.child.overflowY = "auto";
    view.pointer("pointerdown");
    view.pointer("pointermove", 0, 100, 200);
    view.pointer("pointerup", 0, 100, 300);
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.child.scrollTop = 0;
    view.pointer("pointerdown");
    view.pointer("pointerup", 0, 100, 300);
    expect(view.onSwipe).toHaveBeenCalledOnce();
    view.child.scrollTop = 40;
    view.pointer("pointerdown", 0, 0, 100, { target: view.handle });
    view.pointer("pointerup", 0, 100, 300, { target: view.handle });
    expect(view.onSwipe).toHaveBeenCalledTimes(2);
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
    view.pointer("pointermove", x, y, time);
    view.pointer("pointerup", x, y, time + 1);
    expect(view.onSwipe).not.toHaveBeenCalled();
    expect(view.onDrag).toHaveBeenLastCalledWith(0);
    view.detach();
  });

  it("handles touch events once without duplicate dismissal from touch pointer events", () => {
    const view = fixture();
    view.touch("touchstart", 0, 0);
    view.pointer("pointerdown", 0, 0, 100, { pointerType: "touch" });
    expect(view.touch("touchmove", 0, 100, 200).defaultPrevented).toBe(true);
    view.pointer("pointerup", 0, 100, 250, { pointerType: "touch" });
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.touch("touchend", 0, 100, 300);
    expect(view.onSwipe).toHaveBeenCalledOnce();
    view.detach();
  });

  it.each(["a", "button", "summary", "[role=button]"])("allows touch dismissal starting on %s without activating it", (selector) => {
    const view = fixture();
    const target = new Element("span", new Element(selector, view.child));
    view.touch("touchstart", 0, 0, 100, { target });
    expect(view.touch("touchmove", 0, 100, 200, { target }).defaultPrevented).toBe(true);
    view.touch("touchend", 0, 100, 300, { target });
    expect(view.onSwipe).toHaveBeenCalledOnce();
    const click = event("click", { target, detail: 1, timeStamp: 310 });
    view.surface.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    view.detach();
  });

  it.each(["input", "select", "textarea", "[contenteditable]", "[role=slider]"])("preserves touch interaction with %s", (selector) => {
    const view = fixture();
    const target = new Element(selector, view.child);
    view.touch("touchstart", 0, 0, 100, { target });
    expect(view.touch("touchmove", 0, 100, 200, { target }).defaultPrevented).toBe(false);
    view.touch("touchend", 0, 100, 300, { target });
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.detach();
  });

  it("does not turn a row tap into dismissal or suppress its click", () => {
    const view = fixture();
    const target = new Element("button", view.child);
    view.touch("touchstart", 0, 0, 100, { target });
    view.touch("touchend", 0, 2, 200, { target });
    const click = event("click", { target, detail: 1, timeStamp: 210 });
    view.surface.dispatchEvent(click);
    expect(view.onSwipe).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(false);
    view.detach();
  });

  it("suppresses a row click after an incomplete drag", () => {
    const view = fixture();
    const target = new Element("button", view.child);
    view.touch("touchstart", 0, 0, 100, { target });
    view.touch("touchmove", 0, 40, 200, { target });
    view.touch("touchend", 0, 40, 300, { target });
    const click = event("click", { target, detail: 1, timeStamp: 310 });
    view.surface.dispatchEvent(click);
    expect(view.onSwipe).not.toHaveBeenCalled();
    expect(view.onDrag).toHaveBeenLastCalledWith(0);
    expect(click.defaultPrevented).toBe(true);
    view.detach();
  });

  it("cancels once native touch scrolling has taken over", () => {
    const view = fixture();
    view.touch("touchstart", 0, 0);
    view.touch("touchmove", 0, 30, 200, { cancelable: false });
    view.touch("touchend", 0, 100, 300);
    expect(view.onSwipe).not.toHaveBeenCalled();
    expect(view.onDrag).toHaveBeenLastCalledWith(0);
    view.detach();
  });

  it("cancels multitouch and ignores an unrelated touch ending", () => {
    const view = fixture();
    view.touch("touchstart", 0, 0);
    view.touch("touchend", 0, 100, 200, { changedTouches: [{ identifier: 2, clientX: 0, clientY: 100 }] });
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.touch("touchmove", 0, 100, 300, { touches: [{ identifier: 1 }, { identifier: 2 }] });
    view.touch("touchend", 0, 100, 400);
    expect(view.onSwipe).not.toHaveBeenCalled();
    expect(view.onDrag).toHaveBeenLastCalledWith(0);
    view.detach();
  });

  it("suppresses the synthetic click after dismissal while retaining keyboard and later clicks", () => {
    const view = fixture();
    view.pointer("pointerdown");
    view.pointer("pointerup", 0, 100, 300);
    const keyboard = event("click", { detail: 0, timeStamp: 400 });
    view.surface.dispatchEvent(keyboard);
    expect(keyboard.defaultPrevented).toBe(false);
    const synthetic = event("click", { detail: 1, timeStamp: 410 });
    view.surface.dispatchEvent(synthetic);
    expect(synthetic.defaultPrevented).toBe(true);
    const later = event("click", { detail: 1, timeStamp: 420 });
    view.surface.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
    view.detach();
  });

  it.each(["pointercancel", "blur", "detach"])("resets and stops a pending drag on %s", (action) => {
    const view = fixture();
    view.pointer("pointerdown");
    view.pointer("pointermove", 0, 40, 200);
    if (action === "detach") view.detach();
    else if (action === "pointercancel") view.pointer("pointercancel");
    else view.window.dispatchEvent(new Event(action));
    expect(view.onDrag).toHaveBeenLastCalledWith(0);
    view.pointer("pointerup", 0, 100, 300);
    expect(view.onSwipe).not.toHaveBeenCalled();
    if (action !== "detach") view.detach();
    view.onDrag.mockClear();
    view.pointer("pointerdown");
    view.touch("touchstart", 0, 0);
    view.window.dispatchEvent(new Event("blur"));
    expect(view.onDrag).not.toHaveBeenCalled();
  });

  it("ignores a closed panel, secondary buttons, and nonprimary pointers", () => {
    const view = fixture();
    for (const extra of [{ button: 1 }, { isPrimary: false }]) {
      view.pointer("pointerdown", 0, 0, 100, { ...extra });
      view.pointer("pointerup", 0, 100, 200);
    }
    view.surface.open = false;
    view.pointer("pointerdown");
    view.pointer("pointerup", 0, 100, 200);
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.detach();
  });
});
