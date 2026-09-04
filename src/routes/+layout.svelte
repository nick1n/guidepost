<script lang="ts">
  import "@unocss/reset/tailwind-v4.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { LocalGuestStore } from "#lib/state/stores.ts";

  let { children } = $props();

  onMount(() => {
    const userId = "guest";
    collection.setUser(userId);
    collection.setStore(new LocalGuestStore(userId));
  });
</script>

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

{@render children()}
