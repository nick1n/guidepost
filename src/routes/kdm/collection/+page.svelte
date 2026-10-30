<script lang="ts">
  import { asset } from "$app/paths";
  import { Effect } from "effect";
  import { onMount } from "svelte";
  import Header from "#lib/app/Header.svelte";
  import { createHashRoute } from "#lib/app/navigation/hash-route.svelte.ts";
  import { CatalogSession } from "#lib/kdm/collection/catalog-session.svelte.ts";
  import { getCollection } from "#lib/kdm/collection/state/collection.svelte.ts";
  import { getActions } from "#lib/app/actions.ts";
  import { collectionHash } from "#lib/kdm/collection/url.ts";
  import Catalog from "#lib/kdm/collection/ui/Catalog.svelte";

  const collection = getCollection();
  const actions = getActions();
  const route = createHashRoute(collectionHash);
  const session = new CatalogSession(collection);
  let mounted = $state(false);

  function onclick() {
    const url = new URL(asset("kdm/catalog/data.json"), window.location.href).href;
    actions.run(session.load(url).pipe(Effect.tap(() => Effect.sync(() => route.synchronize()))), { success: false });
  }

  onMount(() => {
    route.synchronize();
    mounted = true;
    onclick();
    return () => actions.run(session.dispose(), { success: false });
  });
</script>

<svelte:head>
  <title>Collection | Guidepost</title>
  {#if !collection.hasCatalog}
    <link rel="preload" href={asset("kdm/catalog/data.json")} as="fetch" crossorigin="anonymous" />
  {/if}
</svelte:head>

<main class="scrollbar-stable">
  <Header title="Collection" subtitle="Kingdom Death: Monster collection tracker" />
  {#if mounted && collection.hasCatalog}
    <Catalog {route} />
  {:else}
    <section class="startup" aria-label="Catalog loading">
      {#if session.failed}
        <p role="alert">{session.error?.message ?? "The catalog could not be loaded. Please try again."}</p>
        <button type="button" {onclick} disabled={session.pending}>Retry loading</button>
      {:else}
        <p role="status">Loading catalog...</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  main {
    --size-catalog: 72rem;

    max-inline-size: var(--size-catalog);
    margin-inline: auto;
    padding-block-end: 2rem;
    /* Keep deferred card bodies from moving the window's scroll anchor. */
    overflow-anchor: none;
  }

  .startup {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.75rem;
    min-block-size: 24rem;
    padding: 1rem;
    color: var(--muted-foreground);
    text-align: center;
  }

  button {
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-control);
    background: var(--panel);
    color: var(--foreground);
  }
</style>
