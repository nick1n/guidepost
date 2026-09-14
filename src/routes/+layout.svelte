<script lang="ts">
  import "@unocss/reset/tailwind-v4.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { collectionActions } from "#lib/state/collection-actions.svelte.ts";
  import { GuestStore } from "#lib/state/stores.ts";

  let { children } = $props();

  onMount(() => {
    const userId = "guest";
    collection.setUser(userId);
    collectionActions.run(collection.setStore(new GuestStore(userId)));
  });
</script>

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

{@render children()}
