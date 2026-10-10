import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { workflow } from "#scripts/catalog/cli.mts";
import { checkListing } from "#scripts/check-shop-links.mts";
import { downloadNewsPage } from "#scripts/scrape-news-shop-links.mts";

it.effect("interruption waits for the promise workflow's cleanup", () =>
  Effect.gen(function* () {
    const entered = yield* Deferred.make<void>();
    const aborted = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    let cleaned = false;
    const fiber = yield* workflow(async (signal) => {
      Effect.runSync(Deferred.succeed(entered, undefined));
      await new Promise<void>((resolve) =>
        signal.addEventListener(
          "abort",
          () => {
            Effect.runSync(Deferred.succeed(aborted, undefined));
            resolve();
          },
          { once: true },
        ),
      );
      await Effect.runPromise(Deferred.await(release));
      cleaned = true;
      signal.throwIfAborted();
    }).pipe(Effect.forkChild);
    yield* Deferred.await(entered);
    const interrupt = yield* Fiber.interrupt(fiber).pipe(Effect.forkChild);
    yield* Deferred.await(aborted);
    expect(cleaned).toBe(false);
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(interrupt);
    const exit = yield* Fiber.await(fiber);
    expect(cleaned).toBe(true);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
  }),
);

it.effect("HTTP adapters preserve method, redirects, headers and non-success statuses without retry", () =>
  Effect.gen(function* () {
    const requests: RequestInit[] = [];
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      requests.push(init ?? {});
      return new Response("Unavailable", { status: 503 });
    };
    const result = yield* checkListing(new URL("https://example.com/product")).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    expect(result).toEqual({ status: 503, ok: false });
    const news = yield* downloadNewsPage("https://kingdomdeath.com/news/test").pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    expect(news).toEqual({ status: 503, html: "" });
    expect(requests).toHaveLength(2);
    expect(requests[0].method).toBe("HEAD");
    expect(requests[0].redirect).toBe("follow");
    expect(requests[1].redirect).toBe("error");
    expect(new Headers(requests[1].headers).get("user-agent")).toBe("Guidepost-News-Link-Exporter/2.0");
  }),
);

it.effect(
  "all entry points render help without loading or writing catalog data",
  () =>
    Effect.gen(function* () {
      const execute = promisify(execFile);
      for (const path of [
        "scripts/fill-catalog-editions.mts",
        "scripts/refresh-catalog-availability.mts",
        "scripts/update-catalog.mts",
        "scripts/catalog/workbook.mts",
        "scripts/scrape-news-shop-links.mts",
        "scripts/check-shop-links.mts",
      ]) {
        const output = yield* Effect.tryPromise(() => execute(process.execPath, [path, "--help"], { timeout: 10_000 }));
        expect(output.stdout).toContain("USAGE");
        expect(output.stdout).toContain("--help, -h");
        expect(output.stderr).toBe("");
      }
    }),
  { timeout: 20_000 },
);

it.effect(
  "invalid flags and invalid delay fail before creating outputs",
  () =>
    Effect.gen(function* () {
      const directory = yield* Effect.acquireRelease(
        Effect.promise(() => mkdtemp(join(tmpdir(), "guidepost-cli-"))),
        (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
      );
      const execute = promisify(execFile);
      for (const args of [["--unknown-flag"], ["--delay", "1", "--output", directory, "--cache", directory]]) {
        const exit = yield* Effect.exit(
          Effect.tryPromise(() =>
            execute(process.execPath, [resolve("scripts/scrape-news-shop-links.mts"), ...args], { cwd: directory, timeout: 10_000 }),
          ),
        );
        expect(Exit.isFailure(exit)).toBe(true);
        expect(yield* Effect.promise(() => readdir(directory))).toEqual([]);
      }
    }).pipe(Effect.scoped),
  { timeout: 20_000 },
);
