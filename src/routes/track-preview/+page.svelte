<script lang="ts">
  import { resolve } from "$app/paths";
  import TagRail from "#lib/components/track/TagRail.svelte";
  import {
    reviewEntries,
    reviewEditions,
    reviewIndex,
    reviewNumberedEditions,
    reviewPrice,
    reviewTags,
    reviewTagLabel,
    type ReviewCatalog,
    type ReviewEdition,
  } from "#lib/catalog-view.ts";
  import { editionGameplay, editionMaterials, editionUrl, formatPrice, storeUrl } from "#lib/kdm-data.ts";

  let { data }: { data: { catalog: ReviewCatalog } } = $props();

  const categories = [
    { id: "content", label: "Content" },
    { id: "accessories", label: "Accessories" },
    { id: "bundles", label: "Bundles" },
    { id: "homebrew", label: "Homebrew" },
  ] as const;
  type Entry = ReturnType<typeof reviewEntries>[number];
  type Selection = { owned?: boolean; wished?: boolean; copy?: string };

  let category = $state<(typeof categories)[number]["id"]>("content");
  let query = $state("");
  let tagQuery = $state("");
  let tagsOpen = $state(false);
  let allTagsOpen = $state(false);
  let contentsOpen = $state<Record<string, boolean>>({});
  let selectedTags = $state<string[]>([]);
  let status = $state("all");
  let selections = $state<Record<string, Selection>>({});
  let inspected = $state<Record<string, string>>({ core: "1.6" });
  let collapsed = $state<Record<string, boolean>>({});
  let rendered = $state<Record<string, boolean>>({});
  // Observer bookkeeping is nonreactive; rendered owns the state used by the template.
  const nearby = new Set<string>();
  const observedCards = new Map<HTMLElement, string>();
  let cardObserver: IntersectionObserver | undefined;
  let lastEditionClick: string | undefined;

  function toggleCard(item: Entry) {
    const collapse = !collapsed[item.id];
    if (!collapse) rendered[item.id] = true;
    collapsed[item.id] = collapse;
  }

  function toggleAllCards() {
    const collapse = !allCollapsed;
    for (const item of filtered) {
      if (!collapse && nearby.has(item.id)) rendered[item.id] = true;
      collapsed[item.id] = collapse;
    }
  }

  function observeCard(item: Entry) {
    return (element: HTMLElement) => {
      if (rendered[item.id]) return;
      // One observer defers unopened card controls until they approach the viewport.
      cardObserver ??= new IntersectionObserver(
        (changes) => {
          for (const change of changes) {
            const id = observedCards.get(change.target as HTMLElement);
            if (!id) continue;
            if (change.isIntersecting) {
              nearby.add(id);
              if (!collapsed[id]) rendered[id] = true;
            } else nearby.delete(id);
          }
        },
        { rootMargin: "600px" },
      );
      observedCards.set(element, item.id);
      cardObserver.observe(element);
      return () => {
        cardObserver?.unobserve(element);
        observedCards.delete(element);
        nearby.delete(item.id);
        if (!observedCards.size) {
          cardObserver?.disconnect();
          cardObserver = undefined;
        }
      };
    };
  }

  const catalog = $derived(reviewIndex(data.catalog));
  const entries = $derived(catalog.entries);
  const searchQuery = $derived(query.trim().toLowerCase());
  const tagSearchQuery = $derived(tagQuery.trim().toLowerCase());
  const categoryEntries = $derived(entries.filter((item) => item.category === category));
  const tags = $derived(reviewTags(categoryEntries));
  const tagOrder = $derived(new Map(tags.map(({ tag }, index) => [tag, index])));
  const itemTags = $derived(
    new Map(categoryEntries.map((item) => [item.id, item.tags.toSorted((a, b) => (tagOrder.get(a) ?? 0) - (tagOrder.get(b) ?? 0))])),
  );
  const tagOptions = $derived(tags.filter(({ tag }) => `${tag} ${reviewTagLabel(tag)}`.includes(tagSearchQuery)));
  const cloudTags = $derived(tagOptions.filter(({ tag, count }) => count >= 5 && !/^\d+$/.test(tag)));
  const allTags = $derived(
    tagOptions.filter(({ count }) => count > 1).toSorted((a, b) => reviewTagLabel(a.tag).localeCompare(reviewTagLabel(b.tag), "en")),
  );
  const filtered = $derived(
    categoryEntries.filter((item) => {
      if (!selectedTags.every((tag) => item.tags.includes(tag))) return false;
      if (searchQuery && !catalog.search.get(item.id)?.includes(searchQuery)) return false;
      if (status === "owned" && !reviewEditions(item).some((edition) => selection(item, edition).owned)) return false;
      if (status === "wishlist" && !reviewEditions(item).some((edition) => selection(item, edition).wished)) return false;
      return true;
    }),
  );
  const allCollapsed = $derived(filtered.length > 0 && filtered.every((item) => collapsed[item.id]));
  const tagCounts = $derived(new Map(reviewTags(filtered).map(({ tag, count }) => [tag, count])));
  const owned = $derived(
    entries.flatMap((item) =>
      reviewEditions(item)
        .filter((edition) => selection(item, edition).owned)
        .map((edition) => ({ item, edition })),
    ),
  );
  const wished = $derived(entries.flatMap((item) => reviewEditions(item).filter((edition) => selection(item, edition).wished)));
  const knownValue = $derived(
    owned.reduce((total, { item, edition }) => total + (item.currency === "EUR" ? 0 : (reviewPrice(item, edition) ?? 0)), 0),
  );
  const unvalued = $derived(
    owned.filter(({ item, edition }) => item.currency === "EUR" || reviewPrice(item, edition) === undefined).length,
  );
  const coverage = $derived(
    owned.flatMap(({ item, edition }) =>
      catalog.inclusions(item.id, edition.v).map((child) => ({ ...child, parent: item.name, parentEdition: edition.v })),
    ),
  );

  function key(item: Entry, edition: ReviewEdition) {
    return `${item.id}:${edition.v}`;
  }
  function selection(item: Entry, edition: ReviewEdition) {
    return selections[key(item, edition)] ?? {};
  }
  function selectedEdition(item: Entry) {
    const editions = reviewEditions(item);
    return (
      editions.find((edition) => edition.v === inspected[item.id]) ??
      editions.find((edition) => edition.available && edition.v !== "Sim") ??
      editions.find((edition) => edition.v !== "Sim") ??
      editions[0]
    );
  }
  function inspect(item: Entry, edition: ReviewEdition) {
    lastEditionClick = undefined;
    inspected[item.id] = edition.v;
  }
  function selectEdition(item: Entry, edition: ReviewEdition) {
    const editionKey = key(item, edition);
    if (lastEditionClick === editionKey) {
      toggleOwned(item, edition);
    } else {
      inspect(item, edition);
    }
    lastEditionClick = editionKey;
  }
  function toggleOwned(item: Entry, edition: ReviewEdition) {
    if (edition.standalone === false) return;
    const value = selection(item, edition);
    selections[key(item, edition)] = { ...value, owned: !value.owned, wished: false };
    if (!value.owned)
      for (const included of catalog.includedEditions(item.id, edition.v)) {
        const includedKey = key(included.item, included.edition);
        selections[includedKey] = { ...selections[includedKey], owned: true, wished: false };
      }
    inspect(item, edition);
  }
  function toggleWish(item: Entry, edition: ReviewEdition) {
    const value = selection(item, edition);
    selections[key(item, edition)] = { ...value, wished: !value.wished };
  }
  function updateCopy(item: Entry, edition: ReviewEdition, copy: string) {
    selections[key(item, edition)] = { ...selection(item, edition), copy };
  }
  function changeCategory(next: typeof category) {
    lastEditionClick = undefined;
    category = next;
    query = "";
    tagQuery = "";
    selectedTags = [];
  }
  function toggleTag(tag: string) {
    selectedTags = selectedTags.includes(tag) ? selectedTags.filter((value) => value !== tag) : [...selectedTags, tag];
  }
  function clearSearch() {
    query = "";
    tagQuery = "";
    selectedTags = [];
    status = "all";
  }
  function toggleStatus(next: "owned" | "wishlist") {
    status = status === next ? "all" : next;
  }
  function release(edition: ReviewEdition) {
    return edition.r ?? edition.releaseWindow ?? "Date unknown";
  }
  function owners(item: Entry, edition: ReviewEdition) {
    return coverage.filter((reference) => reference.item === item.id && (!reference.edition || reference.edition === edition.v));
  }
</script>

<svelte:head><title>Collection preview | Guidepost</title></svelte:head>

<main>
  <a class="back" href={resolve("/track")}>
    <span class="back-icon i-material-symbols:arrow-back" aria-hidden="true"></span>Current tracker
  </a>
  <header>
    <h1>Collection</h1>
    <p class="subtitle">Kingdom Death: Monster collection tracker</p>
  </header>

  <section class="stats" aria-label="Preview collection totals">
    <button class="stat-owned" type="button" aria-pressed={status === "owned"} onclick={() => toggleStatus("owned")}>
      <span class="stat-label"><span class="stat-icon i-material-symbols:inventory-2-outline" aria-hidden="true"></span>Owned</span>
      <strong>{owned.length}</strong>
    </button>
    <div class="stat-value">
      <span class="stat-label">Collection value</span>
      <strong>{formatPrice(knownValue)}</strong>{#if unvalued}<small>{unvalued} excluded from this USD total</small>{/if}
    </div>
    <button class="stat-wishlist" type="button" aria-pressed={status === "wishlist"} onclick={() => toggleStatus("wishlist")}>
      <span class="stat-label"><span class="stat-icon i-material-symbols:favorite-outline" aria-hidden="true"></span>Wishlist</span>
      <strong>{wished.length}</strong>
    </button>
  </section>

  <nav class="categories" aria-label="Catalog categories">
    {#each categories as option (option.id)}
      <button type="button" aria-pressed={category === option.id} onclick={() => changeCategory(option.id)}>{option.label}</button>
    {/each}
  </nav>

  <div class="catalog-filters">
    <div class="search-controls">
      <label class="search" for="catalog-search">Search catalog</label>
      <button
        class="clear-search"
        type="button"
        onclick={clearSearch}
        disabled={!query && !tagQuery && !selectedTags.length && status === "all"}>Clear search</button
      >
      <p class="results">{filtered.length} items</p>
      <div class="search-row">
        <input id="catalog-search" type="search" bind:value={query} placeholder="Name, alias, or tag" />
        {#if selectedTags.length}
          <section class="tag-filters" aria-label="Selected tags">
            {#each selectedTags as tag (tag)}
              <button class="active-tag" type="button" aria-label="Remove {reviewTagLabel(tag)} filter" onclick={() => toggleTag(tag)}>
                {reviewTagLabel(tag)}<span class="remove-icon i-material-symbols:close" aria-hidden="true"></span>
              </button>
            {/each}
          </section>
        {/if}
        <div class="search-actions">
          <button
            class="tag-heading"
            type="button"
            aria-expanded={tagsOpen}
            aria-controls="tag-browser"
            onclick={() => (tagsOpen = !tagsOpen)}
          >
            <span class="tag-icon i-material-symbols:label-outline" aria-hidden="true"></span>
            <strong class="tag-title">Tags</strong>
            <span class="tag-chevron i-material-symbols:expand-more" aria-hidden="true"></span>
          </button>
          <button
            class="collapse-all"
            type="button"
            aria-label={allCollapsed ? "Expand all" : "Collapse all"}
            disabled={!filtered.length}
            onclick={toggleAllCards}
          >
            <span
              class={["collapse-icon", allCollapsed ? "i-material-symbols:unfold-more-double" : "i-material-symbols:unfold-less-double"]}
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </div>
    </div>
    <div class="tag-body" id="tag-browser" hidden={!tagsOpen}>
      {#if tagsOpen}
        <label class="tag-search"><span>Find a tag</span><input type="search" bind:value={tagQuery} placeholder="Search tag names" /></label
        >
        {#if cloudTags.length}
          <fieldset class="tag-cloud">
            <legend class="visually-hidden">Filter by tags</legend>
            {#each cloudTags as option (option.tag)}
              {@render tagButton(
                option.tag,
                Math.expm1((2 * Math.log(option.count / 3)) / Math.log(Math.max(4, tags[0].count) / 3)) / Math.expm1(2),
              )}
            {/each}
          </fieldset>
        {/if}
        {#if allTags.length}
          <details class="more-tags" bind:open={allTagsOpen}>
            <summary class="more-heading"
              >All tags<span class="more-chevron i-material-symbols:expand-more" aria-hidden="true"></span></summary
            >
            {#if allTagsOpen}
              <fieldset class="tag-list">
                <legend class="visually-hidden">All tags</legend>
                {#each allTags as option (option.tag)}
                  {@render tagButton(option.tag)}
                {/each}
              </fieldset>
            {/if}
          </details>
        {/if}
        {#if !tagOptions.length}<p>No tags match that search.</p>{/if}
      {/if}
    </div>
  </div>

  {#if !filtered.length}
    <p class="empty">No items match. Try another search, tag, category, or ownership filter.</p>
  {:else}
    <div class="cards">
      {#each filtered as item, index (item.id)}
        <article class="card" {@attach observeCard(item)}>{@render itemDetail(item, index < 6 || !!rendered[item.id])}</article>
      {/each}
    </div>
  {/if}
  <footer>Preview selections reset when this page reloads. Your saved collection is unchanged.</footer>
</main>

{#snippet tagButton(tag: string, weight?: number)}
  {@const selected = selectedTags.includes(tag)}
  <button
    class="cloud-tag"
    type="button"
    aria-pressed={selected}
    disabled={!selected && !tagCounts.get(tag)}
    style:--tag-weight={weight}
    onclick={() => toggleTag(tag)}>{reviewTagLabel(tag)}</button
  >
{/snippet}

{#snippet editionDetail(item: Entry, edition: ReviewEdition)}
  {@const references = owners(item, edition)}
  {#if edition.runSize}
    <p class="run">Limited run of {edition.runSize}</p>
  {/if}
  {#if references.length}
    <p class="included-note">
      Covered by your {references.map((parent) => `${parent.parent} (${parent.parentEdition})`).join(", ")}.
    </p>
  {:else if edition.standalone === false}
    <p class="included-note">This edition is tracked through the item it comes with.</p>
  {/if}
  {#if item.includes?.length || edition.includesAllSim}
    {@const included = catalog.inclusions(item.id, edition.v)}
    <details class="contents" bind:open={contentsOpen[key(item, edition)]}>
      <summary>Included with {edition.v} <span class="contents-count">{included.length} catalog entries</span></summary>
      {#if edition.includesAllSim}
        <p>Includes every current and future Sim edition. This list shows the editions currently in the catalog.</p>
      {/if}
      {#if contentsOpen[key(item, edition)]}
        <ul>
          {#each included as child, index (`${child.item}:${child.edition ?? index}`)}
            <li><span>{child.name}</span><small>{child.edition ?? child.materials?.join(", ") ?? "Edition unspecified"}</small></li>
          {/each}
        </ul>
      {/if}
      {#if !included.length}<p>No inclusions are listed for this edition.</p>{/if}
    </details>
  {/if}
{/snippet}

{#snippet shopLink(item: Entry, edition: ReviewEdition)}
  {@const url = storeUrl(editionUrl(item, edition))}
  {#if edition.available === true && url}
    <a class="shop" href={url} target="_blank" rel="noreferrer">
      Shop<span class="external-icon i-material-symbols:arrow-outward" aria-hidden="true"></span><span class="visually-hidden">
        {item.name}, {edition.v}</span
      >
    </a>
  {/if}
{/snippet}

{#snippet itemDetail(item: Entry, ready: boolean)}
  {@const editions = reviewEditions(item)}
  {@const edition = selectedEdition(item)}
  {@const numberedEditions = reviewNumberedEditions(item)}
  {@const hasOwned = editions.some((release) => selection(item, release).owned)}
  <h2>
    <button
      class="card-heading"
      type="button"
      aria-expanded={!collapsed[item.id]}
      aria-controls={`card-body-${item.id}`}
      onclick={() => toggleCard(item)}
    >
      <span>
        <span class="card-title">{item.name}</span>
        <span class="card-meta">
          {item.kind ?? "Item"}
          {#if editions.length > 1}
            &nbsp;/ {editions.length} versions
          {/if}
        </span>
      </span>
      <span class="badge owned" aria-hidden={!hasOwned} style:visibility={hasOwned ? "visible" : "hidden"}>Owned</span>
    </button>
  </h2>
  <div class={["card-body", !ready && "pending"]} id={`card-body-${item.id}`} hidden={!!collapsed[item.id]}>
    {#if ready}
      {#if edition}
        <div class="edition-details">
          {#each editions as summaryEdition (summaryEdition.v)}
            {@const price = reviewPrice(item, summaryEdition)}
            {@const gameplay = editionGameplay(item, summaryEdition)}
            {@const bundle = catalog.bundlePricing(item.id, summaryEdition.v)}
            <div
              class={["edition-summary", edition.v !== summaryEdition.v && "inactive"]}
              inert={edition.v !== summaryEdition.v}
              aria-hidden={edition.v !== summaryEdition.v ? true : undefined}
            >
              <div class="edition-value">
                <strong class="price">{price === undefined ? "Price unknown" : formatPrice(price, item.currency)}</strong>
                <span class="caption">Viewing {summaryEdition.v}</span>
              </div>
              <div class="badges">
                <span class={["badge", gameplay && "gameplay"]}>{gameplay ? "Gameplay" : "Models only"}</span>
                {@render shopLink(item, summaryEdition)}
                {#if summaryEdition.beta}<span class="badge beta">Beta</span>{/if}
              </div>
              {#if bundle}
                <p class="bundle-price">
                  {bundle.missing ? "Known item prices" : "Items separately"}: {formatPrice(bundle.total, item.currency)}
                  {#if bundle.missing}<span>{bundle.missing} item prices unavailable</span>
                  {:else if bundle.savings !== undefined && bundle.savings > 0}
                    <strong>Save {formatPrice(bundle.savings, item.currency)} ({bundle.percent}%)</strong>
                  {/if}
                </p>
              {/if}
            </div>
          {/each}
        </div>
        <div class="editions" aria-label="{item.name} editions">
          {#each editions as releaseEdition (releaseEdition.v)}
            {@const value = selection(item, releaseEdition)}
            {@const gameplay = editionGameplay(item, releaseEdition)}
            {@const price = reviewPrice(item, releaseEdition)}
            {@const detail = releaseEdition.name ?? (releaseEdition.v === "Sim" ? "Digital" : editionMaterials(releaseEdition).join(", "))}
            <div class={["edition", edition.v === releaseEdition.v && "inspected"]}>
              <label class="own">
                <input
                  type="checkbox"
                  aria-label="Own {item.name}, {releaseEdition.v}"
                  checked={!!value.owned}
                  disabled={releaseEdition.standalone === false}
                  onchange={() => toggleOwned(item, releaseEdition)}
                />
              </label>
              <button
                class="edition-label"
                type="button"
                aria-pressed={edition.v === releaseEdition.v}
                aria-label="View {item.name}, {releaseEdition.v}{gameplay ? ', includes gameplay' : ''}"
                onclick={() => selectEdition(item, releaseEdition)}
              >
                <span class="edition-name">
                  <strong>{releaseEdition.v}</strong>
                  {#if detail && detail !== releaseEdition.v}<span class="edition-meta">{detail}</span>{/if}
                </span>
                <small class="edition-date">{release(releaseEdition)}</small>
                {#if gameplay}<span class="gameplay-icon i-material-symbols:sports-esports" aria-hidden="true"></span>{/if}
              </button>
              {@render shopLink(item, releaseEdition)}
              <div class="edition-price">
                {price === undefined ? "Unknown" : formatPrice(price, item.currency)}
                {#if releaseEdition.standalone === false}<small>Included only</small>{/if}
              </div>
              <button
                class="wish"
                type="button"
                aria-pressed={!!value.wished}
                aria-label="Wishlist {item.name}, {releaseEdition.v}"
                disabled={!!value.owned || releaseEdition.standalone === false}
                onclick={() => toggleWish(item, releaseEdition)}
              >
                <span
                  class={["wish-icon", value.wished ? "i-material-symbols:favorite" : "i-material-symbols:favorite-outline"]}
                  aria-hidden="true"
                ></span>
              </button>
            </div>
          {/each}
        </div>
        {#if numberedEditions.length}
          <div class="copies">
            {#each numberedEditions as numberedEdition (numberedEdition.v)}
              {@const value = selection(item, numberedEdition)}
              <label class="copy">
                <span>{numberedEdition.v} #</span>
                <input
                  type="number"
                  min="1"
                  max={numberedEdition.runSize ?? 999}
                  maxlength="3"
                  disabled={!value.owned || numberedEdition.standalone === false}
                  value={value.copy ?? ""}
                  oninput={(event) => updateCopy(item, numberedEdition, event.currentTarget.value)}
                  placeholder="13"
                />
              </label>
            {/each}
          </div>
        {/if}
        <div class="edition-details">
          {#each editions as detailEdition (detailEdition.v)}
            <div
              class={["edition-detail", edition.v !== detailEdition.v && "inactive"]}
              inert={edition.v !== detailEdition.v}
              aria-hidden={edition.v !== detailEdition.v ? true : undefined}
            >
              {@render editionDetail(item, detailEdition)}
            </div>
          {/each}
        </div>
      {:else}<p class="included-note">No selectable editions are recorded yet.</p>{/if}
      <TagRail
        tagLabel={reviewTagLabel}
        tags={itemTags.get(item.id) ?? []}
        {selectedTags}
        label={`${item.name} tags`}
        onTagClick={toggleTag}
        --tag-gap="0.25rem"
        --tag-margin="0"
        --tag-rail-padding="0.2rem"
        --tag-padding="0.2rem 0.4rem"
        --tag-color="var(--muted-foreground)"
        --tag-font-size="var(--text-sm)"
      />
      {#if item.notes || item.aliases?.length || item.gameplayContent}
        <details class="notes">
          <summary>Notes &amp; other names</summary>
          {#if item.notes}<p>{item.notes}</p>{/if}
          {#if item.gameplayContent}<p>{item.gameplayContent}</p>{/if}
          {#if item.aliases?.length}<p>Also known as: {item.aliases.join(", ")}</p>{/if}
        </details>
      {/if}
    {/if}
  </div>
{/snippet}

<style>
  main {
    overflow-anchor: none;
    --space-card: 0.75rem;
    --size-edition-control: 1.5rem;
    --size-card-placeholder: 14rem;
    max-inline-size: 72rem;
    margin-inline: auto;
    padding: 0.75rem 0.75rem 2rem;
  }
  header {
    margin-block-end: 0.75rem;
    padding-inline: 1rem;
    text-align: center;
  }
  h1 {
    font-weight: var(--font-bold);
    font-size: 5rem;
    line-height: var(--line-height-none);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
  }
  .shop,
  .price {
    color: var(--accent);
  }
  .back {
    display: inline-flex;
    align-items: center;
    padding: 1rem;
    gap: 0.5rem;
    color: var(--muted-foreground);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }
  .back-icon {
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
  }
  .subtitle,
  footer,
  .caption,
  .results,
  small {
    color: var(--muted-foreground);
  }
  .categories {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-block-start: 0.75rem;
    padding: 0.25rem;
    gap: 0.25rem;
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  nav button {
    min-block-size: 2.75rem;
    padding: 0.4rem;
    border-radius: calc(var(--radius-control) - 0.25rem);
    color: var(--muted-foreground);

    &[aria-pressed="true"] {
      background: var(--card);
      color: var(--foreground);
    }
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .stats > :is(div, button) {
    display: grid;
    align-content: center;
    padding: 0.75rem 1rem;
    gap: 0.25rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-card);
    background: var(--panel);
  }
  .stats button {
    text-align: start;
    &[aria-pressed="true"] {
      border-color: var(--stat-accent);
      background: color-mix(var(--stat-accent) 12%, var(--panel));
    }
  }
  .stat-owned {
    --stat-accent: var(--accent-blue);
  }
  .stat-wishlist {
    --stat-accent: var(--accent-red);
  }
  .stat-value {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .stat-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .stat-icon {
    display: inline-block;
    inline-size: var(--size-icon-control);
    block-size: var(--size-icon-control);
    color: var(--stat-accent);
  }
  .stats button strong {
    color: var(--stat-accent);
  }
  .stats strong {
    font-size: clamp(var(--text-xl), 3vw, 2rem);
    line-height: var(--line-height-snug);
    font-variant-numeric: tabular-nums;
  }
  .stats small {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .bundle-price {
    display: flex;
    flex-wrap: wrap;
    flex-basis: 100%;
    gap: 0.25rem 0.75rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .bundle-price strong {
    color: var(--accent-green);
  }
  .catalog-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    margin-block: 0.75rem;
    gap: 0.5rem;
  }
  .search {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .search-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    flex-basis: 100%;
    align-items: center;
    min-inline-size: 0;
    gap: 0.25rem 0.5rem;
  }
  .search-row {
    display: flex;
    flex-wrap: wrap;
    grid-column: 1 / -1;
    align-items: center;
    gap: 0.5rem;
  }
  .search-row input {
    flex: 1 1 8rem;
    min-inline-size: 0;
  }
  input:is([type="search"], [type="number"]) {
    inline-size: 100%;
    padding: 0.5rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--card);
  }
  .tag-heading,
  .more-heading {
    display: flex;
    align-items: center;
    min-block-size: 2.75rem;
    border-radius: var(--radius-control);
    font-size: var(--text-md);
  }
  .search-actions {
    display: flex;
    gap: 0.5rem;
  }
  .tag-heading {
    padding: 0.5rem;
    gap: 0.4rem;
    border: var(--border-width) solid var(--color-divider);
    background: var(--panel);
  }
  .more-heading {
    justify-content: space-between;
    padding-inline: 0.25rem;
    gap: 0.75rem;
    color: var(--muted-foreground);
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }
  .tag-icon,
  .tag-chevron,
  .more-chevron {
    display: inline-block;
    flex-shrink: 0;
    inline-size: var(--size-icon-control);
    block-size: var(--size-icon-control);
    color: var(--muted-foreground);
  }
  .tag-title {
    flex: 1;
  }
  .tag-chevron,
  .more-chevron {
    transition: rotate var(--duration-fast) var(--ease-standard);
  }
  .tag-heading[aria-expanded="true"] .tag-chevron,
  .more-tags[open] .more-chevron {
    rotate: 180deg;
  }
  .tag-body {
    display: grid;
    flex-basis: 100%;
    min-inline-size: 0;
    padding: 0.75rem;
    gap: 0.75rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);

    &[hidden] {
      display: none;
    }
  }
  .tag-body p,
  .tag-search span {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .tag-search span {
    display: block;
    margin-block-end: 0.35rem;
  }
  .tag-cloud,
  .tag-list,
  .tag-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.125rem;
  }
  .tag-cloud,
  .tag-list {
    min-inline-size: 0;
    padding: 0.4rem;
  }
  .tag-cloud {
    justify-content: center;
    padding-block: 1rem;
  }
  .tag-list {
    max-block-size: 20rem;
    overflow-y: auto;
  }
  .cloud-tag {
    max-inline-size: 100%;
    min-block-size: 2rem;
    padding: 0 0.5em;
    /* translate: 0 calc((0.5 - var(--tag-weight)) * 0.4rem); */
    border-radius: 99px;
    background: color-mix(var(--card) 75%, transparent);
    box-shadow: 0 0.2rem 0.6rem color-mix(var(--contrast) 18%, transparent);
    font: var(--font-semibold) calc(var(--text-md) + var(--tag-weight) * var(--text-lg) * 1.75) / var(--line-height-snug)
      var(--font-display);
    overflow-wrap: anywhere;
    transition:
      scale var(--duration-fast) var(--ease-standard),
      box-shadow var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);

    &[aria-pressed="true"] {
      background: color-mix(var(--accent) 14%, var(--panel));
      color: var(--accent);
    }
  }
  .active-tag {
    display: inline-flex;
    align-items: center;
    max-inline-size: 100%;
    min-block-size: 2.75rem;
    padding: 0.4rem 0.65rem;
    gap: 0.4rem;
    border: var(--border-width) solid color-mix(var(--accent) 40%, transparent);
    border-radius: var(--radius-control);
    background: color-mix(var(--accent) 10%, var(--panel));
    color: var(--accent);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
  :is(.tag-heading, .more-heading, .cloud-tag, .active-tag):focus-visible {
    outline: var(--border-width) solid var(--accent);
    outline-offset: 3px;
  }
  .remove-icon {
    display: inline-block;
    flex-shrink: 0;
    inline-size: 1rem;
    block-size: 1rem;
    color: var(--accent);
  }
  .results {
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .clear-search {
    min-block-size: 1.5rem;
    padding-inline: 0.25rem;
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .cards,
  .card-body,
  .edition-detail {
    display: grid;
    gap: 0.5rem;
  }
  .cards {
    align-items: start;
  }
  .card {
    overflow: hidden;
    border-radius: var(--radius-card);
    background: var(--card);
  }
  .card-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    inline-size: 100%;
    padding: var(--space-card);
    gap: 0.5rem;
    background: var(--panel);
    text-align: start;
  }
  .card-title {
    display: block;
    font: var(--font-semibold) var(--text-card-title) / var(--line-height-snug) var(--font-display);
  }
  .card-meta {
    display: block;
    margin-block-start: 0.15rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .card-body {
    contain-intrinsic-block-size: auto var(--size-card-placeholder);
    content-visibility: auto;
    padding: var(--space-card);
    &.pending {
      min-block-size: var(--size-card-placeholder);
    }
    &[hidden] {
      display: none;
    }
  }
  .card-heading > span:first-child {
    flex: 1;
  }
  .collapse-all {
    display: grid;
    place-items: center;
    min-inline-size: 2.75rem;
    padding: 0.5rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .collapse-icon {
    display: inline-block;
    inline-size: var(--size-icon-control);
    block-size: var(--size-icon-control);
    color: var(--muted-foreground);
  }
  .edition-details {
    display: grid;
    min-inline-size: 0;
  }
  .edition-detail,
  .edition-summary {
    grid-area: 1 / 1;
    align-self: start;
    min-inline-size: 0;
    &.inactive {
      visibility: hidden;
    }
  }
  .edition-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .edition-value {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }
  .caption {
    font-size: var(--text-sm);
  }
  .price {
    font-size: var(--text-lg);
    font-variant-numeric: tabular-nums;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .badge {
    padding: 0.2rem 0.45rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);

    &.beta {
      border-color: var(--accent);
      color: var(--accent);
    }

    &.gameplay {
      border-color: var(--accent-green);
      color: var(--accent-green);
    }

    &.owned {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--foreground);
      font-weight: var(--font-bold);
    }
  }
  .shop {
    display: inline-flex;
    align-items: center;
    padding-inline: 0.25rem;
    border-radius: var(--radius-control);
    font-size: var(--text-lg);
    line-height: var(--size-edition-control);
    white-space: nowrap;
  }
  .external-icon {
    inline-size: 1em;
    block-size: 1em;
    color: var(--accent);
  }
  .edition .shop {
    grid-column: 3;
    justify-self: center;
    font-size: var(--text-md);
  }
  .editions {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr) max-content auto max-content;
    overflow: hidden;
  }
  .edition {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    align-items: center;
    gap: 0.25rem;
    border-block-end: var(--border-width) solid var(--color-divider);

    &:last-child {
      border-block-end: 0;
    }
    &.inspected {
      background: var(--panel);
    }
  }
  .own,
  .wish {
    display: grid;
    place-items: center;
    min-block-size: var(--size-edition-control);
    padding-inline: 0.25rem;
  }
  .own {
    border-radius: var(--radius-control);
  }
  input[type="checkbox"] {
    appearance: none;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    padding: var(--border-width);
    border: var(--border-width) solid var(--foreground);
    border-radius: 0;
    background: var(--contrast);
    cursor: pointer;

    &:checked {
      background:
        linear-gradient(var(--foreground) 0 0) content-box,
        var(--contrast);
    }
  }
  .edition-label {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 6rem var(--size-icon-control);
    align-items: center;
    min-block-size: var(--size-edition-control);
    padding: 0.125rem 0.25rem;
    gap: 0.15rem 0.5rem;
    border-radius: var(--radius-control);
    font-size: var(--text-md);
    line-height: var(--line-height-snug);
    text-align: start;
  }
  .edition-name {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.15rem 0.5rem;
    overflow-wrap: anywhere;
  }
  .edition-date {
    font-variant-numeric: tabular-nums;
  }
  .gameplay-icon {
    display: inline-block;
    inline-size: var(--size-icon-control);
    block-size: var(--size-icon-control);
    color: var(--accent-green);
  }
  .edition-meta {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .edition-label small {
    font-size: var(--text-sm);
  }
  .edition-price {
    grid-column: 4;
    font-size: var(--text-md);
    font-variant-numeric: tabular-nums;
    text-align: end;
  }
  .edition-price small {
    display: block;
    font-size: var(--text-sm);
  }
  .wish {
    grid-column: 5;
  }
  .wish-icon {
    display: inline-block;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    color: var(--accent-red);
  }
  .run,
  .copy,
  .included-note {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .copies {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: 0.5rem;
  }
  .copy {
    display: flex;
    align-items: center;
    justify-content: left;
    gap: 0.5rem;
  }
  .copy input {
    flex-shrink: 0;
    inline-size: 5rem;
    padding: 0.35rem;
    color: var(--foreground);
  }
  .contents,
  .notes {
    font-size: var(--text-sm);
  }
  summary {
    padding-block: 0.25rem;
    cursor: pointer;
  }
  .contents-count {
    float: inline-end;
    color: var(--muted-foreground);
  }
  .contents ul {
    display: grid;
    margin-block-start: 0.5rem;
    gap: 0.35rem;
  }
  .contents li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }
  .contents li small {
    flex-shrink: 0;
  }
  .notes p {
    margin-block-start: 0.5rem;
    color: var(--muted-foreground);
    white-space: pre-line;
  }
  .empty {
    padding: 2rem 1rem;
    color: var(--muted-foreground);
    text-align: center;
  }
  footer {
    margin-block-start: 1rem;
    font-size: var(--text-sm);
    text-align: center;
  }
  button:disabled,
  input:disabled {
    cursor: default;
    opacity: 0.4;
  }
  button,
  a,
  summary,
  input {
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard),
      border-color var(--duration-fast) var(--ease-standard);
  }
  @media (hover: hover) {
    button:not(:disabled, .wish, .cloud-tag):hover,
    summary:hover,
    .own:has(input:not(:disabled)):hover {
      background: color-mix(var(--accent) 14%, var(--panel));
      color: var(--accent);
    }
    .active-tag:not(:disabled):hover,
    input:is([type="search"], [type="number"]):not(:disabled):hover {
      border-color: var(--accent);
    }
    .tag-heading:hover :is(.tag-icon, .tag-chevron),
    summary:hover :is(.tag-icon, .tag-chevron, .more-chevron, .contents-count) {
      color: var(--accent);
    }
    .wish:not(:disabled):hover {
      background: color-mix(var(--accent-red) 18%, var(--panel));
    }
    .back:hover,
    .shop:hover {
      color: var(--accent);
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }
    .cloud-tag:not(:disabled):hover {
      isolation: isolate;
      transform-origin: bottom;
      scale: 1.25;
      background: color-mix(var(--accent) 14%, var(--panel));
      box-shadow: 0 0.5rem 1rem color-mix(var(--contrast) 25%, transparent);
      color: var(--accent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button,
    a,
    summary,
    input,
    .cloud-tag,
    .tag-chevron,
    .more-chevron {
      transition: none;
    }
  }
  @media (forced-colors: active) {
    input[type="checkbox"] {
      appearance: auto;
      padding: 0;
      border: 0;
      background: none;
    }
  }
  @media (min-width: 60rem) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 40rem) {
    .stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .stat-value {
      grid-column: auto;
      grid-row: auto;
    }
  }
</style>
