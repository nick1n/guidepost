import { expect, it } from "vitest";
import { formatPrice, formatPriceTotals } from "#lib/kdm-data.ts";

it("uses currency-specific separators for prices and totals", () => {
  expect(formatPrice(160927, "EUR")).toBe("1.609,27\u00a0€");
  expect(formatPrice(160900, "EUR")).toBe("1.609\u00a0€");
  expect(formatPriceTotals({ EUR: 160927 }, "EUR")).toBe("1.609,27\u00a0€");
  expect(formatPrice(160927, "USD")).toBe("$1,609.27");
});

it.each([
  ["USD", "$1,609.27"],
  ["GBP", "£1,609.27"],
  ["CAD", "$1,609.27"],
  ["AUD", "$1,609.27"],
  ["JPY", "￥1,609"],
])("formats the full converted total in %s", (currency, expected) => {
  expect(formatPriceTotals({ USD: 160927 }, currency, { USD: 1, [currency]: 1 })).toBe(expected);
});

it("omits fractional digits when a converted total rounds to a whole amount", () => {
  expect(formatPriceTotals({ USD: 10001 }, "EUR", { USD: 1.0001 })).toBe("100\u00a0€");
  expect(formatPriceTotals({ EUR: 101 }, "JPY", { JPY: 160 })).toBe("￥162");
});
