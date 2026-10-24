import { Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import validateCatalog from "#lib/gen/catalog-validator.js";

// The generated type guard validates the authoritative JSON Schema without browser compilation.
const CatalogSchema = Schema.declare(validateCatalog);

export class CatalogLoadError extends Schema.TaggedError<CatalogLoadError>()("CatalogLoadError", {
  reason: Schema.Literals(["transport", "status", "invalid-data"]),
  cause: Schema.Defect(),
}) {
  get message() {
    return "The catalog could not be loaded. Please try again.";
  }
}

export const loadCatalog = Effect.fn("Catalog.load")(function* (url: string) {
  const response = yield* HttpClient.get(url).pipe(Effect.mapError((cause) => new CatalogLoadError({ reason: "transport", cause })));
  yield* HttpClientResponse.filterStatusOk(response).pipe(Effect.mapError((cause) => new CatalogLoadError({ reason: "status", cause })));
  return yield* HttpClientResponse.schemaBodyJson(CatalogSchema, { onExcessProperty: "error" })(response).pipe(
    Effect.mapError((cause) => new CatalogLoadError({ reason: "invalid-data", cause })),
  );
});
