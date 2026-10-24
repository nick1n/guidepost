import { error } from "@sveltejs/kit";
import { asset } from "$app/paths";
import { Effect, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { loadCatalog } from "#lib/kdm/collection/catalog-loader.ts";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch, url }) => {
  const result = await Effect.runPromise(
    loadCatalog(new URL(asset("kdm/catalog/data.json"), url).href).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, fetch),
      Effect.result,
    ),
  );
  if (Result.isFailure(result)) error(503, result.failure.message);
  return { catalog: result.success };
};
