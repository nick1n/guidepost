<script lang="ts">
  import { bundleTags, getCollectionStats, getVisibleCatalog } from "#lib/catalog-view.ts";
  import BundleCard from "#lib/components/BundleCard.svelte";
  import CollectionStats from "#lib/components/CollectionStats.svelte";
  import ContentCard from "#lib/components/ContentCard.svelte";
  import DiceCard from "#lib/components/DiceCard.svelte";
  import FilterBar from "#lib/components/FilterBar.svelte";
  import { allContentTags, allDiceTags, allHomebrewTags, priceById } from "#lib/kdm-data.ts";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { createFilterState } from "#lib/state/filters.svelte.ts";

  type Tab = "content" | "dice" | "bundles" | "homebrew";

  const TABS: { value: Tab; label: string }[] = [
    { value: "content", label: "Content" },
    { value: "dice", label: "Dice" },
    { value: "bundles", label: "Bundles" },
    { value: "homebrew", label: "Homebrew" },
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
</script>

<main class="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-2 px-3 pt-4 pb-16">
  <header>
    <h1 class="font-display text-2xl leading-none font-bold tracking-tight">
      Kingdom Death: <span class="text-accent">Collection</span>
    </h1>
    <p class="text-muted-foreground mt-1">Content &amp; Dice collection tracker</p>
  </header>

  <CollectionStats {...stats} />

  <nav aria-label="Sections" class="bg-card relative isolate flex gap-1">
    <span class="tab-highlight bg-panel pointer-events-none" aria-hidden="true"></span>
    {#each TABS as t (t.value)}
      <button
        type="button"
        aria-current={tab === t.value ? "page" : undefined}
        onclick={() => (tab = t.value)}
        class={[
          "tab-button flex-1 cursor-pointer px-2 py-3 font-semibold transition-colors",
          tab === t.value ? "tab-active text-foreground" : "text-muted-foreground hover:text-foreground",
        ]}
      >
        {t.label}
        <span class="tabular-nums opacity-50">{tabCounts[t.value]}</span>
      </button>
    {/each}
  </nav>

  <FilterBar
    tagOptions={tab === "content" ? allContentTags : tab === "dice" ? allDiceTags : tab === "bundles" ? bundleTags : allHomebrewTags}
    showGameplay={tab !== "dice"}
    {resultCount}
  />

  {#if !collection.hydrated}
    <p class="text-muted-foreground py-10 text-center">Loading collection…</p>
  {:else if resultCount === 0}
    <p class="text-muted-foreground py-10 text-center">Nothing matches these filters</p>
  {:else}
    <ul class="flex flex-col gap-3">
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

  <p class="text-muted-foreground mt-2 text-center">Saved in this browser - {stats.totalCount} catalog entries</p>
</main>

<style>
  .tab-highlight {
    display: none;
  }

  .tab-active {
    background: var(--panel);
  }

  @supports (anchor-name: --active-tab) {
    .tab-button {
      position: relative;
      z-index: 1;
    }

    .tab-active {
      anchor-name: --active-tab;
      background: transparent;
    }

    .tab-highlight {
      display: block;
      position: absolute;
      position-anchor: --active-tab;
      top: anchor(--active-tab top);
      right: anchor(--active-tab right);
      bottom: anchor(--active-tab bottom);
      left: anchor(--active-tab left);
      transition:
        top 220ms cubic-bezier(0.16, 1, 0.3, 1),
        right 220ms cubic-bezier(0.16, 1, 0.3, 1),
        bottom 220ms cubic-bezier(0.16, 1, 0.3, 1),
        left 220ms cubic-bezier(0.16, 1, 0.3, 1);
    }
  }
</style>
