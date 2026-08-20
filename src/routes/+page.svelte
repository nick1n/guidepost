<script lang="ts">
  import { bundleTags, getCollectionStats, getVisibleCatalog } from "#lib/catalog-view.ts";
  import BundleCard from "#lib/components/BundleCard.svelte";
  import CollectionSession from "#lib/components/CollectionSession.svelte";
  import CollectionStats from "#lib/components/CollectionStats.svelte";
  import ContentCard from "#lib/components/ContentCard.svelte";
  import DiceCard from "#lib/components/DiceCard.svelte";
  import FilterBar from "#lib/components/FilterBar.svelte";
  import { allContentTags, allDiceTags, bundles, content, dice, priceById } from "#lib/kdm-data.ts";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { createFilterState } from "#lib/state/filters.svelte.ts";

  type Tab = "content" | "dice" | "bundles";

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: "content", label: "Content", count: content.length },
    { value: "dice", label: "Dice", count: dice.length },
    { value: "bundles", label: "Bundles", count: bundles.length },
  ];

  let tab = $state<Tab>("content");
  const filters = createFilterState();

  const stats = $derived(getCollectionStats(collection.state));
  const visible = $derived(getVisibleCatalog(filters.value, collection.state));
  const resultCount = $derived(
    tab === "content" ? visible.visibleContent.length : tab === "dice" ? visible.visibleDice.length : visible.visibleBundles.length,
  );
</script>

<CollectionSession />

<main class="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-2 px-3 pt-4 pb-16">
  <header>
    <h1 class="font-display text-2xl leading-none font-bold tracking-tight">
      Kingdom Death: <span class="text-accent">Collection</span>
    </h1>
    <p class="text-muted-foreground mt-1">Content &amp; Dice collection tracker</p>
  </header>

  <CollectionStats {...stats} />

  <nav aria-label="Sections" class="bg-card flex gap-1 p-1">
    {#each TABS as t (t.value)}
      <button
        type="button"
        aria-current={tab === t.value ? "page" : undefined}
        onclick={() => (tab = t.value)}
        class={[
          "flex-1 cursor-pointer px-2 py-2 font-semibold transition-colors",
          tab === t.value ? "bg-panel text-foreground" : "text-muted-foreground hover:bg-panel/50 hover:text-foreground",
        ]}
      >
        {t.label} <span class="tabular-nums opacity-50">{t.count}</span>
      </button>
    {/each}
  </nav>

  <FilterBar
    tagOptions={tab === "content" ? allContentTags : tab === "dice" ? allDiceTags : bundleTags}
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
      {:else}
        {#each visible.visibleBundles as bundle (bundle.id)}
          <BundleCard {bundle} partsValue={bundle.includes.reduce((sum, id) => sum + (priceById[id] ?? 0), 0)} />
        {/each}
      {/if}
    </ul>
  {/if}

  <p class="text-muted-foreground mt-2 text-center">Saved in this browser - {stats.totalCount} catalog entries</p>
</main>
