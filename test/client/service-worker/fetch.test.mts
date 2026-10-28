import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { isDeferredAsset } from "../../../src/service-worker/cache-policy.ts";

// Execute the real worker with browser services injected, including its respondWith boundary.
function worker(dev = false) {
  const listeners = new Map<string, (event: unknown) => void>();
  const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn() };
  const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  const source = readFileSync(new URL("../../../src/service-worker/index.ts", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
  runInNewContext(stripTypeScriptTypes(source), {
    dev,
    version: "test",
    assets: [{ path: "kdm/catalog/data.json" }],
    immutable: [],
    prerendered: [{ path: "kdm/collection/" }],
    resolve: (path: string) => `/${path}`,
    isDeferredAsset,
    self: {
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
      location: { origin: "http://localhost:5173" },
    },
    caches: { open: async () => cache },
    fetch,
    URL,
    Response,
  });
  function request(path = "/kdm/collection/?cat=accessories", mode = "navigate") {
    const respondWith = vi.fn();
    const waitUntil = vi.fn();
    listeners.get("fetch")!({ request: { method: "GET", mode, url: `http://localhost:5173${path}` }, respondWith, waitUntil });
    return { respondWith, waitUntil };
  }
  return { cache, fetch, request };
}

it("resolves respondWith with an unavailable response when an uncached navigation cannot reach the network", async () => {
  const { request, cache } = worker();
  const { respondWith, waitUntil } = request();
  const response = await respondWith.mock.calls[0][0];
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(cache.put).not.toHaveBeenCalled();
  expect(waitUntil).not.toHaveBeenCalled();
});

it("handles a cancelled catalog fetch without rejecting respondWith", async () => {
  const { fetch, request } = worker();
  fetch.mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));
  const { respondWith } = request("/kdm/catalog/data.json", "cors");
  expect((await respondWith.mock.calls[0][0]).status).toBe(503);
});

it("returns successful network responses and retains visited collection HTML", async () => {
  const { fetch, cache, request } = worker();
  const response = new Response("Collection");
  fetch.mockResolvedValue(response);
  const { respondWith, waitUntil } = request();
  expect(await respondWith.mock.calls[0][0]).toBe(response);
  expect(cache.put).toHaveBeenCalledOnce();
  expect(waitUntil).toHaveBeenCalledOnce();
});

it("serves cached collection HTML for offline filter URLs", async () => {
  const { cache, fetch, request } = worker();
  const cached = new Response("Collection");
  cache.match.mockResolvedValue(cached);
  const { respondWith } = request();
  expect(await respondWith.mock.calls[0][0]).toBe(cached);
  expect(cache.match).toHaveBeenCalledWith(expect.anything(), { ignoreSearch: true });
  expect(fetch).not.toHaveBeenCalled();
});

it("leaves development navigations to the browser", () => {
  const { request, fetch } = worker(true);
  expect(request().respondWith).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
