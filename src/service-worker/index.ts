/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from "$app/env";
import { assets, immutable, prerendered } from "$app/manifest";
import { resolve } from "$app/paths";
import { self } from "$app/service-worker";
import { isDeferredAsset } from "./cache-policy";

const cacheName = `cache-${version}`;
// Manifest paths are generated at build time, so they are not represented by the static route-path union accepted by resolve's public type.
const resolveManifestPath = resolve as (path: string) => string;
const manifestAssets = [...immutable, ...assets, ...prerendered];
const appAssets = manifestAssets.filter(({ path }) => !isDeferredAsset(path)).map(({ path }) => resolveManifestPath(path));
const deferredAssets = new Set(manifestAssets.filter(({ path }) => isDeferredAsset(path)).map(({ path }) => resolveManifestPath(path)));
const collectionPath = resolveManifestPath("kdm/collection/");
const catalogPath = resolveManifestPath("kdm-catalog/data.json");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) =>
      Promise.all(
        appAssets.map((asset) =>
          cache.add(asset).catch(() => {
            // An individual asset may not be available during installation.
          }),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
      // Direct first visits happen before this worker controls requests, so retain their deferred HTML for offline reloads.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visitedPaths = new Set(clients.map((client) => new URL(client.url).pathname).filter((path) => deferredAssets.has(path)));
      if (visitedPaths.has(collectionPath)) visitedPaths.add(catalogPath);
      const cache = await caches.open(cacheName);
      await Promise.all([...visitedPaths].map((path) => cache.add(path).catch(() => {})));
      await self.clients.claim();
    })(),
  );
});

// Client-side navigation does not request page HTML; retain visited deferred pages for offline reloads.
self.addEventListener("message", (event) => {
  const path = event.data?.path;
  if (event.data?.type !== "cache-page" || !deferredAssets.has(path)) return;
  event.waitUntil(
    caches.open(cacheName).then((cache) =>
      cache
        .match(path)
        .then(async (cached) => {
          if (!cached) await cache.add(path);
        })
        .catch(() => {}),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      // Prerendered HTML is the same for all search/filter URLs; the client restores their state.
      const cached = await cache.match(event.request, { ignoreSearch: event.request.mode === "navigate" });
      const response = cached ?? (await fetch(event.request));
      const url = new URL(event.request.url);
      if (response.ok && url.origin === self.location.origin && deferredAssets.has(url.pathname)) {
        if (!cached) event.waitUntil(cache.put(event.request, response.clone()).catch(() => {}));
        // SPA navigation fetches the catalog but not the HTML needed for an offline reload.
        if (url.pathname === catalogPath) {
          event.waitUntil(
            cache
              .match(collectionPath)
              .then(async (cached) => {
                if (!cached) await cache.add(collectionPath);
              })
              .catch(() => {}),
          );
        }
      }
      return response;
    })(),
  );
});
