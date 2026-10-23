import { createContext } from "svelte";
import type { AppPreferences } from "./preferences.svelte.ts";

export class GlassPreferences {
  #system = $state(true);

  constructor(private readonly preferences: AppPreferences) {}

  get enabled() {
    return this.preferences.glass ?? this.#system;
  }

  /** The layout owns the browser preference listener and its cleanup. */
  start() {
    const query = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const onchange = () => {
      this.#system = !query.matches;
    };
    onchange();
    query.addEventListener("change", onchange);
    return () => query.removeEventListener("change", onchange);
  }

  setEnabled(enabled: boolean) {
    // Only user interaction may clear an override that matches the system.
    this.preferences.save({ glass: enabled === this.#system ? null : enabled });
  }
}

export const [getGlassPreferences, setGlassPreferences] = createContext<GlassPreferences>();
