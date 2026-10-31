import { Predicate, Result, Schema, Struct } from "effect";

const recordContainer = Schema.Unknown.check(
  Schema.makeFilter(
    (input) => Predicate.isObject(input) && (Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null),
    { expected: "a plain preference record" },
  ),
);

/** Default absent fields, validate present values (including undefined), and retain unknown fields on saves. */
export function preferenceDecoder<Fields extends Record<string, Schema.ConstraintDecoder<unknown>>>(
  schema: Schema.Struct<Fields>,
  defaults: Schema.Struct<Fields>["Type"],
) {
  const decode = Schema.decodeUnknownResult(
    recordContainer.pipe(
      Schema.decodeTo(
        Schema.StructWithRest(schema.mapFields(Struct.map(Schema.optionalKey)), [Schema.Record(Schema.String, Schema.Unknown)]),
      ),
    ),
  );
  return (input: unknown) => Result.map(decode(input), (record) => ({ ...defaults, ...record }));
}
