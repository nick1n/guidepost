import { describe, expect, it, vi } from "vitest";
import { MenuSession } from "#lib/app/menu-session.ts";

function fixture({ attach = true, gutter = "auto" } = {}) {
  const root = { clientWidth: 980, style: { overflow: "scroll", scrollbarGutter: "" } };
  const trigger = {
    isConnected: true,
    focus: vi.fn(),
    getBoundingClientRect: () => ({ width: 48, right: 992, bottom: 792 }),
  };
  const previous = { isConnected: true, focus: vi.fn() };
  const window = Object.assign(new EventTarget(), {
    innerWidth: 1000,
    innerHeight: 800,
    getComputedStyle: () => ({ scrollbarGutter: gutter }),
  });
  const document = {
    defaultView: window,
    documentElement: root,
    activeElement: previous,
    querySelector: vi.fn(() => trigger),
  };
  const properties = new Map<string, string>();
  const dialog = Object.assign(new EventTarget(), {
    ownerDocument: document,
    open: false,
    style: {
      right: "",
      bottom: "",
      setProperty: (key: string, value: string) => properties.set(key, value),
      removeProperty: (key: string) => properties.delete(key),
    },
    getBoundingClientRect: vi.fn(() => ({ right: 984, bottom: 800 })),
    showModal: vi.fn(() => {
      dialog.open = true;
    }),
    close: vi.fn(() => {
      dialog.open = false;
    }),
  });
  let historyOpen = false;
  const history = {
    isOpen: () => historyOpen,
    open: vi.fn(async () => {}),
    back: vi.fn(),
    navigate: vi.fn(async (_href: string) => {}),
  };
  const onchange = vi.fn();
  const report = vi.fn();
  const session = new MenuSession({ history, onchange, report });
  const synchronize = (open: boolean) => {
    historyOpen = open;
    session.synchronize(open);
  };
  const mount = () => session.attach(dialog as unknown as HTMLDialogElement);
  const detach = attach ? mount() : undefined;
  return { session, history, onchange, report, dialog, root, window, trigger, previous, properties, synchronize, mount, detach };
}

function click(overrides: Partial<MouseEvent> = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as MouseEvent;
}

describe("menu session", () => {
  it("waits for history before opening, follows Back and Forward, and does not duplicate resources", async () => {
    const view = fixture();
    await view.session.open();
    expect(view.history.open).toHaveBeenCalledOnce();
    expect(view.dialog.open).toBe(false);
    view.synchronize(true);
    view.synchronize(true);
    expect(view.dialog.showModal).toHaveBeenCalledOnce();
    expect(view.root.style).toEqual({ overflow: "hidden", scrollbarGutter: "stable" });
    view.session.close();
    view.session.close();
    expect(view.history.back).toHaveBeenCalledOnce();
    expect(view.dialog.open).toBe(true);
    view.synchronize(false);
    await Promise.resolve();
    expect(view.previous.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(view.root.style).toEqual({ overflow: "scroll", scrollbarGutter: "" });
    view.synchronize(true);
    expect(view.dialog.showModal).toHaveBeenCalledTimes(2);
    expect(view.history.open).toHaveBeenCalledOnce();
    view.detach!();
  });

  it("honors history synchronization before attachment and realigns on resize", () => {
    const view = fixture({ attach: false });
    view.synchronize(true);
    const detach = view.mount();
    expect(view.dialog.open).toBe(true);
    expect(view.properties.get("--viewport-width")).toBe("1000px");
    expect(view.properties.get("--toggle-size")).toBe("48px");
    expect(view.properties.get("--toggle-padding-inline")).toBe("8px");
    expect(view.dialog.style.right).toBe("-16px");
    view.window.innerWidth = 1200;
    view.window.dispatchEvent(new Event("resize"));
    expect(view.properties.get("--viewport-width")).toBe("1200px");
    detach();
    const calls = view.dialog.getBoundingClientRect.mock.calls.length;
    view.window.dispatchEvent(new Event("resize"));
    expect(view.dialog.getBoundingClientRect).toHaveBeenCalledTimes(calls);
  });

  it("intercepts native Escape cancellation and dismisses only backdrop clicks", () => {
    const view = fixture();
    view.synchronize(true);
    const cancel = new Event("cancel", { cancelable: true });
    view.dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(view.history.back).toHaveBeenCalledOnce();
    expect(view.dialog.open).toBe(true);
    view.synchronize(false);
    view.synchronize(true);
    const inside = new Event("click");
    Object.defineProperty(inside, "target", { value: {} });
    view.dialog.dispatchEvent(inside);
    expect(view.history.back).toHaveBeenCalledOnce();
    view.dialog.dispatchEvent(new Event("click"));
    expect(view.history.back).toHaveBeenCalledTimes(2);
    view.detach!();
  });

  it("uses the current trigger when previous focus has left and preserves an existing gutter", async () => {
    const view = fixture({ gutter: "stable both-edges" });
    view.root.style.scrollbarGutter = "stable both-edges";
    await view.session.open();
    view.synchronize(true);
    expect(view.root.style.scrollbarGutter).toBe("stable both-edges");
    view.previous.isConnected = false;
    view.synchronize(false);
    await Promise.resolve();
    expect(view.previous.focus).not.toHaveBeenCalled();
    expect(view.trigger.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(view.root.style.scrollbarGutter).toBe("stable both-edges");
    view.detach!();
  });

  it("does not restore focus if Forward reopens the menu before the microtask", async () => {
    const view = fixture();
    await view.session.open();
    view.synchronize(true);
    view.synchronize(false);
    view.synchronize(true);
    await Promise.resolve();
    expect(view.previous.focus).not.toHaveBeenCalled();
    view.detach!();
  });

  it("defers plain link navigation until history closes and leaves modified links to the browser", async () => {
    const view = fixture();
    await view.session.open();
    view.synchronize(true);
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const event = click(modifier);
      view.session.navigate(event, "/other");
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(view.history.back).not.toHaveBeenCalled();
    const event = click();
    view.session.navigate(event, "/other");
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(view.history.back).toHaveBeenCalledOnce();
    expect(view.history.navigate).not.toHaveBeenCalled();
    view.synchronize(false);
    expect(view.history.navigate).toHaveBeenCalledWith("/other");
    expect(view.root.style.overflow).toBe("scroll");
    await Promise.resolve();
    expect(view.previous.focus).not.toHaveBeenCalled();
    view.detach!();
  });

  it("reports opening and navigation failures and permits an opening retry", async () => {
    const view = fixture();
    view.history.open.mockRejectedValueOnce(new Error("open failed"));
    await view.session.open();
    expect(view.report).toHaveBeenCalledWith("The menu could not be opened. Please try again.");
    await view.session.open();
    expect(view.history.open).toHaveBeenCalledTimes(2);
    view.synchronize(true);
    view.history.navigate.mockRejectedValueOnce(new Error("navigation failed"));
    view.session.navigate(click(), "/other");
    view.synchronize(false);
    await Promise.resolve();
    expect(view.report).toHaveBeenLastCalledWith("The page could not be opened. Please try again.");
    view.detach!();
  });

  it("deduplicates pending opens and releases resources and pending outcomes on disposal", async () => {
    const view = fixture();
    const pending = Promise.withResolvers<void>();
    view.history.open.mockReturnValue(pending.promise);
    const opening = view.session.open();
    await view.session.open();
    expect(view.history.open).toHaveBeenCalledOnce();
    view.synchronize(true);
    view.session.navigate(click(), "/other");
    view.detach!();
    expect(view.dialog.open).toBe(false);
    expect(view.root.style).toEqual({ overflow: "scroll", scrollbarGutter: "" });
    view.dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(view.history.back).toHaveBeenCalledOnce();
    pending.reject(new Error("late failure"));
    await opening;
    expect(view.report).not.toHaveBeenCalled();
    view.synchronize(false);
    expect(view.history.navigate).not.toHaveBeenCalled();
    expect(view.previous.focus).not.toHaveBeenCalled();
  });

  it("discards a pending focus restoration after disposal", async () => {
    const view = fixture();
    await view.session.open();
    view.synchronize(true);
    view.synchronize(false);
    view.detach!();
    await Promise.resolve();
    expect(view.previous.focus).not.toHaveBeenCalled();
    expect(view.trigger.focus).not.toHaveBeenCalled();
  });

  it("does not report a late navigation failure after disposal", async () => {
    const view = fixture();
    const pending = Promise.withResolvers<void>();
    view.history.navigate.mockReturnValue(pending.promise);
    view.synchronize(true);
    view.session.navigate(click(), "/other");
    view.synchronize(false);
    expect(view.history.navigate).toHaveBeenCalledOnce();
    view.detach!();
    pending.reject(new Error("late navigation failure"));
    await Promise.resolve();
    expect(view.report).not.toHaveBeenCalled();
  });
});
