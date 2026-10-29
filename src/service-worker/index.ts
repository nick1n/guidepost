/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { dev, version } from "$app/env";
import { assets, immutable, prerendered } from "$app/manifest";
import { resolve } from "$app/paths";
import { self } from "$app/service-worker";
import { Effect } from "effect";
import { isDeferredAsset } from "./cache-policy";
import { createWorker, runWorker } from "./worker";

// Manifest paths are generated at build time, so they are not represented by resolve's static route-path union.
const resolveManifestPath = resolve as (path: string) => string;
const manifestAssets = [...immutable, ...assets, ...prerendered];
const worker = createWorker(
  {
    caches,
    clients: self.clients,
    skipWaiting: () => self.skipWaiting(),
    fetch: (input, init) => fetch(input, init),
    origin: self.location.origin,
  },
  {
    dev,
    cacheName: `cache-${version}`,
    appAssets: manifestAssets.filter(({ path }) => !isDeferredAsset(path)).map(({ path }) => resolveManifestPath(path)),
    deferredAssets: new Set(manifestAssets.filter(({ path }) => isDeferredAsset(path)).map(({ path }) => resolveManifestPath(path))),
    collectionPath: resolveManifestPath("kdm/collection/"),
    catalogPath: resolveManifestPath("kdm/catalog/data.json"),
  },
);

self.addEventListener("install", (event) => {
  event.waitUntil(runWorker(worker.install()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(runWorker(worker.activate()));
});

self.addEventListener("message", (event) => {
  event.waitUntil(runWorker(worker.cachePage(event.data)));
});

self.addEventListener("fetch", (event) => {
  if (!worker.handles(event.request)) return;
  event.respondWith(
    runWorker(
      worker.respond(event.request).pipe(
        Effect.tap(({ retain }) =>
          Effect.sync(() => {
            if (retain) event.waitUntil(runWorker(retain));
          }),
        ),
        Effect.map(({ response }) => response),
      ),
    ),
  );
});
