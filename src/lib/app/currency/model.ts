import { Schema } from "effect";

export const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const;

export const DisplayCurrency = Schema.Literals(currencies);
export type DisplayCurrency = typeof DisplayCurrency.Type;

export const rateCacheName = "guidepost-exchange-rates-v1";

// Approximate EUR/USD conversion until a downloaded snapshot is available.
export const defaultEuroRate = 1.13;

export class ExchangeError extends Schema.TaggedError<ExchangeError>()("ExchangeError", {
  operation: Schema.Literals(["fetch", "cache"]),
  cause: Schema.Defect(),
}) {
  get message() {
    return "Exchange rates could not be updated. Showing saved rates, the default EUR/USD estimate, or original currencies.";
  }
}
