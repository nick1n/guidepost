<script lang="ts">
  import { onMount } from "svelte";
  import ContentCard from "#lib/components/ContentCard.svelte";
  import DiceCard from "#lib/components/DiceCard.svelte";
  import BundleCard from "#lib/components/BundleCard.svelte";
  import CollectionStats from "#lib/components/CollectionStats.svelte";
  import FilterBar from "#lib/components/FilterBar.svelte";
  import { allContentTags, allDiceTags, bundles, content, dice, effectivePrice, type ContentItem } from "#lib/kdm-data.ts";
  import { collection } from "#lib/collection.svelte.ts";
  import { defaultFilters, type Filters } from "#lib/filters.ts";

  type Tab = "content" | "dice" | "bundles";

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: "content", label: "Content", count: content.length },
    { value: "dice", label: "Dice", count: dice.length },
    { value: "bundles", label: "Bundles", count: bundles.length },
  ];

  const bundleTags = Array.from(new Set(bundles.flatMap((b) => b.tags))).sort();

  function priceOf(id: string) {
    return content.find((c) => c.id === id)?.price ?? dice.find((d) => d.id === id)?.price ?? 0;
  }

  let tab = $state<Tab>("content");
  let filters = $state<Filters>({ ...defaultFilters });

  onMount(() => {
    collection.init();
  });

  const stats = $derived.by(() => {
    const all = [...content, ...dice];
    let ownedCount = 0;
    let ownedValue = 0;
    let wishlistCount = 0;
    let wishlistValue = 0;
    for (const item of all) {
      const entry = collection.state[item.id];
      const price =
        "editions" in item || "versions" in item
          ? (effectivePrice(
              item as ContentItem,
              entry?.versions ?? (entry?.version ? [entry.version] : []),
              entry?.editions ?? (entry?.edition ? [entry.edition] : []),
            ) ?? 0)
          : (item.price ?? 0);
      if (entry?.owned) {
        ownedCount += 1;
        ownedValue += price;
      } else if (entry?.wishlisted) {
        wishlistCount += 1;
        wishlistValue += price;
      }
    }
    return {
      ownedCount,
      totalCount: all.length,
      ownedValue,
      wishlistCount,
      wishlistValue,
    };
  });

  const visible = $derived.by(() => {
    const q = filters.query.trim().toLowerCase();

    const matches = (item: { id: string; name: string; alt?: string; tags: string[]; gameplay?: boolean; kind?: string }) => {
      if (q && !`${item.name} ${item.alt ?? ""} ${item.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      if (filters.tags.length && !filters.tags.every((t) => item.tags.includes(t))) return false;
      if (filters.kind !== "any" && item.kind !== filters.kind) return false;
      if (filters.gameplay !== "any" && item.gameplay !== undefined) {
        if (filters.gameplay === "gameplay" && !item.gameplay) return false;
        if (filters.gameplay === "models" && item.gameplay) return false;
      }
      const entry = collection.state[item.id];
      if (filters.status === "owned" && !entry?.owned) return false;
      if (filters.status === "unowned" && entry?.owned) return false;
      if (filters.status === "wishlisted" && !entry?.wishlisted) return false;
      return true;
    };

    const sortItems = <T extends { name: string; price?: number }>(items: T[]) => {
      const sorted = [...items];
      if (filters.sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
      if (filters.sort === "price-asc") sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      if (filters.sort === "price-desc") sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      return sorted;
    };

    return {
      visibleContent: sortItems(content.filter(matches)),
      visibleDice: sortItems(dice.filter(matches)),
      visibleBundles: sortItems(bundles.filter(matches)),
    };
  });

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
    filters = {
      ...filters,
      gameplay: filters.gameplay === next ? "any" : next,
    };
  }
</script>

<main class="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-2 px-3 pb-16 pt-4">
  <header>
    <h1 class="font-display text-2xl font-bold leading-none tracking-tight">
      Kingdom Death: <span class="text-accent">Collection</span>
    </h1>
    <p class="mt-1 text-muted-foreground">Content &amp; Dice collection tracker</p>
  </header>

  <CollectionStats {...stats} />

  <nav aria-label="Sections" class="flex gap-1 bg-card p-1">
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
    <p class="py-10 text-center text-muted-foreground">Loading collection…</p>
  {:else if resultCount === 0}
    <p class="py-10 text-center text-muted-foreground">Nothing matches these filters</p>
  {:else}
    <ul class="flex flex-col gap-3">
      {#if tab === "content"}
        {#each visible.visibleContent as item (item.id)}
          <ContentCard
            {item}
            entry={collection.get(item.id)}
            requiresOwned={(item.requires ?? []).every((r) => collection.state[r]?.owned)}
            onToggleOwned={() =>
              collection.toggleOwned(item.id, {
                version: item.versions?.[item.versions.length - 1]?.v,
                edition: item.editions?.[item.editions.length - 1]?.v,
              })}
            onToggleWishlist={() => collection.toggleWishlisted(item.id)}
            onSetVersion={(v) => collection.setVersion(item.id, v)}
            onSetEdition={(e) => collection.setEdition(item.id, e)}
            onSetEditionNumber={(edition, n) => collection.setEditionNumber(item.id, edition, n)}
            onTagClick={toggleTagFilter}
            onKindClick={toggleKindFilter}
            onGameplayClick={toggleGameplayFilter}
          />
        {/each}
      {/if}

      {#if tab === "dice"}
        {#each visible.visibleDice as item (item.id)}
          <DiceCard
            {item}
            entry={collection.get(item.id)}
            onToggleOwned={() => collection.toggleOwned(item.id)}
            onToggleWishlist={() => collection.toggleWishlisted(item.id)}
          />
        {/each}
      {/if}

      {#if tab === "bundles"}
        {#each visible.visibleBundles as bundle (bundle.id)}
          <BundleCard
            {bundle}
            entry={collection.get(bundle.id)}
            collectionState={collection.state}
            partsValue={bundle.includes.reduce((sum, id) => sum + priceOf(id), 0)}
            onToggleOwned={() => {
              const nextOwned = !collection.state[bundle.id]?.owned;
              collection.toggleOwned(bundle.id);
              collection.setManyOwned(bundle.includes, nextOwned);
            }}
            onToggleWishlist={() => collection.toggleWishlisted(bundle.id)}
            onSetPartsOwned={(owned) => collection.setManyOwned(bundle.includes, owned)}
          />
        {/each}
      {/if}
    </ul>
  {/if}

  <p class="mt-2 text-center text-muted-foreground">
    Saved in this browser - {stats.totalCount} catalog entries
  </p>
</main>
