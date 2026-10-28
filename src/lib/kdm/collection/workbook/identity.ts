import type { Metadata } from "#lib/types/workbook.ts";

type Product = { name: string; material?: unknown };

/** Matches visible products to their metadata even when a sort leaves the hidden column in place. */
export function workbookIdentities(byRow: ReadonlyMap<number, Metadata>) {
  const byName = new Map<string, Metadata[]>();
  for (const metadata of byRow.values()) byName.set(metadata.name, [...(byName.get(metadata.name) ?? []), metadata]);

  return (row: number, product: Product) => {
    const matches = (metadata: Metadata) =>
      metadata.name === product.name &&
      (!("material" in product) || !Object.hasOwn(metadata.baseline, "H") || (product.material || null) === (metadata.baseline.H || null));
    const retained = byRow.get(row);
    if (retained && matches(retained)) return retained;
    const candidates = (byName.get(product.name) ?? []).filter(matches);
    return candidates.length === 1 ? candidates[0] : undefined;
  };
}
