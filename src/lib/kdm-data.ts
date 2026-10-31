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

const totalFormatters = new Map<string, { whole: Intl.NumberFormat; fractional: Intl.NumberFormat; precision: number }>();

export function formatPrice(cents?: number, currency: Currency = "USD") {
  if (cents == null) return "Not priced";
  const formatter = cents % 100 === 0 ? priceFormatters[currency].whole : priceFormatters[currency].fractional;
  return formatter.format(cents / 100);
}

export function formatPriceTotals(totals: Partial<Record<Currency, number>>, currency = "USD", rates?: Readonly<Record<string, number>>) {
  const amounts = Object.entries(totals).filter(([, cents]) => cents !== 0);
  const rate = (code: string) => (code === "EUR" ? 1 : rates?.[code]);
  let total = 0;
  for (const [source, cents] of amounts) {
    if (source === currency) total += cents;
    else {
      const from = rate(source),
        to = rate(currency);
      if (!from || !to) return amounts.map(([code, amount]) => formatPrice(amount, code as Currency)).join(" + ");
      total += (cents / from) * to;
    }
  }
  let formatters = totalFormatters.get(currency);
  if (!formatters) {
    const fractional = new Intl.NumberFormat(undefined, { style: "currency", currency });
    formatters = {
      whole: new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }),
      fractional,
      precision: 10 ** (fractional.resolvedOptions().maximumFractionDigits ?? 2),
    };
    totalFormatters.set(currency, formatters);
  }
  const amount = Math.round((total / 100) * formatters.precision) / formatters.precision;
  return (Number.isInteger(amount) ? formatters.whole : formatters.fractional).format(amount);
}

export function editionMaterials(edition: Edition) {
  return edition.materials ?? [];
}

export function editionGameplay(item: Partial<Item>, edition: Edition) {
  return (Object.hasOwn(edition, "gameplay") ? edition.gameplay : item.gameplay) === true;
}
