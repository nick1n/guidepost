import { expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Fiber, Queue } from "effect";
import { FetchHttpClient } from "effect/http";
import { vi } from "vitest";
import { CatalogSession } from "#lib/kdm/collection/catalog-session.svelte.ts";
import * as loader from "#lib/kdm/collection/catalog-loader.ts";
import { Collection } from "#lib/kdm/collection/state/collection.svelte.ts";
import { reportAction } from "#lib/app/actions.ts";
import { Notifications } from "#lib/app/notifications/notifications.ts";
import catalog from "#catalog/data.json";

const url = "https://guidepost.test/kdm/catalog/data.json";

it.effect.each(["interrupt", "defect"] as const)("preserves mixed %s causes without exposing a stale typed error", (kind) =>
  Effect.gen(function* () {
    const session = new CatalogSession(new Collection());
    const error = new loader.CatalogLoadError({ reason: "transport", cause: "transport failure" });
    const cause = Cause.combine(Cause.fail(error), kind === "interrupt" ? Cause.interrupt() : Cause.die("defect"));
    const load = vi.spyOn(loader, "loadCatalog").mockImplementation(() => Effect.failCause(cause));
    yield* Effect.gen(function* () {
      const notices: string[] = [];
      const exit = yield* reportAction(session.load(url)).pipe(
        Effect.provide(Notifications.layerWith((notice) => notices.push(notice.message))),
        Effect.exit,
      );
      expect(session.error).toBeUndefined();
      expect(session.pending).toBe(false);
      expect(session.failed).toBe(kind === "defect");
      if (kind === "interrupt") {
        expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
        expect(notices).toEqual([]);
      } else {
        expect(notices).toEqual(["Something unexpected prevented that action. Please try again."]);
      }
    }).pipe(Effect.ensuring(Effect.sync(() => load.mockRestore())));
  }),
);

it.effect("defers requests, deduplicates pending attempts, installs once, and reuses across route sessions", () =>
  Effect.gen(function* () {
    const collection = new Collection();
    const session = new CatalogSession(collection);
    const started = yield* Queue.unbounded<void>();
    let resolve = (_: Response) => {};
    const fetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
          Queue.offerUnsafe(started, undefined);
        }),
    );
    const load = session.load(url);
    expect(fetch).not.toHaveBeenCalled();
    expect(session.pending).toBe(false);
    const fiber = yield* load.pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.forkChild);
    yield* Queue.take(started);
    expect(session.pending).toBe(true);
    yield* session.load(url);
    expect(fetch).toHaveBeenCalledOnce();
    resolve(Response.json(catalog));
    yield* Fiber.join(fiber);
    expect(collection.hasCatalog).toBe(true);
    expect(collection.shopUpdated).toBe(catalog.shopUpdated);
    expect(session.pending).toBe(false);
    expect(session.error).toBeUndefined();
    const install = vi.spyOn(collection, "setCatalog");
    yield* session.dispose();
    yield* new CatalogSession(collection).load(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    expect(fetch).toHaveBeenCalledOnce();
    expect(install).not.toHaveBeenCalled();
  }),
);

it.effect("retains typed failures separately from storage state and retries with a fresh request", () =>
  Effect.gen(function* () {
    const collection = new Collection();
    const session = new CatalogSession(collection);
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json(catalog));
    const first = yield* session.load(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.flip);
    expect(session.error).toBe(first);
    expect(session.failed).toBe(true);
    expect(session.pending).toBe(false);
    expect(collection.hasCatalog).toBe(false);
    expect(collection.loadStatus).toBe("pending");
    expect(collection.loadError).toBeUndefined();
    yield* session.load(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(session.error).toBeUndefined();
    expect(collection.hasCatalog).toBe(true);
    expect(session.failed).toBe(false);
  }),
);

it.effect("a pending retry clears the preceding failure and disposal clears retry state", () =>
  Effect.gen(function* () {
    const session = new CatalogSession(new Collection());
    const started = yield* Queue.unbounded<void>();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>(() => {
            Queue.offerUnsafe(started, undefined);
          }),
      );
    yield* session.load(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.exit);
    expect(session.failed).toBe(true);
    expect(session.error).toBeInstanceOf(loader.CatalogLoadError);
    const retry = yield* session.load(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.forkChild);
    yield* Queue.take(started);
    expect(session.pending).toBe(true);
    expect(session.failed).toBe(false);
    expect(session.error).toBeUndefined();
    yield* session.dispose();
    const exit = yield* Fiber.await(retry);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(session.pending).toBe(false);
    expect(session.failed).toBe(false);
    expect(session.error).toBeUndefined();
  }),
);

it.effect.each(["success", "failure"] as const)("disposal aborts and silences a late %s", (outcome) =>
  Effect.gen(function* () {
    const collection = new Collection();
    const session = new CatalogSession(collection);
    const started = yield* Queue.unbounded<AbortSignal>();
    let resolve = (_: Response) => {};
    let reject = (_: unknown) => {};
    const fetch: typeof globalThis.fetch = (_, options) =>
      new Promise<Response>((done, fail) => {
        resolve = done;
        reject = fail;
        if (!options?.signal) throw new Error("Missing signal");
        Queue.offerUnsafe(started, options.signal);
      });
    const errors = vi.fn();
    const notices = Notifications.layerWith(errors);
    const fiber = yield* reportAction(session.load(url)).pipe(
      Effect.provide(notices),
      Effect.provideService(FetchHttpClient.Fetch, fetch),
      Effect.forkChild,
    );
    const signal = yield* Queue.take(started);
    yield* session.dispose();
    expect(signal.aborted).toBe(true);
    if (outcome === "success") resolve(Response.json(catalog));
    else reject(new Error("late failure"));
    yield* Effect.yieldNow;
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(collection.hasCatalog).toBe(false);
    expect(session.pending).toBe(false);
    expect(session.error).toBeUndefined();
    expect(errors).not.toHaveBeenCalled();
    const retry = yield* Effect.exit(session.load(url));
    expect(Exit.isFailure(retry) && Cause.hasInterrupts(retry.cause)).toBe(true);
  }),
);

it.effect("disposal interrupts body consumption and rejects its late decoded catalog", () =>
  Effect.gen(function* () {
    const collection = new Collection();
    const session = new CatalogSession(collection);
    const started = yield* Queue.unbounded<AbortSignal>();
    let finish = () => {};
    const fetch: typeof globalThis.fetch = (_, options) => {
      const signal = options?.signal;
      if (!signal) throw new Error("Missing signal");
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              finish = () => {
                controller.enqueue(new TextEncoder().encode(JSON.stringify(catalog)));
                controller.close();
              };
            },
            pull() {
              Queue.offerUnsafe(started, signal);
            },
          }),
        ),
      );
    };
    const fiber = yield* session.load(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.forkChild);
    const signal = yield* Queue.take(started);
    yield* session.dispose();
    expect(signal.aborted).toBe(true);
    finish();
    yield* Effect.yieldNow;
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(collection.hasCatalog).toBe(false);
    expect(session.pending).toBe(false);
    expect(session.error).toBeUndefined();
  }),
);

it.effect("installation defects retain the full cause without becoming typed request errors", () =>
  Effect.gen(function* () {
    const collection = new Collection();
    const session = new CatalogSession(collection);
    const defect = new Error("installation defect");
    vi.spyOn(collection, "setCatalog").mockImplementation(() => {
      throw defect;
    });
    const exit = yield* session.load(url).pipe(
      Effect.provideService(FetchHttpClient.Fetch, async () => Response.json(catalog)),
      Effect.exit,
    );
    expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
    expect(session.error).toBeUndefined();
    expect(session.pending).toBe(false);
    expect(session.failed).toBe(true);
  }),
);
