<script lang="ts">
  import "@unocss/reset/tailwind-v4.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { Effect } from "effect";
  import { BrowserStorage } from "#lib/state/browser-storage.ts";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { collectionActions } from "#lib/state/collection-actions.svelte.ts";
  import { GuestStore } from "#lib/state/stores.ts";

  let { children } = $props();

  onMount(() => {
    const userId = "guest";
    collection.setUser(userId);
    collectionActions.run(
      GuestStore.make(userId).pipe(
        Effect.provide(BrowserStorage.layer),
        Effect.flatMap((store) => collection.setStore(store)),
      ),
    );
  });
</script>

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

{@render children()}
