import type { Currency, Edition, Item } from "#lib/types/index.ts";

const priceFormatters = {
  USD: {
    whole: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    fractional: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  EUR: {
    whole: new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
    fractional: new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
} satisfies Record<Currency, Record<"whole" | "fractional", Intl.NumberFormat>>;

export function formatPrice(cents?: number, currency: Currency = "USD") {
  if (cents == null) return "Not priced";
  const formatter = cents % 100 === 0 ? priceFormatters[currency].whole : priceFormatters[currency].fractional;
  return formatter.format(cents / 100);
}

// default exchange rate: 1 EUR = 1.13 USD.
const EUR_TO_USD = 1.13;

export function formatPriceTotals(totals: Partial<Record<Currency, number>>) {
  const usdCents = (totals.USD ?? 0) + (totals.EUR ?? 0) * EUR_TO_USD;
  return formatPrice(Math.round(usdCents));
}

export function editionMaterials(edition: Edition) {
  return edition.materials ?? [];
}

export function editionGameplay(item: Partial<Item>, edition: Edition) {
  return (Object.hasOwn(edition, "gameplay") ? edition.gameplay : item.gameplay) === true;
}
