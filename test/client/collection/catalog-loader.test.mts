import { expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Fiber, Queue } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { vi } from "vitest";
import { loadCatalog } from "#lib/kdm/collection/catalog-loader.ts";
import catalog from "#catalog/data.json";

const url = "https://guidepost.test/test-base/kdm/catalog/data.json";

it.effect("loads and validates the asset without trace propagation or preload-incompatible headers", () =>
  Effect.gen(function* () {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(catalog));
    const result = yield* loadCatalog(url).pipe(Effect.provide(FetchHttpClient.layer), Effect.provideService(FetchHttpClient.Fetch, fetch));
    expect(result).toEqual(catalog);
    const [requested, options] = fetch.mock.calls[0] ?? [];
    expect(String(requested)).toBe(url);
    expect(options).toMatchObject({ method: "GET", signal: expect.any(AbortSignal), headers: {} });
  }),
);

it.effect.each([
  ["status", () => Promise.resolve(new Response("Missing", { status: 404 }))],
  ["transport", () => Promise.reject(new TypeError("Failed to fetch"))],
  ["invalid-data", () => Promise.resolve(new Response("not JSON"))],
  ["invalid-data", () => Promise.resolve(Response.json({ content: {} }))],
  ["invalid-data", () => Promise.resolve(Response.json({ ...catalog, content: { model: { name: 123, tags: [] } } }))],
  ["invalid-data", () => Promise.resolve(Response.json({ ...catalog, extra: true }))],
] as const)("classifies %s failures", ([reason, fetch]) =>
  Effect.gen(function* () {
    const error = yield* loadCatalog(url).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, fetch),
      Effect.flip,
    );
    expect(error).toMatchObject({ _tag: "CatalogLoadError", reason });
  }),
);

it.effect("keeps HTTP defects as defects", () =>
  Effect.gen(function* () {
    const client = HttpClient.make(() => Effect.die("broken client"));
    const exit = yield* loadCatalog(url).pipe(Effect.provideService(HttpClient.HttpClient, client), Effect.exit);
    expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
  }),
);

it.effect.each(["request", "body"] as const)("interrupts the real HTTP %s signal", (stage) =>
  Effect.gen(function* () {
    const started = yield* Queue.unbounded<AbortSignal>();
    const fetch: typeof globalThis.fetch = (_, options) => {
      const signal = options?.signal;
      if (!signal) throw new Error("Missing request signal");
      if (stage === "request") {
        Queue.offerUnsafe(started, signal);
        return new Promise(() => {});
      }
      return Promise.resolve(
        new Response(
          new ReadableStream({
            pull() {
              Queue.offerUnsafe(started, signal);
            },
          }),
        ),
      );
    };
    const fiber = yield* loadCatalog(url).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, fetch),
      Effect.forkChild,
    );
    const signal = yield* Queue.take(started);
    yield* Fiber.interrupt(fiber);
    expect(signal.aborted).toBe(true);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
  }),
);
