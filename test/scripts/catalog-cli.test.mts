import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { offlineMode, workflow } from "#scripts/catalog/cli.mts";
import { checkListing } from "#scripts/check-shop-links.mts";
import { downloadNewsPage } from "#scripts/news/scrape-shop-links.mts";

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
        "scripts/news/scrape-shop-links.mts",
        "scripts/check-shop-links.mts",
      ]) {
        const output = yield* Effect.tryPromise(() => execute(process.execPath, [path, "--help"], { timeout: 10_000 }));
        expect(output.stdout).toContain("USAGE");
        expect(output.stdout).toContain("--help, -h");
        if (path !== "scripts/catalog/workbook.mts") expect(output.stdout).toContain("--online");
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
            execute(process.execPath, [resolve("scripts/news/scrape-shop-links.mts"), ...args], {
              cwd: directory,
              timeout: 10_000,
            }),
          ),
        );
        expect(Exit.isFailure(exit)).toBe(true);
        expect(yield* Effect.promise(() => readdir(directory))).toEqual([]);
      }
    }).pipe(Effect.scoped),
  { timeout: 20_000 },
);

it.effect(
  "tag-only invocation stages a review with optional switches omitted",
  () =>
    Effect.gen(function* () {
      const directory = yield* Effect.acquireRelease(
        Effect.promise(() => mkdtemp(join(tmpdir(), "guidepost-tags-cli-"))),
        (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
      );
      const catalog = join(directory, "static/kdm-catalog");
      const news = join(directory, "news");
      const review = join(directory, "review.json");
      yield* Effect.promise(async () => {
        await mkdir(catalog, { recursive: true });
        await mkdir(news);
        for (const name of ["data.json", "data.schema.json"]) await copyFile(resolve("static/kdm-catalog", name), join(catalog, name));
        await writeFile(join(news, "shop-links.json"), "{}");
      });
      const baseline = yield* Effect.promise(() => readFile(join(catalog, "data.json"), "utf8"));
      const execute = promisify(execFile);
      const output = yield* Effect.tryPromise(() =>
        execute(
          process.execPath,
          [resolve("scripts/update-catalog.mts"), "--tags-only", "--catalog", catalog, "--news", news, "--review", review],
          {
            cwd: directory,
            timeout: 10_000,
          },
        ),
      );
      expect(output.stderr).toBe("");
      expect(output.stdout).toContain("0 shop requests");
      const staged = JSON.parse(yield* Effect.promise(() => readFile(review, "utf8")));
      expect(staged.date).toBe("tags-only");
      expect(staged.requests).toEqual([]);
      expect(yield* Effect.promise(() => readFile(join(catalog, "data.json"), "utf8"))).toBe(baseline);
    }).pipe(Effect.scoped),
  { timeout: 20_000 },
);

it.effect(
  "entry points accept omitted switches before reporting missing inputs or invalid values",
  () =>
    Effect.gen(function* () {
      const directory = yield* Effect.acquireRelease(
        Effect.promise(() => mkdtemp(join(tmpdir(), "guidepost-default-cli-"))),
        (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
      );
      const execute = promisify(execFile);
      for (const [path, args, message] of [
        ["scripts/fill-catalog-editions.mts", ["--catalog", join(directory, "missing.json")], "ENOENT"],
        ["scripts/refresh-catalog-availability.mts", ["--catalog", join(directory, "missing.json")], "ENOENT"],
        ["scripts/update-catalog.mts", ["--catalog", join(directory, "missing")], "ENOENT"],
        ["scripts/catalog/workbook.mts", [], "ENOENT"],
        ["scripts/news/scrape-shop-links.mts", ["--delay", "1"], "--delay must be a finite number of at least 2 seconds"],
      ] as const) {
        const output = yield* Effect.promise(() =>
          execute(process.execPath, [resolve(path), ...args], { cwd: directory, timeout: 10_000 }).then(
            () => ({ failed: false, text: "" }),
            (error: Error & { stdout: string; stderr: string }) => ({ failed: true, text: error.stdout + error.stderr }),
          ),
        );
        expect(output.failed).toBe(true);
        expect(output.text).not.toContain("Missing required flag");
        expect(output.text).toContain(message);
        expect(yield* Effect.promise(() => readdir(directory))).toEqual([]);
      }
    }).pipe(Effect.scoped),
  { timeout: 20_000 },
);

it("internet access requires online mode, and refresh cannot enable it implicitly", () => {
  expect(offlineMode({ online: false, offline: false })).toBe(true);
  expect(offlineMode({ online: false, offline: true })).toBe(true);
  expect(offlineMode({ online: true, offline: false })).toBe(false);
  expect(offlineMode({ online: true, offline: false, refresh: true })).toBe(false);
  expect(() => offlineMode({ online: true, offline: true })).toThrow("Choose either --online or --offline");
  expect(() => offlineMode({ online: false, offline: false, refresh: true })).toThrow("--refresh requires --online");
});

it.effect(
  "news scraping uses cached pages by default, including refresh-posts, and never downloads missing pages",
  () =>
    Effect.gen(function* () {
      const directory = yield* Effect.acquireRelease(
        Effect.promise(() => mkdtemp(join(tmpdir(), "guidepost-offline-news-"))),
        (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
      );
      const cache = join(directory, "cache");
      const output = join(directory, "output");
      const newsUrl = "https://kingdomdeath.com/news";
      const page = (data: unknown) => '<script id="__NEXT_DATA__">' + JSON.stringify({ props: { pageProps: { data } } }) + "</script>";
      yield* Effect.promise(async () => {
        await mkdir(cache);
        for (const [url, data] of [
          [newsUrl, { stories: [{ date: "2025-01-01", title: "Example", slug: "example" }] }],
          [newsUrl + "/example", { article: { body: '<a href="https://shop.kingdomdeath.com/products/example">Example</a>' } }],
        ] as const)
          await writeFile(join(cache, createHash("sha256").update(url).digest("hex") + ".html"), page(data));
      });
      const execute = promisify(execFile);
      const args = [resolve("scripts/news/scrape-shop-links.mts"), "--cache", cache, "--output", output];
      for (const flags of [[], ["--refresh-posts"]]) {
        const result = yield* Effect.tryPromise(() => execute(process.execPath, [...args, ...flags], { cwd: directory, timeout: 10_000 }));
        expect(result.stderr).toBe("");
        const report = JSON.parse(yield* Effect.promise(() => readFile(join(output, "shop-links.json"), "utf8")));
        expect(report.complete).toBe(true);
        expect(report.requestsThisRun).toBe(0);
        expect(report.links).toHaveLength(1);
      }
      yield* Effect.promise(() => rm(cache, { recursive: true }));
      const failed = yield* Effect.promise(() =>
        execute(process.execPath, args, { cwd: directory, timeout: 10_000 }).then(
          () => "",
          (error: Error & { stderr: string }) => error.stderr,
        ),
      );
      expect(failed).toContain("No cached news page");
      expect(failed).toContain("--online");
      const report = JSON.parse(yield* Effect.promise(() => readFile(join(output, "shop-links.json"), "utf8")));
      expect(report.requestsThisRun).toBe(0);
      expect(report.links).toHaveLength(1);
    }).pipe(Effect.scoped),
  { timeout: 20_000 },
);

it.effect(
  "availability uses saved product pages without an offline flag and reports cache misses",
  () =>
    Effect.gen(function* () {
      const directory = yield* Effect.acquireRelease(
        Effect.promise(() => mkdtemp(join(tmpdir(), "guidepost-offline-availability-"))),
        (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
      );
      const catalog = join(directory, "static/kdm-catalog/data.json");
      const folder = join(directory, "temp/kdm-catalog/shopify-products");
      yield* Effect.promise(async () => {
        await mkdir(join(directory, "static/kdm-catalog"), { recursive: true });
        await mkdir(folder, { recursive: true });
        await writeFile(catalog, JSON.stringify({ content: {}, "included-only": {}, bundles: {}, accessories: {}, homebrew: {} }));
        await writeFile(
          join(folder, "products-page-1.json"),
          JSON.stringify({
            products: [
              {
                id: 1,
                title: "Example",
                handle: "example",
                variants: [{ id: 11, title: "Default Title", requires_shipping: true, price: "10.00", available: true }],
              },
            ],
          }),
        );
      });
      const baseline = yield* Effect.promise(() => readFile(catalog, "utf8"));
      const execute = promisify(execFile);
      const args = [resolve("scripts/refresh-catalog-availability.mts"), "--catalog", catalog];
      const result = yield* Effect.tryPromise(() => execute(process.execPath, args, { cwd: directory, timeout: 10_000 }));
      expect(result.stderr).toBe("");
      const report = JSON.parse(
        yield* Effect.promise(() => readFile(join(directory, "temp/kdm-catalog/reports/availability-refresh.json"), "utf8")),
      );
      expect(report.offline).toBe(true);
      expect(report.products).toBe(1);
      yield* Effect.promise(() => rm(join(folder, "products-page-1.json")));
      const failure = yield* Effect.promise(() =>
        execute(process.execPath, args, { cwd: directory, timeout: 10_000 }).then(
          () => "",
          (error: Error & { stdout: string; stderr: string }) => error.stdout + error.stderr,
        ),
      );
      expect(failure).toContain("No saved shop page 1");
      expect(failure).toContain("--online");
      expect(yield* Effect.promise(() => readFile(catalog, "utf8"))).toBe(baseline);
    }).pipe(Effect.scoped),
  { timeout: 20_000 },
);

it.effect(
  "catalog updates do not download uncached products unless online mode is selected",
  () =>
    Effect.gen(function* () {
      const directory = yield* Effect.acquireRelease(
        Effect.promise(() => mkdtemp(join(tmpdir(), "guidepost-offline-update-"))),
        (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
      );
      const catalog = join(directory, "static/kdm-catalog");
      const news = join(directory, "news");
      const review = join(directory, "review.json");
      const metadata = { date: "2025-01-01", title: "Example", postUrl: "https://kingdomdeath.com/news/example" };
      yield* Effect.promise(async () => {
        await mkdir(catalog, { recursive: true });
        await mkdir(news);
        for (const name of ["data.json", "data.schema.json"]) await copyFile(resolve("static/kdm-catalog", name), join(catalog, name));
        await writeFile(
          join(news, "shop-links.json"),
          JSON.stringify({
            source: "https://kingdomdeath.com/news",
            complete: true,
            linkHistoryVersion: 3,
            posts: [{ ...metadata, status: "read" }],
            links: [{ ...metadata, itemName: "Example", shopUrl: "https://shop.kingdomdeath.com/products/example" }],
          }),
        );
      });
      const baseline = yield* Effect.promise(() => readFile(join(catalog, "data.json"), "utf8"));
      const execute = promisify(execFile);
      const output = yield* Effect.promise(() =>
        execute(
          process.execPath,
          [
            resolve("scripts/update-catalog.mts"),
            "--catalog",
            catalog,
            "--news",
            news,
            "--cache",
            join(directory, "cache"),
            "--review",
            review,
          ],
          { cwd: directory, timeout: 10_000 },
        ).then(
          () => "",
          (error: Error & { stdout: string; stderr: string }) => error.stdout + error.stderr,
        ),
      );
      expect(output).toContain("No cached shop response");
      expect(output).toContain("--online");
      expect(yield* Effect.promise(() => readFile(join(catalog, "data.json"), "utf8"))).toBe(baseline);
      expect(yield* Effect.promise(() => readdir(directory))).not.toContain("review.json");
    }).pipe(Effect.scoped),
  { timeout: 20_000 },
);
