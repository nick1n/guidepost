import type * as Schema from "../../src/lib/types/gen/kdm-data.d.ts";

// Staging accepts source labels and extra fields before normalization and schema validation.
export type Edition = Omit<Schema.Edition, "id" | "label" | "format"> & {
  id?: string;
  label: string;
  format?: "physical" | "digital";
  [field: string]: unknown;
};
export type Inclusion = Schema.Inclusion;
export type Item = Omit<Schema.Item, "kind" | "accessoryType" | "editions"> & {
  kind?: string;
  accessoryType?: string;
  editions?: Edition[];
  [field: string]: unknown;
};
export const categories = ["content", "included-only", "accessories", "bundles", "homebrew"] as const;
export type Category = (typeof categories)[number];
export type Catalog = Record<Category, Record<string, Item>> & { $schema?: string };
export type Variant = {
  [field: string]: unknown;
  id: number;
  title: string;
  price: number;
  compare_at_price: number | null;
  requires_shipping: boolean;
  sku: string;
};
export type Product = { id: number; title: string; handle: string; description: string; variants: Variant[]; [field: string]: unknown };
export type Evidence = { url: string; checkedAt: string; data: Product };
export type Mapping = {
  category: Category;
  itemId: string;
  edition?: string;
  create?: Partial<Item> & Pick<Item, "name">;
  gameplay?: boolean;
  materials?: string[];
  replaceUrl?: boolean;
  releaseDate?: string;
  variantEditions?: Record<string, string>;
  variantIds?: number[];
};
