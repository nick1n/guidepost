import { createContext } from "svelte";
import { Effect } from "effect";
import type { AppPreferences } from "#lib/app/preferences/preferences.svelte.ts";
import { currencies, defaultEuroRate, ExchangeError } from "./model.ts";
import type { RateSnapshot, RateStorage } from "./exchange-rates.ts";
import { formatPriceTotals } from "#lib/kdm-data.ts";
import type { Currency } from "#lib/types/index.ts";

export class CurrencyPreferences {
  #snapshot = $state.raw<RateSnapshot>();
  #pending = $state(false);
  #unavailable = $state(false);
  #initialized = $state(false);
  readonly rates: Readonly<Record<string, number>> = $derived(
    this.#snapshot ? Object.fromEntries(this.#snapshot.rates.map(({ quote, rate }) => [quote, rate])) : { USD: defaultEuroRate },
  );
  readonly date = $derived(
    this.#snapshot?.rates.reduce((date, rate) => (rate.date < date ? rate.date : date), this.#snapshot.rates[0].date),
  );

  constructor(private readonly preferences: AppPreferences) {}

  get currency() {
    return this.preferences.currency;
  }

  get ready() {
    return (
      this.preferences.ready && this.#initialized && (!this.#pending || this.currency === "EUR" || this.rates[this.currency] !== undefined)
    );
  }

  get pending() {
    return this.#pending;
  }

  get unavailable() {
    return this.#unavailable;
  }

  setCurrency(value: string) {
    const currency = currencies.find((currency) => currency === value);
    if (currency) this.preferences.save({ currency });
  }

  formatTotals(totals: Partial<Record<Currency, number>>) {
    return formatPriceTotals(totals, this.currency, this.rates);
  }

  refresh = Effect.fn("CurrencyPreferences.refresh")({ self: this }, function* (storage: RateStorage | undefined = globalThis.caches) {
    if (this.#pending) return;
    this.#pending = true;
    yield* Effect.tryPromise({
      try: () => import("./exchange-rates.ts"),
      catch: (cause) => new ExchangeError({ operation: "fetch", cause }),
    }).pipe(
      Effect.flatMap(({ loadRates }) =>
        loadRates(storage, this.#snapshot, (snapshot) => {
          if (snapshot) this.#snapshot = snapshot;
          this.#initialized = true;
        }),
      ),
      Effect.tap((snapshot) =>
        Effect.sync(() => {
          this.#snapshot = snapshot;
          this.#unavailable = false;
        }),
      ),
      Effect.tapError(() =>
        Effect.sync(() => {
          this.#unavailable = true;
          this.#initialized = true;
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          this.#pending = false;
        }),
      ),
    );
  });
}

export const [getCurrencyPreferences, setCurrencyPreferences] = createContext<CurrencyPreferences>();
