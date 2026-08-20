import { assets, immutable, prerendered } from "$app/manifest";
import { version } from "$app/env";
import { resolve } from "$app/paths";

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `cache-${version}`;
const appAssets = [...immutable, ...assets, ...prerendered].map(({ path }) => resolve(path));

worker.addEventListener("install", (event) => {
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
  worker.skipWaiting();
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))));
  worker.clients.claim();
});

worker.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
