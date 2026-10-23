import { afterEach, expect, it, vi } from "vitest";
import { GlassPreferences } from "#lib/app/glass-preferences.svelte.ts";
import { AppPreferences } from "#lib/app/preferences.svelte.ts";

afterEach(() => vi.unstubAllGlobals());

function fixture(reduced = false, saved: boolean | null = null) {
  const events = new EventTarget();
  const query = {
    matches: reduced,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  vi.stubGlobal("window", { matchMedia: () => query });
  const app = new AppPreferences();
  app.glass = saved;
  const preferences = new GlassPreferences(app);
  const stop = preferences.start();
  const system = (reduce: boolean) => {
    query.matches = reduce;
    events.dispatchEvent(new Event("change"));
  };
  return { preferences, system, stop, app };
}

it("follows system changes without saving a default and removes its listener on teardown", () => {
  const f = fixture();
  expect(f.preferences.enabled).toBe(true);
  f.system(true);
  expect(f.preferences.enabled).toBe(false);
  expect(f.app.hasPendingChanges).toBe(false);
  f.stop();
  f.system(false);
  expect(f.preferences.enabled).toBe(false);
});

it.each([false, true])("restores a saved %s override even when it matches the current system", (enabled) => {
  const f = fixture(!enabled, enabled);
  f.system(enabled);
  expect(f.preferences.enabled).toBe(enabled);
});

it("clears the override when the user toggles back to the current system value", () => {
  const f = fixture();
  f.preferences.setEnabled(false);
  expect(f.app.glass).toBe(false);
  f.preferences.setEnabled(true);
  expect(f.app.glass).toBe(null);
  f.system(true);
  expect(f.preferences.enabled).toBe(false);
});

it("keeps an override through matching system changes until the user makes another choice", () => {
  const f = fixture();
  f.preferences.setEnabled(false);
  f.system(true);
  expect(f.app.glass).toBe(false);
  f.system(false);
  expect(f.preferences.enabled).toBe(false);
  f.preferences.setEnabled(true);
  expect(f.app.glass).toBe(null);
});
