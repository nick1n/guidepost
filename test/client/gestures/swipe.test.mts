import { describe, expect, it, vi } from "vitest";
import { Element, event, swipeFixture as fixture } from "./swipe-fixture.mts";

describe("directional swipes", () => {
  it.each([
    { direction: "left", x: -80, y: 2, distance: -80 },
    { direction: "right", x: 80, y: 2, distance: 80 },
    { direction: "up", x: 2, y: -80, distance: -80 },
    { direction: "down", x: 2, y: 80, distance: 80 },
  ] as const)("recognizes $direction with signed drag feedback", ({ direction, x, y, distance }) => {
    const view = fixture({ directions: ["left", "right", "up", "down"] });
    view.touch("touchstart");
    expect(view.touch("touchmove", x, y, 200).defaultPrevented).toBe(true);
    expect(view.onDrag).toHaveBeenLastCalledWith(distance, true);
    view.touch("touchend", x, y, 300);
    expect(view.onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
    expect(view.onDrag).toHaveBeenLastCalledWith(0);
    view.detach();
  });

  it("leaves disabled directions to native scrolling and never reclaims that gesture", () => {
    const view = fixture({ directions: ["up"] });
    view.touch("touchstart");
    expect(view.touch("touchmove", 80, 0, 200).defaultPrevented).toBe(false);
    view.touch("touchend", 0, -100, 300);
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.detach();
  });

  it("preserves horizontal scrolling without blocking an enabled vertical swipe", () => {
    const view = fixture({ directions: ["left", "up"] });
    view.child.scrollWidth = 300;
    view.child.overflowX = "auto";
    view.touch("touchstart");
    view.touch("touchend", -100, 0, 300);
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.touch("touchstart");
    view.touch("touchend", 0, -100, 300);
    expect(view.onSwipe).toHaveBeenCalledExactlyOnceWith("up");
    view.detach();
  });

  it("allows vertical swipes only at the corresponding scroll edge", () => {
    const view = fixture({ directions: ["up", "down"] });
    view.child.scrollHeight = 300;
    view.child.overflowY = "auto";
    for (const [scrollTop, expected] of [
      [0, "down"],
      [50, undefined],
      [200, "up"],
    ] as const) {
      view.child.scrollTop = scrollTop;
      view.onSwipe.mockClear();
      for (const y of [-80, 80]) {
        view.touch("touchstart");
        view.touch("touchend", 0, y, 300);
      }
      if (expected) expect(view.onSwipe).toHaveBeenCalledExactlyOnceWith(expected);
      else expect(view.onSwipe).not.toHaveBeenCalled();
    }
    view.detach();
  });

  it.each(["mouse", "touch"])("applies custom distance and duration limits to %s", (input) => {
    const view = fixture({ directions: ["down"], threshold: 100, duration: 250 });
    const fire = input === "mouse" ? view.pointer : view.touch;
    for (const [distance, time] of [
      [80, 200],
      [120, 400],
      [120, 200],
    ]) {
      fire(input === "mouse" ? "pointerdown" : "touchstart");
      fire(input === "mouse" ? "pointerup" : "touchend", 0, distance, time);
    }
    expect(view.onSwipe).toHaveBeenCalledExactlyOnceWith("down");
    view.detach();
  });

  it("enforces touch duration without scheduling feedback when none is requested", () => {
    vi.useFakeTimers();
    const view = fixture({ feedback: false });
    try {
      view.touch("touchstart");
      expect(vi.getTimerCount()).toBe(0);
      view.touch("touchend", 100, 0, 900);
      expect(view.onSwipe).not.toHaveBeenCalled();
      expect(view.onDrag).not.toHaveBeenCalled();
    } finally {
      view.detach();
      vi.useRealTimers();
    }
  });

  it("ignores nested dialogs and native touch scrolling", () => {
    const view = fixture({ directions: ["left", "up"] });
    view.child.parentElement = new Element("dialog");
    view.touch("touchstart");
    view.touch("touchend", -100, 0, 300);
    view.child.parentElement = view.surface;
    view.touch("touchstart");
    view.touch("touchmove", -100, 0, 200, { cancelable: false });
    view.touch("touchend", -100, 0, 300);
    expect(view.onSwipe).not.toHaveBeenCalled();
    view.detach();
  });

  it("supports upward touch gestures without also flipping or activating the touched control", () => {
    const view = fixture({ directions: ["left", "right", "up"] });
    view.touch("touchstart", 100, 200);
    expect(view.touch("touchmove", 102, 100, 200).defaultPrevented).toBe(true);
    view.touch("touchend", 102, 100, 300);
    expect(view.onSwipe).toHaveBeenCalledExactlyOnceWith("up");
    const click = event("click", { detail: 1, timeStamp: 301 });
    view.element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    view.touch("touchstart", 100, 100);
    view.touch("touchmove", 100, 200, 200);
    view.touch("touchend", 100, 200, 300);
    expect(view.onSwipe).toHaveBeenCalledTimes(1);
    view.touch("touchstart", 100, 200);
    view.touch("touchmove", 102, 100, 200);
    view.touch("touchend", 102, 100, 900);
    expect(view.onSwipe).toHaveBeenCalledTimes(1);
    view.touch("touchstart");
    view.touch("touchmove", -100, 2, 200);
    view.touch("touchend", -100, 2, 300);
    expect(view.onSwipe).toHaveBeenNthCalledWith(2, "left");
    view.detach();
  });
  it.each([false, true])("supports slow mouse dragging and suppresses only its following pointer click, page=%s", (page) => {
    const view = fixture({ page });
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
    if (kind === "control") view.child.selector = "input";
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
