import { createContext } from "svelte";

export class SiteMenu {
  open = $state(false);
  onopen: Noop = () => {};

  registerOpen(callback: Noop) {
    this.onopen = callback;
    return () => {
      if (this.onopen === callback) this.onopen = () => {};
    };
  }
}

export const [getSiteMenu, setSiteMenu] = createContext<SiteMenu>();
