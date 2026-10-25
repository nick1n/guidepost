import { page } from "$app/state";
import { Cause, Effect } from "effect";
import { createContext, onMount, untrack } from "svelte";
import { navigate, type NavigationError } from "#lib/navigation.ts";

type Codec<Value> = { read: (hash: string) => Value; format: (value: Value) => string };
type Run = (operation: Effect.Effect<void, NavigationError>) => void;
type Browser = { current: () => URL; replace: (url: URL) => Effect.Effect<void, NavigationError>; run: Run };
type Request = { scope: string };

function pageScope(url: URL) {
  return `${url.origin}${url.pathname}${url.search}`;
}

/** One URL owner per app, including edits made inside the menu's separate history entry. */
export class HashNavigation {
  #browser: Browser;
  #hash = $state<string>();
  #pathname: string | undefined;
  #menuOpen = false;
  #pending: Request | undefined;

  constructor(browser: Browser) {
    this.#browser = browser;
  }

  get hash() {
    return this.#hash;
  }

  replace(next: string) {
    const current = this.#browser.current();
    const url = new URL(current);
    url.hash = next;
    this.#hash = url.hash;
    if (url.href === current.href && !this.#pending) return;
    const request = { scope: pageScope(current) };
    this.#pending = request;
    this.#browser.run(this.#settle(url, request));
  }

  #settle = Effect.fn("HashNavigation.settle")({ self: this }, function (url: URL, request: Request) {
    if (this.#pending !== request) return Effect.void;
    return this.#browser.replace(url).pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterrupts(cause) || Cause.hasDies(cause) || this.#pending === request) return Effect.failCause(cause);
        return Effect.void;
      }),
      Effect.ensuring(
        Effect.sync(() => {
          if (this.#pending !== request) return;
          this.#pending = undefined;
          this.#hash = this.#browser.current().hash;
        }),
      ),
    );
  });

  restore(url: URL, menuOpen: boolean) {
    const current = this.#browser.current();
    const retain = this.#menuOpen && !menuOpen && this.#pathname === url.pathname && url.pathname === current.pathname;
    this.#menuOpen = menuOpen;
    this.#pathname = current.pathname;
    if (retain) this.replace(this.#hash ?? "");
    else if (!this.#pending || pageScope(current) !== this.#pending.scope) {
      this.#pending = undefined;
      // SvelteKit can retain an earlier shallow URL after a native hash change.
      this.#hash = current.hash;
    }
  }

  hashChanged() {
    // Shallow menu dismissal restores framework state after the native hash event.
    if (!this.#menuOpen) {
      this.#pending = undefined;
      this.#hash = this.#browser.current().hash;
    }
  }
}

export function createHashNavigation(run: Run) {
  const navigation = new HashNavigation({
    current: () => new URL(window.location.href),
    replace: (url) =>
      navigate(url.href, "The page link could not be updated. Please try again.", {
        shallow: true,
        replace: true,
        state: page.state,
      }),
    run,
  });
  let mounted = $state(false);

  // SvelteKit restores shallow history without navigation hooks. Observe its URL and state together.
  $effect(() => {
    const url = page.shallow?.url ?? page.url;
    const open = Boolean(page.state.siteMenu);
    if (mounted) untrack(() => navigation.restore(new URL(url.href), open));
  });

  onMount(() => {
    mounted = true;
    navigation.restore(new URL(window.location.href), Boolean(page.state.siteMenu));
    const onhashchange = () => navigation.hashChanged();
    window.addEventListener("hashchange", onhashchange);
    return () => window.removeEventListener("hashchange", onhashchange);
  });
  return navigation;
}

export const [getHashNavigation, setHashNavigation] = createContext<HashNavigation>();

/** Each page supplies its codec; commands replace only the hash without resetting focus or scroll. */
export function createHashRoute<Value>(codec: Codec<Value>) {
  const navigation = getHashNavigation();
  const value = $derived(codec.read(navigation.hash ?? ""));
  return {
    get ready() {
      return navigation.hash !== undefined;
    },
    get value() {
      return value;
    },
    replace(next: Value) {
      return navigation.replace(codec.format(next));
    },
  };
}
