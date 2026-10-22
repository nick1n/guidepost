import { createContext } from "svelte";

export class SiteMenu {
  open = $state(false);
  onopen: Noop = () => {};
  onclose: Noop = () => {};
  onback = $state<Noop | undefined>();

  register(actions: { open: Noop; close: Noop }) {
    this.onopen = actions.open;
    this.onclose = actions.close;
    return () => {
      if (this.onopen === actions.open) {
        this.onopen = () => {};
        this.onclose = () => {};
        this.onback = undefined;
      }
    };
  }
}

export const [getSiteMenu, setSiteMenu] = createContext<SiteMenu>();
