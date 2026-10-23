/// <reference types="vite/client" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  type Noop = () => void;
  type Timeout = ReturnType<typeof setTimeout> | undefined;

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    interface PageState {
      siteMenu?: boolean;
    }
    // interface Platform {}
  }
}

export {};
