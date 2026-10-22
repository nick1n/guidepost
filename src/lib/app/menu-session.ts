type Options = {
  history: {
    isOpen: () => boolean;
    open: () => Promise<unknown>;
    back: () => void;
    navigate: (href: string) => Promise<unknown>;
  };
  onchange: (open: boolean) => void;
  report: (message: string) => void;
};

/** Coordinates the menu's history entry with its native modal and browser resources. */
export class MenuSession {
  #options: Options;
  #dialog: HTMLDialogElement | undefined;
  #wanted = false;
  #open = false;
  #opening = false;
  #closing = false;
  #destination: string | undefined;
  #returnFocus: HTMLElement | undefined;
  #unlock: (() => void) | undefined;
  #generation = 0;

  constructor(options: Options) {
    this.#options = options;
  }

  attach = (dialog: HTMLDialogElement) => {
    this.#dialog = dialog;
    const window = dialog.ownerDocument.defaultView!;
    const onclick = (event: MouseEvent) => {
      if (event.target === dialog) this.close();
    };
    const oncancel = (event: Event) => {
      event.preventDefault();
      this.close();
    };
    dialog.addEventListener("click", onclick);
    dialog.addEventListener("cancel", oncancel);
    window.addEventListener("resize", this.#align);
    this.synchronize(this.#wanted);
    return () => {
      this.#generation++;
      dialog.removeEventListener("click", onclick);
      dialog.removeEventListener("cancel", oncancel);
      window.removeEventListener("resize", this.#align);
      dialog.close();
      this.#release();
      this.#dialog = undefined;
      this.#open = false;
      this.#opening = false;
      this.#closing = false;
      this.#destination = undefined;
      this.#returnFocus = undefined;
      this.#options.onchange(false);
    };
  };

  open = async () => {
    const dialog = this.#dialog;
    if (!dialog || this.#opening || this.#closing || this.#open || this.#options.history.isOpen()) return;
    this.#opening = true;
    const generation = this.#generation;
    const active = dialog.ownerDocument.activeElement;
    this.#returnFocus = active && "focus" in active ? (active as HTMLElement) : undefined;
    try {
      await this.#options.history.open();
    } catch {
      if (generation === this.#generation) this.#options.report("The menu could not be opened. Please try again.");
    } finally {
      if (generation === this.#generation) this.#opening = false;
    }
  };

  close = () => {
    if (!this.#dialog || this.#closing || !this.#options.history.isOpen()) return;
    this.#closing = true;
    this.#options.history.back();
  };

  navigate = (event: MouseEvent, href: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.#destination = href;
    this.close();
  };

  synchronize(open: boolean) {
    this.#wanted = open;
    const dialog = this.#dialog;
    if (!dialog) return;
    const wasOpen = this.#open;
    this.#open = open;
    if (open) {
      if (!wasOpen) {
        this.#lock();
        this.#options.onchange(true);
        dialog.showModal();
      }
      this.#align();
      return;
    }

    dialog.close();
    this.#release();
    this.#closing = false;
    this.#options.onchange(false);
    const destination = this.#destination;
    this.#destination = undefined;
    if (destination) {
      void this.#navigate(destination);
    } else if (wasOpen) {
      const trigger = this.#returnFocus?.isConnected ? this.#returnFocus : this.#trigger();
      const generation = this.#generation;
      queueMicrotask(() => {
        if (generation === this.#generation && !this.#open) trigger?.focus({ preventScroll: true });
      });
    }
    this.#returnFocus = undefined;
  }

  async #navigate(href: string) {
    const generation = this.#generation;
    try {
      await this.#options.history.navigate(href);
    } catch {
      if (generation === this.#generation) this.#options.report("The page could not be opened. Please try again.");
    }
  }

  #trigger() {
    return this.#dialog?.ownerDocument.querySelector<HTMLElement>("[data-menu-trigger]") ?? undefined;
  }

  #align = () => {
    const dialog = this.#dialog;
    const trigger = this.#trigger();
    if (!dialog || !this.#open || !trigger) return;
    const { innerWidth, innerHeight } = dialog.ownerDocument.defaultView!;
    dialog.style.removeProperty("right");
    dialog.style.removeProperty("bottom");
    dialog.style.setProperty("--viewport-width", `${innerWidth}px`);
    const target = trigger.getBoundingClientRect();
    dialog.style.setProperty("--toggle-size", `${target.width}px`);
    dialog.style.setProperty("--toggle-padding-inline", `${innerWidth - target.right}px`);
    dialog.style.setProperty("--toggle-padding-block", `${innerHeight - target.bottom}px`);
    const bounds = dialog.getBoundingClientRect();
    // Root scrollbar gutters can inset fixed elements; dock the panel to the physical viewport edge.
    dialog.style.right = `${bounds.right - innerWidth}px`;
    dialog.style.bottom = `${bounds.bottom - innerHeight}px`;
  };

  #lock() {
    const document = this.#dialog!.ownerDocument;
    const window = document.defaultView!;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    const gutter = root.style.scrollbarGutter;
    // Keep the visible scrollbar's space when locking a scrolling page.
    if (window.innerWidth > root.clientWidth && window.getComputedStyle(root).scrollbarGutter === "auto") {
      root.style.scrollbarGutter = "stable";
    }
    root.style.overflow = "hidden";
    this.#unlock = () => {
      root.style.overflow = overflow;
      root.style.scrollbarGutter = gutter;
    };
  }

  #release() {
    this.#unlock?.();
    this.#unlock = undefined;
  }
}
