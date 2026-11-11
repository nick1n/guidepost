---
name: pwa-development
description: Maintain Guidepost's SvelteKit service worker, asset caching, and offline behavior. Use for worker lifecycle, cache policy, installation, or offline changes.
---

# PWA development

Read [development](../../../docs/development.md#service-worker) and [architecture](../../../docs/kdm-architecture.md) before changing cache behavior.
Inspect the existing worker and installed SvelteKit APIs. Keep the project's worker integration; do not add Workbox or another registration system by default.

1. Identify the resource and its owner: the service worker caches the shell and assets; Dexie owns collection persistence.
2. Preserve base-path handling, individually cached precache assets, and runtime caching of the catalog after a visit. One missing asset must not reject installation.
3. Keep external cache ownership intact, including the exchange-rate cache across app updates. Never clear IndexedDB as worker cache cleanup.
4. Test the affected cold visit, cached offline revisit, missing-resource failure, and worker upgrade paths. Do not claim uncached resources work offline.
5. Run `pnpm check`, format touched files, and run `pnpm build`. Use existing browser suites for affected behavior, following the development guide.

Update prompts, reloads, background downloads, and installation controls are product changes. Implement them only within the requested scope,
and preserve pending saves and active interactions. Application lifecycle orchestration follows the [Effect conventions](../../../docs/effect-conventions.md).
