import { Schema } from "effect";
import { CatalogInputError } from "./review/schema.mts";
import { categories } from "./types.mts";
import type { Mapping } from "./types.mts";

const id = Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
const text = Schema.String.check(Schema.isPattern(/\S/, { expected: "a nonblank string" }));
const variantId = Schema.Int.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const selector = Schema.String.check(
  Schema.isPattern(/^[1-9][0-9]*$/),
  Schema.makeFilter((value) => Number.isSafeInteger(Number(value))),
);
// Creation facts remain intact for normalization and full catalog validation later.
const create = Schema.StructWithRest(Schema.Struct({ name: text }), [Schema.Record(Schema.String, Schema.Unknown)]);
const mapping = Schema.Struct({
  category: Schema.Literals(categories),
  itemId: id,
  editionId: Schema.optionalKey(id),
  editionLabel: Schema.optionalKey(text),
  create: Schema.optionalKey(create),
  gameplay: Schema.optionalKey(Schema.Boolean),
  materials: Schema.optionalKey(Schema.mutable(Schema.Array(text))),
  replaceUrl: Schema.optionalKey(Schema.Boolean),
  retired: Schema.optionalKey(text),
  releaseDate: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))),
  variantEditionIds: Schema.optionalKey(Schema.Record(selector, id)),
  variantIds: Schema.optionalKey(Schema.mutable(Schema.Array(variantId))),
}).check(
  Schema.makeFilter((value) =>
    value.editionId !== undefined && value.editionLabel !== undefined
      ? "Use either editionId for an existing edition or editionLabel for a new release"
      : undefined,
  ),
);
const decode = Schema.decodeUnknownSync(Schema.Record(id, mapping), { onExcessProperty: "error" });

/** Decode the optional local file before any requests or publication. */
export function parseMappings(text: string | undefined, path: string): Record<string, Mapping> {
  if (text === undefined) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new CatalogInputError({ message: `Malformed mapping JSON in ${path}; fix the JSON syntax and rerun.`, cause });
  }
  try {
    return decode(value);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new CatalogInputError({ message: `Invalid mappings in ${path}; fix the indicated field and rerun. ${detail}`, cause });
  }
}
