import { tick } from "svelte";

/** Owns card presentation and its browser resources. Dispose when the collection page unmounts. */
export class CollectionCards {
  #entries: readonly { id: string }[];
  #collapsed = $state<Record<string, boolean>>({});
  #rendered = $state<Record<string, boolean>>({});
  #allCollapsed = $derived.by(() => this.#entries.length > 0 && this.#entries.every(({ id }) => this.#collapsed[id]));
  #nearby = new Set<string>();
  #observed = new Map<Element, string>();
  #observer: IntersectionObserver | undefined;
  #cancelScroll: (() => void) | undefined;
  #disposed = false;

  constructor(entries: readonly { id: string }[]) {
    this.#entries = entries;
  }

  get allCollapsed() {
    return this.#allCollapsed;
  }

  state(id: string, index: number) {
    return { ready: index < 6 || !!this.#rendered[id], collapsed: !!this.#collapsed[id] };
  }

  toggle(id: string) {
    const collapse = !this.#collapsed[id];
    if (!collapse) this.#rendered[id] = true;
    this.#collapsed[id] = collapse;
  }

  /** A held card remains at its current viewport position while every card changes. */
  toggleAll = (anchorId?: string) => {
    const card = anchorId ? document.getElementById(`card-body-${anchorId}`)?.closest("article") : undefined;
    const top = card?.getBoundingClientRect().top;
    const collapse = !this.allCollapsed;
    for (const { id } of this.#entries) {
      if (!collapse && (this.#nearby.has(id) || id === anchorId)) this.#rendered[id] = true;
      this.#collapsed[id] = collapse;
    }
    if (card && top !== undefined) void this.#scrollToCard(card, top);
    return collapse ? "All cards collapsed." : "All cards expanded.";
  };

  async #scrollToCard(card: HTMLElement, top: number) {
    this.#cancelScroll?.();
    const controller = new AbortController();
    const scrollStyle = document.documentElement.style;
    const overflowAnchor = scrollStyle.overflowAnchor;
    // Our correction owns scrolling while the card layout settles.
    scrollStyle.overflowAnchor = "none";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();
    let stableChecks = 0;
    const cancel = () => {
      controller.abort();
      scrollStyle.overflowAnchor = overflowAnchor;
      clearTimeout(timer);
      if (this.#cancelScroll === cancel) this.#cancelScroll = undefined;
    };
    this.#cancelScroll = cancel;
    // Deferred bodies and content-visibility can change layout again after scrolling reveals cards.
    // Keep the header anchored until those updates settle, yielding immediately to user input.
    await tick();
    if (controller.signal.aborted) return;
    for (const event of ["wheel", "touchmove", "pointerdown", "keydown"]) {
      window.addEventListener(event, cancel, { passive: true, signal: controller.signal });
    }
    function restorePosition() {
      if (!card.isConnected || !card.getClientRects().length) return cancel();
      const offset = card.getBoundingClientRect().top - top;
      if (Math.abs(offset) > 1) {
        stableChecks = 0;
        window.scrollBy({
          top: offset,
          behavior: "instant",
        });
      } else stableChecks += 1;
      if (stableChecks >= 6 || performance.now() - started >= 1000) cancel();
      else timer = setTimeout(restorePosition, 16);
    }
    // Apply the first correction before the browser can paint the changed card layout.
    restorePosition();
  }

  observe(id: string) {
    return (element: HTMLElement) => {
      if (this.#disposed || this.#rendered[id]) return;
      // One observer defers unopened card controls until they approach the viewport.
      this.#observer ??= new IntersectionObserver(
        (changes) => {
          for (const change of changes) {
            const id = this.#observed.get(change.target);
            if (!id) continue;
            if (change.isIntersecting) {
              this.#nearby.add(id);
              if (!this.#collapsed[id]) this.#rendered[id] = true;
            } else this.#nearby.delete(id);
          }
        },
        { rootMargin: "600px 0px" },
      );
      this.#observed.set(element, id);
      this.#observer.observe(element);
      return () => {
        this.#observer?.unobserve(element);
        this.#observed.delete(element);
        this.#nearby.delete(id);
        if (!this.#observed.size) {
          this.#observer?.disconnect();
          this.#observer = undefined;
        }
      };
    };
  }

  dispose = () => {
    this.#disposed = true;
    this.#cancelScroll?.();
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#observed.clear();
    this.#nearby.clear();
  };
}
