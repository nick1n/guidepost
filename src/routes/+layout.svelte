<script lang="ts">
  import "@unocss/reset/tailwind-v4.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { Effect, Fiber } from "effect";
  import { Collection, setCollection } from "#lib/state/collection.svelte.ts";
  import { collectionActions } from "#lib/state/collection-actions.ts";
  import type { DexieStore } from "#lib/state/dexie-store.ts";
  import { CollectionError } from "#lib/state/collection-errors.ts";

  let { children } = $props();
  const collection = setCollection(new Collection());
  let observation: ReturnType<typeof collectionActions.run> | undefined;
  const monitoring = $derived(collection.canObserve);

  // Database monitoring must follow loads and retries started anywhere in the app.
  $effect(() => {
    if (!monitoring) return;
    const fiber = collectionActions.run(collection.observeChanges(), { success: false });
    observation = fiber;
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  });

  onMount(() => {
    const userId = "guest";
    let guestStore: DexieStore | undefined;
    collection.setUser(userId);
    const initialization = collectionActions.run(
      Effect.tryPromise({
        try: () => import("#lib/state/dexie-store.ts"),
        catch: (cause) =>
          new CollectionError({
            operation: "load",
            itemIds: [],
            message: "Collection storage could not be started. Reload the page and try again.",
            cause,
          }),
      }).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            collection.loadError = error;
            collection.loadStatus = "error";
          }),
        ),
        Effect.flatMap(({ DexieStore }) => DexieStore.make(userId)),
        Effect.flatMap((store) => {
          guestStore = store;
          return collection.setStore(store);
        }),
      ),
      { success: false },
    );
    return () => {
      // Unsubscribe and settle any initialization before closing the browser connection.
      Effect.runFork(
        Fiber.interrupt(initialization).pipe(
          Effect.andThen(Effect.suspend(() => (observation ? Fiber.interrupt(observation) : Effect.void))),
          Effect.andThen(Effect.sync(() => guestStore?.close())),
        ),
      );
    };
  });
</script>

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

{@render children()}
