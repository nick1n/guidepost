<script module lang="ts">
  import { bundleTags } from "#lib/catalog-view.ts";
  import { allContentTags, allDiceTags, allHomebrewTags } from "#lib/kdm-data.ts";

  const TABS = [
    { id: "content", label: "Content" },
    { id: "dice", label: "Dice" },
    { id: "bundles", label: "Bundles" },
    { id: "homebrew", label: "Homebrew" },
  ] as const;
  type Tab = (typeof TABS)[number]["id"];
  const tagsByTab = {
    content: allContentTags,
    dice: allDiceTags,
    bundles: bundleTags,
    homebrew: allHomebrewTags,
  };
</script>

<script lang="ts">
  import { getCollectionStats, getVisibleCatalog } from "#lib/catalog-view.ts";
  import BundleCard from "#lib/components/track/BundleCard.svelte";
  import CollectionStats from "#lib/components/track/CollectionStats.svelte";
  import ContentCard from "#lib/components/track/ContentCard.svelte";
  import DiceCard from "#lib/components/track/DiceCard.svelte";
  import FilterBar from "#lib/components/track/FilterBar.svelte";
  import { ownershipDefaults, priceById } from "#lib/kdm-data.ts";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { collectionActions } from "#lib/state/collection-actions.ts";
  import { createFilterState } from "#lib/state/filters.svelte.ts";

  let tab = $state<Tab>("content");
  let tabNavigation: HTMLElement;
  const filters = createFilterState();

  const stats = $derived(getCollectionStats(collection.state));
  const visible = $derived(getVisibleCatalog(filters.value, collection.state));
  const tabCounts = $derived({
    content: visible.content.length,
    dice: visible.dice.length,
    bundles: visible.bundles.length,
    homebrew: visible.homebrew.length,
  });
  const resultCount = $derived(tabCounts[tab]);
  const canSelect = $derived(collection.loadStatus === "ready" && resultCount > 0);

  function onkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const index = (TABS.findIndex((item) => item.id === tab) + direction + TABS.length) % TABS.length;
    tab = TABS[index].id;
    if (target instanceof Node && tabNavigation.contains(target)) {
      tabNavigation.querySelectorAll("button")[index]?.focus();
    }
  }

  function onenter() {
    if (!canSelect) return;

    if (tab === "content" || tab === "homebrew") {
      const item = tab === "content" ? visible.content[0] : visible.homebrew[0];
      collectionActions.run(collection.toggleOwned(item.id, ownershipDefaults(item)));
      return;
    }

    if (tab === "dice") {
      const item = visible.dice[0];
      if (!collection.get(item.id).owned) collectionActions.run(collection.toggleOwned(item.id));
      return;
    }

    const bundle = visible.bundles[0];
    if (!collection.get(bundle.id).owned) collectionActions.run(collection.setManyOwned([bundle.id, ...bundle.includes], true));
  }

  function retryLoad() {
    collectionActions.run(collection.refresh(), { success: "Collection loaded." });
  }
</script>

<svelte:window {onkeydown} />

<svelte:head>
  <title>Collection | Guidepost</title>
</svelte:head>

<main class="scrollbar-stable">
  <header>
    <h1>Kingdom Death: <span class="accent">Collection</span></h1>
    <p class="subtitle">Content &amp; Dice collection tracker</p>
  </header>

  <CollectionStats {...stats} />

  <nav bind:this={tabNavigation} aria-label="Sections">
    <span class="tab-highlight" aria-hidden="true"></span>
    {#each TABS as t (t.id)}
      <button class="tab-button" type="button" aria-current={tab === t.id ? "page" : undefined} onclick={() => (tab = t.id)}>
        {t.label}
        <span class="tab-count">{tabCounts[t.id]}</span>
      </button>
    {/each}
  </nav>

  <FilterBar tagOptions={tagsByTab[tab]} showGameplay={tab !== "dice"} {resultCount} {canSelect} {onenter} />

  {#if collection.loadStatus === "error"}
    <div class="load-error">
      <p>{collection.loadError?.message ?? "Collection unavailable"}</p>
      <button class="retry" type="button" onclick={retryLoad}>Try again</button>
    </div>
  {:else if collection.loadStatus !== "ready"}
    <p class="message">Loading collection…</p>
  {:else if resultCount === 0}
    <p class="message">Nothing matches these filters</p>
  {:else}
    <ul>
      {#if tab === "content"}
        {#each visible.content as item (item.id)}
          <ContentCard {item} />
        {/each}
      {:else if tab === "dice"}
        {#each visible.dice as item (item.id)}
          <DiceCard {item} />
        {/each}
      {:else if tab === "bundles"}
        {#each visible.bundles as bundle (bundle.id)}
          <BundleCard {bundle} partsValue={bundle.includes.reduce((sum, id) => sum + (priceById[id] ?? 0), 0)} />
        {/each}
      {:else}
        {#each visible.homebrew as item (item.id)}
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
