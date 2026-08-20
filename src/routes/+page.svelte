<script lang="ts">
  import { bundleTags, getCollectionStats, getVisibleCatalog } from "#lib/catalog-view.ts";
  import BundleCard from "#lib/components/BundleCard.svelte";
  import CollectionSession from "#lib/components/CollectionSession.svelte";
  import CollectionStats from "#lib/components/CollectionStats.svelte";
  import ContentCard from "#lib/components/ContentCard.svelte";
  import DiceCard from "#lib/components/DiceCard.svelte";
  import FilterBar from "#lib/components/FilterBar.svelte";
  import { allContentTags, allDiceTags, bundles, content, dice, priceById, type ContentItem } from "#lib/kdm-data.ts";
  import { defaultFilters, type Filters } from "#lib/filters.ts";
  import { collection } from "#lib/state/collection.svelte.ts";

  type Tab = "content" | "dice" | "bundles";

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: "content", label: "Content", count: content.length },
    { value: "dice", label: "Dice", count: dice.length },
    { value: "bundles", label: "Bundles", count: bundles.length },
  ];

  let tab = $state<Tab>("content");
  let filters = $state<Filters>({ ...defaultFilters });

  const stats = $derived(getCollectionStats(collection.state));
  const visible = $derived(getVisibleCatalog(filters, collection.state));
  const resultCount = $derived(
    tab === "content" ? visible.visibleContent.length : tab === "dice" ? visible.visibleDice.length : visible.visibleBundles.length,
  );

  function toggleTagFilter(tag: string) {
    filters = {
      ...filters,
      tags: filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag],
    };
  }

  function toggleKindFilter(kind: ContentItem["kind"]) {
    filters = { ...filters, kind: filters.kind === kind ? "any" : kind };
  }

  function toggleGameplayFilter(gameplay: boolean) {
    const next = gameplay ? "gameplay" : "models";
    filters = { ...filters, gameplay: filters.gameplay === next ? "any" : next };
  }

  function toggleStatusFilter(status: Extract<Filters["status"], "owned" | "wishlisted">) {
    filters = { ...filters, status: filters.status === status ? "any" : status };
  }
</script>

<CollectionSession />

<main class="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-2 px-3 pt-4 pb-16">
  <header>
    <h1 class="font-display text-2xl leading-none font-bold tracking-tight">
      Kingdom Death: <span class="text-accent">Collection</span>
    </h1>
    <p class="text-muted-foreground mt-1">Content &amp; Dice collection tracker</p>
  </header>

  <CollectionStats
    {...stats}
    status={filters.status}
    onownedclick={() => toggleStatusFilter("owned")}
    onwishlistclick={() => toggleStatusFilter("wishlisted")}
  />

  <nav aria-label="Sections" class="bg-card flex gap-1 p-1">
    {#each TABS as t (t.value)}
      <button
        type="button"
        aria-current={tab === t.value ? "page" : undefined}
        onclick={() => (tab = t.value)}
        class={[
          "flex-1 px-2 py-2 font-semibold transition-colors",
          tab === t.value ? "bg-panel text-foreground" : "text-muted-foreground hover:bg-panel/50 hover:text-foreground",
        ]}
      >
        {t.label} <span class="tabular-nums opacity-50">{t.count}</span>
      </button>
    {/each}
  </nav>

  <FilterBar
    {filters}
    onchange={(f) => (filters = f)}
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
          <ContentCard {item} onTagClick={toggleTagFilter} onKindClick={toggleKindFilter} onGameplayClick={toggleGameplayFilter} />
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
