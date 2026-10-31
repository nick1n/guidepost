import { expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import { formatPriceTotals } from "#lib/kdm-data.ts";
import { AppPreferences } from "#lib/app/preferences/preferences.svelte.ts";
import { appDefaults, decodeAppRecord, type AppValues } from "#lib/app/preferences/preference-store.ts";
import { CurrencyPreferences } from "#lib/app/currency/preferences.svelte.ts";
import { defaultEuroRate, rateCacheName } from "#lib/app/currency/model.ts";
import { loadRates, rateMaxAge, rateUrl, type RateSnapshot } from "#lib/app/currency/exchange-rates.ts";

const rates = [
  { base: "EUR" as const, quote: "USD", date: "2026-10-29", rate: 1.2 },
  { base: "EUR" as const, quote: "GBP", date: "2026-10-29", rate: 0.8 },
  { base: "EUR" as const, quote: "JPY", date: "2026-10-29", rate: 160 },
];
const snapshot: RateSnapshot = { fetchedAt: 0, rates };

function fixture(saved: unknown = snapshot) {
  let stored = saved;
  const cache = {
    match: vi.fn<Cache["match"]>(() => Promise.resolve(stored === undefined ? undefined : Response.json(stored))),
    put: vi.fn<Cache["put"]>(async (_key, response) => {
      stored = await response.json();
    }),
  };
  const storage = { open: vi.fn(() => Promise.resolve(cache)) };
  const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(Response.json(rates)));
  const provide = <A, E>(effect: Effect.Effect<A, E>) => effect.pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
  return { cache, storage, fetch, provide, load: () => provide(loadRates(storage)), stored: () => stored };
}

const startPreferences = Effect.fn("CurrencyTest.startPreferences")(function* (load: Effect.Effect<AppValues>) {
  const app = new AppPreferences(undefined, Effect.succeed({ load: () => load, save: () => Effect.void, close: () => {} }));
  const session = yield* Effect.forkChild(app.run(), { startImmediately: true });
  return { app, money: new CurrencyPreferences(app), session };
});

it.effect("waits for the saved currency even when rates are already loaded", () =>
  Effect.gen(function* () {
    const saved = yield* Deferred.make<AppValues>();
    const { app, money, session } = yield* startPreferences(Deferred.await(saved));
    const f = fixture();
    yield* f.provide(money.refresh(f.storage));
    expect(money.ready).toBe(false);
    expect(app.ready).toBe(false);
    yield* Deferred.succeed(saved, { ...appDefaults, currency: "GBP" } satisfies AppValues);
    yield* Effect.yieldNow;
    expect(money.ready).toBe(true);
    expect(money.formatTotals({ USD: 12000 })).toBe("£80");
    yield* Fiber.interrupt(session);
  }),
);

it.effect("waits for the initial cached-rate read instead of displaying original USD prices", () =>
  Effect.gen(function* () {
    const { money, session } = yield* startPreferences(Effect.succeed({ ...appDefaults, currency: "GBP" }));
    const f = fixture();
    const started = yield* Deferred.make<void>();
    const saved = yield* Deferred.make<Response>();
    f.cache.match.mockImplementation(() => {
      Effect.runSync(Deferred.succeed(started, undefined));
      return Effect.runPromise(Deferred.await(saved));
    });
    const loading = yield* Effect.forkChild(f.provide(money.refresh(f.storage)));
    yield* Deferred.await(started);
    expect(money.currency).toBe("GBP");
    expect(money.ready).toBe(false);
    yield* Deferred.succeed(saved, Response.json(snapshot));
    yield* Fiber.join(loading);
    expect(money.ready).toBe(true);
    expect(money.formatTotals({ USD: 12000 })).toBe("£80");
    yield* Fiber.interrupt(session);
  }),
);

it.effect.each([true, false])("uses saved rates during revalidation when available: %s", (cached) =>
  Effect.gen(function* () {
    const { money, session } = yield* startPreferences(Effect.succeed({ ...appDefaults, currency: "GBP" }));
    const f = fixture(cached ? snapshot : null);
    const started = yield* Deferred.make<void>();
    const response = yield* Deferred.make<Response>();
    f.fetch.mockImplementation(() => {
      Effect.runSync(Deferred.succeed(started, undefined));
      return Effect.runPromise(Deferred.await(response));
    });
    yield* TestClock.setTime(rateMaxAge + 1);
    const loading = yield* Effect.forkChild(f.provide(money.refresh(f.storage)));
    yield* Deferred.await(started);
    expect(money.pending).toBe(true);
    expect(money.ready).toBe(cached);
    yield* Deferred.succeed(response, Response.json(rates));
    yield* Fiber.join(loading);
    expect(money.ready).toBe(true);
    expect(money.formatTotals({ USD: 12000 })).toBe("£80");
    yield* Fiber.interrupt(session);
  }),
);

it.effect("unblocks the offline fallback after an initial rate request fails", () =>
  Effect.gen(function* () {
    const { money, session } = yield* startPreferences(Effect.succeed({ ...appDefaults, currency: "GBP" }));
    const f = fixture(null);
    f.fetch.mockRejectedValue(new TypeError("Offline"));
    yield* Effect.exit(f.provide(money.refresh(f.storage)));
    expect(money.ready).toBe(true);
    expect(money.formatTotals({ USD: 12000 })).toBe("$120");
    money.setCurrency("EUR");
    expect(money.ready).toBe(true);
    expect(money.formatTotals({ EUR: 10000 })).toBe("€100");
    yield* Fiber.interrupt(session);
  }),
);

it.effect("defers cache and HTTP access, reuses rates through 24 hours, then refreshes once", () =>
  Effect.gen(function* () {
    const f = fixture();
    const loading = f.load();
    expect(f.storage.open).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
    yield* TestClock.setTime(rateMaxAge);
    expect(yield* loading).toEqual(snapshot);
    expect(f.fetch).not.toHaveBeenCalled();
    yield* TestClock.adjust(1);
    const fresh = yield* f.load();
    expect(fresh.fetchedAt).toBe(rateMaxAge + 1);
    expect(f.storage.open).toHaveBeenCalledWith(rateCacheName);
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(String(f.fetch.mock.calls[0][0])).toBe(rateUrl);
    const headers = new Headers(f.fetch.mock.calls[0][1]?.headers);
    expect(headers.has("traceparent")).toBe(false);
    expect(headers.has("b3")).toBe(false);
    expect(f.cache.put).toHaveBeenCalledOnce();
    expect(yield* f.load()).toEqual(fresh);
    expect(f.fetch).toHaveBeenCalledOnce();
  }),
);

it.effect("uses fetch time rather than the published date, including weekends", () =>
  Effect.gen(function* () {
    const f = fixture();
    yield* TestClock.setTime(rateMaxAge * 5);
    const fresh = yield* f.load();
    expect(fresh.rates[0].date).toBe("2026-10-29");
    yield* TestClock.adjust(rateMaxAge - 1);
    yield* f.load();
    expect(f.fetch).toHaveBeenCalledOnce();
  }),
);

it.effect("downloads and saves rates when the cache has no response", () =>
  Effect.gen(function* () {
    const f = fixture();
    f.cache.match.mockResolvedValue(undefined);
    expect(yield* f.load()).toEqual(snapshot);
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(f.stored()).toEqual(snapshot);
    expect(f.cache.put).toHaveBeenCalledOnce();
  }),
);

it.effect("shows saved rates before refreshing and never overwrites them on failure", () =>
  Effect.gen(function* () {
    const f = fixture();
    const oncached = vi.fn();
    f.fetch.mockRejectedValue(new TypeError("Offline"));
    yield* TestClock.setTime(rateMaxAge + 1);
    const error = yield* f.provide(loadRates(f.storage, undefined, oncached)).pipe(Effect.flip);
    expect(error).toMatchObject({ _tag: "ExchangeError", operation: "fetch" });
    expect(oncached).toHaveBeenCalledWith(snapshot);
    expect(f.cache.put).not.toHaveBeenCalled();
    expect(f.stored()).toEqual(snapshot);
  }),
);

it.effect.each([
  { name: "HTTP failure", response: () => new Response("Unavailable", { status: 503 }) },
  { name: "invalid JSON", response: () => new Response("not json") },
  { name: "zero rate", response: () => Response.json([{ ...rates[0], rate: 0 }]) },
  { name: "negative rate", response: () => Response.json([{ ...rates[0], rate: -1 }]) },
  { name: "wrong base", response: () => Response.json([{ ...rates[0], base: "USD" }]) },
  { name: "empty rates", response: () => Response.json([]) },
  { name: "invalid date", response: () => Response.json([{ ...rates[0], date: "2026-02-30" }]) },
])("rejects $name without replacing a good cache", ({ response }) =>
  Effect.gen(function* () {
    const f = fixture();
    f.fetch.mockImplementation(() => Promise.resolve(response()));
    yield* TestClock.setTime(rateMaxAge + 1);
    expect(yield* f.load().pipe(Effect.flip)).toMatchObject({ _tag: "ExchangeError", operation: "fetch" });
    expect(f.cache.put).not.toHaveBeenCalled();
  }),
);

it.effect("recovers from corrupt storage and refreshes a timestamp in the future", () =>
  Effect.gen(function* () {
    for (const saved of [
      { fetchedAt: "bad", rates },
      { ...snapshot, fetchedAt: rateMaxAge },
    ]) {
      const f = fixture(saved);
      expect((yield* f.load()).fetchedAt).toBe(0);
      expect(f.fetch).toHaveBeenCalledOnce();
      expect(f.cache.put).toHaveBeenCalledOnce();
    }
  }),
);

it.effect("keeps rates usable when Cache Storage is unavailable and prefers newer memory", () =>
  Effect.gen(function* () {
    const f = fixture();
    f.storage.open.mockRejectedValue(new Error("Storage blocked"));
    const current = yield* f.load();
    expect(current.rates).toEqual(rates);
    yield* f.provide(loadRates(f.storage, current));
    expect(f.fetch).toHaveBeenCalledOnce();
    const other = fixture();
    yield* TestClock.setTime(rateMaxAge + 1);
    const newer = { ...snapshot, fetchedAt: rateMaxAge };
    expect(yield* other.provide(loadRates(other.storage, newer))).toEqual(newer);
    expect(other.fetch).not.toHaveBeenCalled();
  }),
);

it.effect("aborts an interrupted request without writing or applying its result", () =>
  Effect.gen(function* () {
    const f = fixture(null);
    const started = yield* Deferred.make<AbortSignal>();
    f.fetch.mockImplementation((_url, options) => {
      if (!options?.signal) throw new Error("Missing request abort signal");
      Effect.runSync(Deferred.succeed(started, options.signal));
      return new Promise(() => {});
    });
    const preferences = new CurrencyPreferences(new AppPreferences());
    const loading = preferences.refresh(f.storage).pipe(Effect.provideService(FetchHttpClient.Fetch, f.fetch));
    expect(preferences.pending).toBe(false);
    const active = yield* Effect.forkChild(loading);
    const signal = yield* Deferred.await(started);
    expect(preferences.pending).toBe(true);
    yield* Fiber.interrupt(active);
    const exit = yield* Fiber.await(active);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(preferences.pending).toBe(false);
    expect(preferences.unavailable).toBe(false);
    expect(preferences.rates).toEqual({ USD: defaultEuroRate });
    expect(f.cache.put).not.toHaveBeenCalled();
  }),
);

it.effect("retains saved rates on offline failure and clears failure after a successful retry", () =>
  Effect.gen(function* () {
    const f = fixture();
    const preferences = new CurrencyPreferences(new AppPreferences());
    const refresh = preferences.refresh(f.storage).pipe(Effect.provideService(FetchHttpClient.Fetch, f.fetch));
    f.fetch.mockRejectedValueOnce(new TypeError("Offline"));
    yield* TestClock.setTime(rateMaxAge + 1);
    yield* Effect.exit(refresh);
    expect(preferences.unavailable).toBe(true);
    expect(preferences.date).toBe("2026-10-29");
    expect(preferences.formatTotals({ EUR: 10000 })).toBe("$120");
    yield* refresh;
    expect(preferences.unavailable).toBe(false);
  }),
);

it.effect("uses the default euro estimate offline without treating it as a fresh download", () =>
  Effect.gen(function* () {
    const f = fixture(null);
    const preferences = new CurrencyPreferences(new AppPreferences());
    const refresh = preferences.refresh(f.storage).pipe(Effect.provideService(FetchHttpClient.Fetch, f.fetch));
    expect(preferences.formatTotals({ USD: 11300, EUR: 10000 })).toBe("$226");
    preferences.setCurrency("EUR");
    expect(preferences.formatTotals({ USD: 11300, EUR: 10000 })).toBe("€200");
    expect(preferences.date).toBeUndefined();
    f.fetch.mockRejectedValueOnce(new TypeError("Offline"));
    yield* Effect.exit(refresh);
    expect(preferences.formatTotals({ USD: 11300, EUR: 10000 })).toBe("€200");
    expect(preferences.unavailable).toBe(true);
    expect(f.cache.put).not.toHaveBeenCalled();
    preferences.setCurrency("GBP");
    expect(preferences.formatTotals({ USD: 11300, EUR: 10000 })).toBe("$113 + €100");
    yield* refresh;
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(preferences.unavailable).toBe(false);
    expect(preferences.date).toBe("2026-10-29");
    preferences.setCurrency("USD");
    expect(preferences.formatTotals({ EUR: 10000 })).toBe("$120");
  }),
);

it("converts mixed totals via their common EUR base and respects currency fraction digits", () => {
  const table = { USD: 1.2, GBP: 0.8, JPY: 160 };
  expect(formatPriceTotals({ USD: 12000, EUR: 10000 }, "USD", table)).toBe("$240");
  expect(formatPriceTotals({ USD: 12000, EUR: 10000 }, "EUR", table)).toBe("€200");
  expect(formatPriceTotals({ USD: 12000, EUR: 10000 }, "GBP", table)).toBe("£160");
  expect(formatPriceTotals({ EUR: 101 }, "JPY", table)).toBe("¥162");
  expect(formatPriceTotals({ USD: 10001 }, "USD")).toBe("$100.01");
  expect(formatPriceTotals({ USD: 10000, EUR: 10000 })).toBe("$100 + €100");
  expect(formatPriceTotals({ USD: 10000 }, "GBP", { USD: 1.2 })).toBe("$100");
  expect(formatPriceTotals({}, "EUR")).toBe("€0");
});

it("defaults old preference records to USD and accepts only supported currency choices", () => {
  expect(decodeAppRecord({ dateFormat: "written" })).toEqual(Result.succeed({ ...appDefaults, dateFormat: "written" }));
  const app = new AppPreferences();
  const preferences = new CurrencyPreferences(app);
  expect(preferences.currency).toBe("USD");
  preferences.setCurrency("GBP");
  expect(app.currency).toBe("GBP");
  preferences.setCurrency("invalid");
  expect(app.currency).toBe("GBP");
});
