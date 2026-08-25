/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from "$app/env";
import { assets, immutable, prerendered } from "$app/manifest";
import { resolve } from "$app/paths";
import { self } from "$app/service-worker";

const cacheName = `cache-${version}`;
// Manifest paths are generated at build time, so they are not represented by the static route-path union accepted by resolve's public type.
const resolveManifestPath = resolve as (path: string) => string;
const appAssets = [...immutable, ...assets, ...prerendered].map(({ path }) => resolveManifestPath(path));

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
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
