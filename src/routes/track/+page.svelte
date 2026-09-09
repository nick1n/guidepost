<script lang="ts">
  import { bundleTags, getCollectionStats, getVisibleCatalog } from "#lib/catalog-view.ts";
  import BundleCard from "#lib/components/track/BundleCard.svelte";
  import CollectionStats from "#lib/components/track/CollectionStats.svelte";
  import ContentCard from "#lib/components/track/ContentCard.svelte";
  import DiceCard from "#lib/components/track/DiceCard.svelte";
  import FilterBar from "#lib/components/track/FilterBar.svelte";
  import { allContentTags, allDiceTags, allHomebrewTags, priceById } from "#lib/kdm-data.ts";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { collectionActions } from "#lib/state/collection-actions.svelte.ts";
  import { createFilterState } from "#lib/state/filters.svelte.ts";

  type Tab = "content" | "dice" | "bundles" | "homebrew";

  const TABS: { id: Tab; label: string }[] = [
    { id: "content", label: "Content" },
    { id: "dice", label: "Dice" },
    { id: "bundles", label: "Bundles" },
    { id: "homebrew", label: "Homebrew" },
  ];

  let tab = $state<Tab>("content");
  const filters = createFilterState();

  const stats = $derived(getCollectionStats(collection.state));
  const visible = $derived(getVisibleCatalog(filters.value, collection.state));
  const tabCounts = $derived({
    content: visible.visibleContent.length,
    dice: visible.visibleDice.length,
    bundles: visible.visibleBundles.length,
    homebrew: visible.visibleHomebrew.length,
  });
  const resultCount = $derived(tabCounts[tab]);

  function retryLoad() {
    collectionActions.run(collection.refresh());
  }
</script>

<main class="scrollbar-stable">
  <header>
    <h1>Kingdom Death: <span class="accent">Collection</span></h1>
    <p class="subtitle">Content &amp; Dice collection tracker</p>
  </header>

  <CollectionStats {...stats} />

  {#if collectionActions.error && collectionActions.error.operation !== "load"}
    <div class="error" role="alert">
      <span>{collectionActions.error.message}</span>
      <button class="dismiss" type="button" onclick={() => collectionActions.dismiss()} aria-label="Dismiss collection error">
        <span class="dismiss-icon i-material-symbols:close" aria-hidden="true"></span>
      </button>
    </div>
  {/if}

  <nav aria-label="Sections">
    <span class="tab-highlight" aria-hidden="true"></span>
    {#each TABS as t (t.id)}
      <button class="tab-button" type="button" aria-current={tab === t.id ? "page" : undefined} onclick={() => (tab = t.id)}>
        {t.label}
        <span class="tab-count">{tabCounts[t.id]}</span>
      </button>
    {/each}
  </nav>

  <FilterBar
    tagOptions={tab === "content" ? allContentTags : tab === "dice" ? allDiceTags : tab === "bundles" ? bundleTags : allHomebrewTags}
    showGameplay={tab !== "dice"}
    {resultCount}
  />

  {#if collection.loadStatus === "error"}
    <div class="load-error">
      <p>{collectionActions.error?.operation === "load" ? collectionActions.error.message : "Collection unavailable"}</p>
      <button class="retry" type="button" onclick={retryLoad}>Try again</button>
    </div>
  {:else if collection.loadStatus !== "ready"}
    <p class="message">Loading collection…</p>
  {:else if resultCount === 0}
    <p class="message">Nothing matches these filters</p>
  {:else}
    <ul>
      {#if tab === "content"}
        {#each visible.visibleContent as item (item.id)}
          <ContentCard {item} />
        {/each}
      {:else if tab === "dice"}
        {#each visible.visibleDice as item (item.id)}
          <DiceCard {item} />
        {/each}
      {:else if tab === "bundles"}
        {#each visible.visibleBundles as bundle (bundle.id)}
          <BundleCard {bundle} partsValue={bundle.includes.reduce((sum, id) => sum + (priceById[id] ?? 0), 0)} />
        {/each}
      {:else}
        {#each visible.visibleHomebrew as item (item.id)}
          <ContentCard {item} />
        {/each}
      {/if}
    </ul>
  {/if}

  <p class="summary">Saved in this browser - {stats.totalCount} catalog entries</p>
</main>

<style>
  main {
    --duration-tab: 220ms;
    --ease-tab: cubic-bezier(0.16, 1, 0.3, 1);

    display: flex;
    flex-direction: column;
    min-block-size: 100vh;
    max-inline-size: 36rem;
    margin-inline: auto;
    padding-block: 1rem 4rem;
    padding-inline: 2px;
    gap: 0.5rem;
  }

  h1 {
    font-weight: var(--font-bold);
    font-size: 1.5rem;
    line-height: var(--line-height-none);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }

  .accent {
    color: var(--accent);
  }

  .subtitle {
    margin-block-start: 0.25rem;
    color: var(--muted-foreground);
  }

  nav {
    position: relative;
    display: flex;
    isolation: isolate;
    gap: 0.25rem;
    background-color: var(--card);
  }

  .tab-button {
    flex: 1;
    padding-block: 0.75rem;
    padding-inline: 0.5rem;
    color: var(--muted-foreground);
    font-weight: var(--font-semibold);
    transition:
      color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard);

    &:is(:hover, [aria-current="page"]) {
      color: var(--foreground);
    }

    &[aria-current="page"] {
      background-color: var(--panel);
    }
  }

  .tab-count {
    font-variant-numeric: tabular-nums;
    opacity: 0.5;
  }

  .tab-highlight {
    display: none;
  }

  .message {
    padding-block: 2.5rem;
    color: var(--muted-foreground);
    text-align: center;
  }

  .load-error {
    display: grid;
    justify-items: center;
    padding-block: 2.5rem;
    gap: 0.75rem;
    color: var(--muted-foreground);
  }

  .retry {
    padding-block: 0.5rem;
    padding-inline: 0.75rem;
    border: var(--border-size) solid var(--accent);
    color: var(--foreground);

    &:hover {
      background: var(--accent);
      color: var(--contrast);
    }
  }

  .error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border: var(--border-size) solid var(--accent-red);
    gap: 0.75rem;
    background: color-mix(var(--accent-red) 12%, var(--panel));
    color: var(--foreground);
  }

  .dismiss-icon {
    display: inline-block;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    color: var(--accent-red);
  }

  .dismiss {
    display: inline-flex;
    padding: 0.25rem;
    border-radius: var(--radius-control);

    &:is(:hover, :focus-visible) {
      background: color-mix(var(--accent-red) 18%, transparent);
    }
  }

  ul {
    display: grid;
    gap: 0.75rem;
  }

  .summary {
    margin-block-start: 0.5rem;
    color: var(--muted-foreground);
    text-align: center;
  }

  @supports (anchor-name: --active-tab) {
    .tab-button {
      position: relative;
      z-index: 1;

      &[aria-current="page"] {
        anchor-name: --active-tab;
        background-color: transparent;
      }
    }

    .tab-highlight {
      position: absolute;
      position-anchor: --active-tab;
      inset-block-start: anchor(--active-tab top);
      inset-block-end: anchor(--active-tab bottom);
      inset-inline-start: anchor(--active-tab left);
      inset-inline-end: anchor(--active-tab right);
      display: block;
      background-color: var(--panel);
      transition:
        inset-block-start var(--duration-tab) var(--ease-tab),
        inset-block-end var(--duration-tab) var(--ease-tab),
        inset-inline-start var(--duration-tab) var(--ease-tab),
        inset-inline-end var(--duration-tab) var(--ease-tab);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :is(.tab-button, .tab-highlight) {
      transition: none;
    }
  }
</style>
