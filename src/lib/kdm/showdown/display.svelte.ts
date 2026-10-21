import { createContext, type Snippet } from "svelte";

export type Density = "compact" | "default" | "comfortable";
export type Snap = "left" | "center" | "right" | "free";

export class ShowdownDisplay {
  settings = $state({
    density: "default" as Density,
    snap: "free" as Snap,
    borderLightness: 72,
    foregroundLightness: 95,
    backgroundLightness: 38,
    brightenZachary: false,
  });
  summary = $state.raw<Snippet>();
  #align: Noop = () => {};

  register(summary: Snippet, align: Noop) {
    this.summary = summary;
    this.#align = align;
    return () => {
      if (this.#align !== align) return;
      this.summary = undefined;
      this.#align = () => {};
    };
  }

  alignDashboard() {
    this.#align();
  }

  setSnap(value: Snap) {
    this.settings.snap = value;
    requestAnimationFrame(() => this.alignDashboard());
  }
}

export const [getShowdownDisplay, setShowdownDisplay] = createContext<ShowdownDisplay>();
