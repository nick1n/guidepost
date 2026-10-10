import { afterEach, expect, it, vi } from "vitest";
import { tick } from "svelte";
import { CollectionCards } from "#lib/collection-cards.svelte.ts";

const instances: CollectionCards[] = [];
afterEach(() => {
  for (const cards of instances.splice(0)) cards.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixture() {
  const cards = new CollectionCards(Array.from({ length: 10 }, (_, index) => ({ id: `card-${index}` })));
  instances.push(cards);
  const observers: FakeObserver[] = [];
  class FakeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(readonly callback: IntersectionObserverCallback) {
      observers.push(this);
    }
    report(target: HTMLElement, isIntersecting: boolean) {
      this.callback([{ target, isIntersecting } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return { cards, observers };
}

function viewport() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const style = { overflowAnchor: "auto" };
  let top = 100;
  const card = {
    isConnected: true,
    getClientRects: () => [1],
    getBoundingClientRect: () => ({ top }),
  };
  const window = Object.assign(new EventTarget(), {
    scrollBy: vi.fn((options: ScrollToOptions) => {
      top -= options.top ?? 0;
    }),
  });
  vi.stubGlobal("document", {
    documentElement: { style },
    getElementById: () => ({ closest: () => card }),
  });
  vi.stubGlobal("window", window);
  return {
    style,
    card,
    window,
    move: (value: number) => {
      top = value;
    },
    get top() {
      return top;
    },
  };
}

it("keeps initial bodies ready, applies bulk collapse to every card, and renders individually opened bodies", () => {
  const { cards } = fixture();
  expect(cards.state("card-0", 0)).toEqual({ ready: true, collapsed: false });
  expect(cards.state("card-9", 9)).toEqual({ ready: false, collapsed: false });
  expect(cards.toggleAll()).toBe("All cards collapsed.");
  expect(cards.allCollapsed).toBe(true);
  expect(cards.state("card-9", 9).collapsed).toBe(true);
  cards.toggle("card-9");
  expect(cards.allCollapsed).toBe(false);
  expect(cards.state("card-9", 9)).toEqual({ ready: true, collapsed: false });
  cards.toggleAll();
  expect(cards.state("card-9", 9).ready).toBe(true);
  expect(new CollectionCards([]).allCollapsed).toBe(false);
});

it("defers distant controls and expands only nearby bodies while retaining previously rendered controls", () => {
  const { cards, observers } = fixture();
  const near = {} as HTMLElement;
  const far = {} as HTMLElement;
  const detachNear = cards.observe("card-8")(near)!;
  const detachFar = cards.observe("card-9")(far)!;
  expect(observers).toHaveLength(1);
  cards.toggleAll();
  observers[0].report(near, true);
  expect(cards.state("card-8", 8).ready).toBe(false);
  cards.toggleAll();
  expect(cards.state("card-8", 8).ready).toBe(true);
  expect(cards.state("card-9", 9).ready).toBe(false);
  observers[0].report(far, true);
  expect(cards.state("card-9", 9).ready).toBe(true);
  detachNear();
  expect(observers[0].disconnect).not.toHaveBeenCalled();
  detachFar();
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(cards.observe("card-9")(far)).toBeUndefined();
});

it("discards viewport membership when a card leaves and disconnects resources on disposal", () => {
  const { cards, observers } = fixture();
  const element = {} as HTMLElement;
  cards.observe("card-9")(element);
  cards.toggleAll();
  observers[0].report(element, true);
  observers[0].report(element, false);
  cards.toggleAll();
  expect(cards.state("card-9", 9).ready).toBe(false);
  cards.dispose();
  observers[0].report(element, true);
  expect(cards.state("card-9", 9).ready).toBe(false);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(cards.observe("card-8")(element)).toBeUndefined();
});

it("keeps a held card anchored through deferred layout changes, then restores native anchoring", async () => {
  const { cards } = fixture();
  const view = viewport();
  cards.toggleAll();
  expect(cards.toggleAll("card-9")).toBe("All cards expanded.");
  expect(cards.state("card-9", 9).ready).toBe(true);
  expect(view.style.overflowAnchor).toBe("none");
  view.move(160);
  await tick();
  expect(view.top).toBe(100);
  view.move(140);
  vi.advanceTimersByTime(16);
  expect(view.top).toBe(100);
  vi.advanceTimersByTime(1000);
  expect(view.style.overflowAnchor).toBe("auto");
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["wheel", "touchmove", "pointerdown", "keydown"])("yields scrolling immediately to %s input", async (event) => {
  const { cards } = fixture();
  const view = viewport();
  cards.toggleAll("card-9");
  await tick();
  view.window.dispatchEvent(new Event(event));
  view.move(300);
  vi.advanceTimersByTime(1000);
  expect(view.top).toBe(300);
  expect(view.style.overflowAnchor).toBe("auto");
  expect(vi.getTimerCount()).toBe(0);
});

it("supersedes pending anchors and cancels before a deferred correction on disposal", async () => {
  const { cards } = fixture();
  const view = viewport();
  cards.toggleAll("card-8");
  view.move(200);
  cards.toggleAll("card-9");
  view.move(250);
  await tick();
  expect(view.top).toBe(200);
  expect(view.window.scrollBy).toHaveBeenCalledOnce();
  cards.dispose();
  expect(view.style.overflowAnchor).toBe("auto");
  expect(vi.getTimerCount()).toBe(0);
  const next = fixture().cards;
  next.toggleAll("card-9");
  next.dispose();
  view.move(500);
  await tick();
  expect(view.top).toBe(500);
  expect(view.style.overflowAnchor).toBe("auto");
});

it("stops correcting a detached card", async () => {
  const { cards } = fixture();
  const view = viewport();
  cards.toggleAll("card-9");
  view.card.isConnected = false;
  await tick();
  expect(view.window.scrollBy).not.toHaveBeenCalled();
  expect(view.style.overflowAnchor).toBe("auto");
  expect(vi.getTimerCount()).toBe(0);
});
