<script lang="ts">
  import "@unocss/reset/tailwind-v4.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { Effect, Fiber } from "effect";
  import { Collection, setCollection } from "#lib/state/collection.svelte.ts";
  import { collectionActions } from "#lib/state/collection-actions.ts";
  import { CollectionSession } from "#lib/state/collection-session.ts";

  let { children } = $props();
  const collection = setCollection(new Collection());
  const session = new CollectionSession(collection);

  afterNavigate(({ to }) => {
    navigator.serviceWorker?.controller?.postMessage({ type: "cache-page", path: to?.url.pathname });
  });

  // Database monitoring must follow loads and retries started anywhere in the app.
  $effect(() => {
    session.monitor(collection.canObserve);
  });

  onMount(() => {
    const active = collectionActions.run(session.run("guest"), { success: false });
    return () => {
      Effect.runFork(Fiber.interrupt(active));
    };
  });
</script>

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

{@render children()}
