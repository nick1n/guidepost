import type { Currency, Edition, Item } from "#lib/types/index.ts";

const currencyLocales: Readonly<Record<string, string>> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  CAD: "en-CA",
  AUD: "en-AU",
  JPY: "ja-JP",
};

const currencyFormatters = new Map<string, { whole: Intl.NumberFormat; fractional: Intl.NumberFormat; precision: number }>();

export function formatPrice(cents?: number, currency: Currency = "USD") {
  if (cents == null) return "Not priced";
  const formatters = getFormatters(currency);
  const formatter = cents % 100 === 0 ? formatters.whole : formatters.fractional;
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
  const formatters = getFormatters(currency);
  const amount = Math.round((total / 100) * formatters.precision) / formatters.precision;
  return (Number.isInteger(amount) ? formatters.whole : formatters.fractional).format(amount);
}

function getFormatters(currency: string) {
  let formatters = currencyFormatters.get(currency);
  if (!formatters) {
    const locale = currencyLocales[currency] ?? "en-US";
    const fractional = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters = {
      whole: new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
      fractional,
      precision: 10 ** (fractional.resolvedOptions().maximumFractionDigits ?? 2),
    };
    currencyFormatters.set(currency, formatters);
  }
  return formatters;
}

export function editionMaterials(edition: Edition) {
  return edition.materials ?? [];
}

export function editionGameplay(item: Partial<Item>, edition: Edition) {
  return (Object.hasOwn(edition, "gameplay") ? edition.gameplay : item.gameplay) === true;
}
