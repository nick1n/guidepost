<script module lang="ts">
  import rawCatalog from "../../../exports/kdm-catalog/kdm-data.json";
  import { reviewIndex, type reviewEntries, type ReviewCatalog, type ReviewEdition } from "#lib/catalog-view.ts";

  const catalog = reviewIndex(rawCatalog as ReviewCatalog);
  const entries = catalog.entries;

  const eurToUsd = 1.13;
  const categories = [
    { id: "content", label: "Content" },
    { id: "accessories", label: "Accessories" },
    { id: "bundles", label: "Bundles" },
    { id: "homebrew", label: "Homebrew" },
  ] as const;
  type Entry = ReturnType<typeof reviewEntries>[number];

  function key(item: Entry, edition: ReviewEdition) {
    return `${item.id}:${edition.v}`;
  }
  function release(edition: ReviewEdition) {
    return edition.r ?? edition.releaseWindow ?? "Date unknown";
  }
</script>

<script lang="ts">
  import { resolve } from "$app/paths";
  import { onDestroy } from "svelte";
  import TagRail from "#lib/components/track/TagRail.svelte";
  import HoldRipple from "#lib/components/gestures/HoldRipple.svelte";
  import { swipe, type SwipeDirection } from "#lib/swipe.ts";
  import { reviewEditions, reviewNumberedEditions, reviewPrice, reviewTags, reviewTagLabel } from "#lib/catalog-view.ts";
  import { editionGameplay, editionMaterials, editionUrl, formatPrice, storeUrl } from "#lib/kdm-data.ts";

  type Selection = { owned?: boolean; wished?: boolean; copy?: string };
  type Owner = { parent: string; parentEdition: string; edition?: string };

  const swipeFeedbackDuration = 900;
  const emptySelection: Readonly<Selection> = {};

  let category = $state<(typeof categories)[number]["id"]>("content");
  let categoryResults = $state.raw<Partial<Record<typeof category, Entry[]>>>({ content: catalog.byCategory.get("content") ?? [] });
  let dragDistance = $state(0);
  let categoriesVisible = $state(true);
  let categoryBar: HTMLElement | undefined;
  let swipeFeedback = $state(false);
  let swipeFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
  const showSwipeTabs = $derived((dragDistance !== 0 || swipeFeedback) && !categoriesVisible);
  let query = $state("");
  let tagsOpen = $state(false);
  let allTagsOpen = $state(false);
  let contentsOpen = $state<Record<string, boolean>>({});
  let selectedTags = $state<string[]>([]);
  let status = $state("all");
  let selections = $state<Record<string, Selection>>({});
  let inspected = $state<Record<string, string>>({});
  let collapsed = $state<Record<string, boolean>>({});
  let rendered = $state<Record<string, boolean>>({});
  let ownershipFeedback = $state<{ item: string; kind: "cleared" | "hint" }>();
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    clearTimeout(feedbackTimer);
    clearTimeout(swipeFeedbackTimer);
  });
  // Observer bookkeeping is nonreactive; rendered owns the state used by the template.
  const nearby = new Set<string>();
  const observedCards = new Map<HTMLElement, string>();
  let cardObserver: IntersectionObserver | undefined;

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
    return collapse ? "All cards collapsed." : "All cards expanded.";
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

  const searchQuery = $derived(query.trim().toLowerCase());
  const categoryEntries = $derived(catalog.byCategory.get(category) ?? []);
  const tags = $derived(catalog.tags.get(category) ?? []);
  const cloudTags = $derived(tags.filter(({ tag, count }) => count >= 5 && !/^\d+$/.test(tag)));
  const allTags = $derived(
    tags.filter(({ count }) => count > 1).toSorted((a, b) => reviewTagLabel(a.tag).localeCompare(reviewTagLabel(b.tag), "en")),
  );
  const filtered = $derived.by(() => {
    if (!searchQuery && !selectedTags.length && status === "all") return categoryEntries;
    return categoryEntries.filter((item) => {
      if (!selectedTags.every((tag) => item.tags.includes(tag))) return false;
      if (searchQuery && !catalog.search.get(item.id)?.includes(searchQuery)) return false;
      if (status === "owned" && !reviewEditions(item).some((edition) => selection(item, edition).owned)) return false;
      if (status === "wishlist" && !reviewEditions(item).some((edition) => selection(item, edition).wished)) return false;
      return true;
    });
  });
  const allCollapsed = $derived(filtered.length > 0 && filtered.every((item) => collapsed[item.id]));
  const latestUnowned = $derived(
    filtered.flatMap((item) => {
      const edition = reviewEditions(item).at(-1);
      return edition && edition.standalone !== false && !selection(item, edition).owned ? [{ item, edition }] : [];
    }),
  );
  const tagCounts = $derived(new Map((filtered === categoryEntries ? tags : reviewTags(filtered)).map(({ tag, count }) => [tag, count])));
  const owned = $derived(
    entries.flatMap((item) =>
      reviewEditions(item)
        .filter((edition) => selection(item, edition).owned)
        .map((edition) => ({ item, edition })),
    ),
  );
  const wishlistCount = $derived(
    entries.reduce((total, item) => total + reviewEditions(item).filter((edition) => selection(item, edition).wished).length, 0),
  );
  const collectionValue = $derived(
    owned.reduce((total, { item, edition }) => total + (reviewPrice(item, edition) ?? 0) * (item.currency === "EUR" ? eurToUsd : 1), 0),
  );
  const coverage = $derived.by(() => {
    const grouped = new Map<string, Owner[]>();
    for (const { item, edition } of owned) {
      for (const child of catalog.inclusions(item.id, edition.v)) {
        const owners = grouped.get(child.item) ?? [];
        owners.push({ parent: item.name, parentEdition: edition.v, edition: child.edition });
        grouped.set(child.item, owners);
      }
    }
    return grouped;
  });

  function selection(item: Entry, edition: ReviewEdition) {
    return selections[key(item, edition)] ?? emptySelection;
  }
  function editableSelection(item: Entry, edition: ReviewEdition) {
    return (selections[key(item, edition)] ??= {});
  }
  function selectedEdition(item: Entry) {
    const editions = reviewEditions(item);
    return (
      editions.find((edition) => edition.v === inspected[item.id]) ??
      editions.findLast((edition) => edition.standalone !== false) ??
      editions.at(-1)
    );
  }
  function markSelectedOwned(item: Entry) {
    const edition = selectedEdition(item);
    if (!edition || edition.standalone === false) return;
    if (!selection(item, edition).owned) toggleOwned(item, edition);
  }
  function showOwnershipFeedback(item: Entry, kind: "cleared" | "hint") {
    clearTimeout(feedbackTimer);
    ownershipFeedback = { item: item.id, kind };
    feedbackTimer = setTimeout(() => (ownershipFeedback = undefined), 2000);
  }
  function tapOwnership(item: Entry) {
    const hasOwned = reviewEditions(item).some((edition) => selection(item, edition).owned);
    markSelectedOwned(item);
    if (hasOwned) showOwnershipFeedback(item, "hint");
  }
  function clearItemOwned(item: Entry) {
    const ownedEditions = reviewEditions(item).filter((edition) => selection(item, edition).owned);
    for (const edition of ownedEditions) setEditionOwned(item, edition, false);
    showOwnershipFeedback(item, "cleared");
    return `${item.name}, all editions marked not owned.`;
  }
  function inspect(item: Entry, edition: ReviewEdition) {
    inspected[item.id] = edition.v;
  }
  function selectEdition(item: Entry, edition: ReviewEdition) {
    if (selectedEdition(item)?.v === edition.v) {
      toggleOwned(item, edition);
    } else {
      inspect(item, edition);
    }
  }
  function toggleOwned(item: Entry, edition: ReviewEdition) {
    if (edition.standalone === false) return;
    if (ownershipFeedback?.item === item.id) {
      clearTimeout(feedbackTimer);
      ownershipFeedback = undefined;
    }
    setEditionOwned(item, edition, !selection(item, edition).owned);
    inspect(item, edition);
  }
  function setEditionOwned(item: Entry, edition: ReviewEdition, owned: boolean) {
    for (const target of [{ item, edition }, ...catalog.includedEditions(item.id, edition.v)]) {
      const value = editableSelection(target.item, target.edition);
      value.owned = owned;
      if (owned) value.wished = false;
    }
  }
  function toggleWish(item: Entry, edition: ReviewEdition) {
    const value = editableSelection(item, edition);
    value.wished = !value.wished;
  }
  function markLatestOwned() {
    for (const { item, edition } of latestUnowned) {
      if (!selection(item, edition).owned) toggleOwned(item, edition);
    }
  }
  function updateCopy(item: Entry, edition: ReviewEdition, copy: string) {
    editableSelection(item, edition).copy = copy;
  }
  function changeCategory(next: typeof category) {
    // Retain the outgoing results without rebuilding hidden cards when search is cleared.
    categoryResults = {
      ...categoryResults,
      [category]: filtered,
      [next]: categoryResults[next] ?? catalog.byCategory.get(next) ?? [],
    };
    category = next;
    query = "";
    selectedTags = [];
  }
  function swipeCategory(direction: SwipeDirection) {
    const index = categories.findIndex((option) => option.id === category);
    const offset = direction === "left" ? 1 : -1;
    const next = categories[(index + offset + categories.length) % categories.length];
    changeCategory(next.id);
    if (!categoriesVisible) {
      clearTimeout(swipeFeedbackTimer);
      swipeFeedback = true;
      swipeFeedbackTimer = setTimeout(() => (swipeFeedback = false), swipeFeedbackDuration);
    }
  }
  function dragCatalog(distance: number) {
    if (distance !== 0 && dragDistance === 0) {
      clearTimeout(swipeFeedbackTimer);
      swipeFeedback = false;
    }
    // Measure at gesture start so feedback does not wait for the observer's next frame.
    if (distance !== 0 && dragDistance === 0 && categoryBar) {
      const bounds = categoryBar.getBoundingClientRect();
      categoriesVisible = bounds.bottom > 0 && bounds.top < window.innerHeight;
    }
    dragDistance = distance;
  }
  function observeCategories(element: HTMLElement) {
    categoryBar = element;
    const observer = new IntersectionObserver(([entry]) => {
      categoriesVisible = entry.isIntersecting;
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      categoryBar = undefined;
    };
  }
  function toggleTag(tag: string) {
    selectedTags = selectedTags.includes(tag) ? selectedTags.filter((value) => value !== tag) : [...selectedTags, tag];
  }
  function clearSearch() {
    query = "";
    selectedTags = [];
    status = "all";
  }
  function toggleStatus(next: "owned" | "wishlist") {
    status = status === next ? "all" : next;
  }
  function owners(item: Entry, edition: ReviewEdition) {
    return (coverage.get(item.id) ?? []).filter((reference) => !reference.edition || reference.edition === edition.v);
  }
</script>

<svelte:head><title>Collection | Guidepost</title></svelte:head>

<main {@attach swipe({ onSwipe: swipeCategory, onDrag: dragCatalog })} class="scrollbar-stable">
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
      <strong>{formatPrice(collectionValue)}</strong>
    </div>
    <button class="stat-wishlist" type="button" aria-pressed={status === "wishlist"} onclick={() => toggleStatus("wishlist")}>
      <span class="stat-label"><span class="stat-icon i-material-symbols:favorite-outline" aria-hidden="true"></span>Wishlist</span>
      <strong>{wishlistCount}</strong>
    </button>
  </section>

  <nav class="categories" aria-label="Catalog categories" {@attach observeCategories}>
    {@render categoryButtons()}
  </nav>
  <nav class={["swipe-tabs", showSwipeTabs && "is-visible"]} aria-label="Catalog categories while swiping" inert={!showSwipeTabs}>
    {@render categoryButtons()}
  </nav>

  <div class="catalog-filters">
    <div class="search-controls">
      <div class="search-heading">
        <label class="search" for="catalog-search">Search catalog</label>
        {#if searchQuery || selectedTags.length}
          <button class="search-command" type="button" onclick={markLatestOwned} disabled={!latestUnowned.length}>
            Mark latest editions owned
          </button>
        {/if}
        <button class="search-command" type="button" onclick={clearSearch} disabled={!query && !selectedTags.length && status === "all"}>
          Clear search
        </button>
        <p class="results">{filtered.length} items</p>
      </div>
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
        {#if !tags.length}<p>No tags are listed for this category.</p>{/if}
      {/if}
    </div>
  </div>

  <div class="catalog-viewport">
    <div class={["catalog-content", dragDistance !== 0 && "is-dragging"]} style:--drag-distance={`${dragDistance}px`}>
      {#each categories as option (option.id)}
        {#if categoryResults[option.id]}
          {@const items = option.id === category ? filtered : categoryResults[option.id]!}
          <!-- Keep visited cards mounted so category changes preserve their controls and deferred bodies. -->
          <div data-category={option.id} hidden={option.id !== category}>
            {#if !items.length}
              <p class="empty">No items match. Try another search, tag, category, or ownership filter.</p>
            {:else}
              <div class="cards">
                {#each items as item, index (item.id)}
                  <article class={["card", collapsed[item.id] && "is-collapsed"]} {@attach observeCard(item)}>
                    {@render itemDetail(item, index < 6 || !!rendered[item.id])}
                  </article>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
  <footer>Preview selections reset when this page reloads. Your saved collection is unchanged.</footer>
</main>

{#snippet categoryButtons()}
  {#each categories as option (option.id)}
    <button class="category-tab" type="button" aria-pressed={category === option.id} onclick={() => changeCategory(option.id)}
      >{option.label}</button
    >
  {/each}
  <span class="tab-highlight" aria-hidden="true"></span>
{/snippet}

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
      {#if contentsOpen[key(item, edition)] && selectedEdition(item)?.v === edition.v}
        <ul>
          {#if item.category === "bundles"}
            {#each catalog.includedEditions(item.id, edition.v, false) as child (`${child.item.id}:${child.edition.v}`)}
              {@const price = reviewPrice(child.item, child.edition)}
              <li>
                <span>{child.item.name} <small>{child.edition.v}</small></span>
                <span class="included-price">{price === undefined ? "Price unknown" : formatPrice(price, child.item.currency)}</span>
              </li>
            {/each}
          {:else}
            {#each included as child, index (`${child.item}:${child.edition ?? index}`)}
              <li><span>{child.name}</span><small>{child.edition ?? child.materials?.join(", ") ?? "Edition unspecified"}</small></li>
            {/each}
          {/if}
        </ul>
      {/if}
      {#if !included.length}<p>No inclusions are listed for this edition.</p>{/if}
    </details>
  {/if}
{/snippet}

{#snippet shopLink(item: Entry, edition: ReviewEdition)}
  {@const url = storeUrl(editionUrl(item, edition))}
  {@const unavailable = edition.available !== true}
  {#if url}
    <a class={["shop", unavailable && "unavailable"]} href={url} target="_blank" rel="noreferrer">
      Shop<span
        class={["external-icon", unavailable ? "i-material-symbols:link-off" : "i-material-symbols:arrow-outward"]}
        aria-hidden="true"
      ></span>
      <span class="visually-hidden">
        {item.name}, {edition.v}
        {unavailable ? ", unavailable" : ""}
      </span>
    </a>
  {/if}
{/snippet}

{#snippet itemDetail(item: Entry, ready: boolean)}
  {@const editions = reviewEditions(item)}
  {@const edition = selectedEdition(item)}
  {@const numberedEditions = reviewNumberedEditions(item).filter((release) => selection(item, release).owned)}
  {@const hasOwned = editions.some((release) => selection(item, release).owned)}
  {@const feedback = ownershipFeedback?.item === item.id ? ownershipFeedback.kind : undefined}
  <h2>
    <HoldRipple
      ontap={() => toggleCard(item)}
      onhold={toggleAllCards}
      holdHint="Click to collapse or expand this card. Hold or press Shift+Enter to collapse or expand all cards in the current results."
    >
      {#snippet children(events, paint)}
        <button class="card-heading" type="button" aria-expanded={!collapsed[item.id]} aria-controls={`card-body-${item.id}`} {...events}>
          {@render paint()}
          <span class="card-label">
            <span class="card-title">{item.name}</span>
            <span class="card-meta">
              <span class={[feedback && "inactive"]} aria-hidden={!!feedback}>
                {item.category === "bundles" ? "bundle" : (item.kind ?? "Item")}
                {#if editions.length > 1}
                  &nbsp;/ {editions.length} versions
                {/if}
              </span>
              <span class={["clear-feedback", feedback !== "cleared" && "inactive"]} aria-hidden={feedback !== "cleared"}>
                Ownership cleared
              </span>
              <span class={["hold-hint", feedback !== "hint" && "inactive"]} aria-hidden={feedback !== "hint"}>
                Hold to clear ownership
              </span>
            </span>
          </span>
          <span class="card-chevron i-material-symbols:expand-more" aria-hidden="true"></span>
        </button>
      {/snippet}
    </HoldRipple>
    <HoldRipple
      ontap={() => tapOwnership(item)}
      onhold={() => clearItemOwned(item)}
      holdHint="Click to own the selected edition. Hold or press Shift+Enter to remove ownership from all editions of this item."
    >
      {#snippet children(events, paint)}
        <button
          class="ownership"
          type="button"
          aria-label="Owned editions of {item.name}"
          aria-pressed={hasOwned}
          disabled={!hasOwned && (!edition || edition.standalone === false)}
          {...events}
        >
          {@render paint()}
          <span class="ownership-label">Owned</span>
        </button>
      {/snippet}
    </HoldRipple>
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
                {#if item.category === "accessories"}
                  {#if item.accessoryType}<span class="badge">{item.accessoryType}</span>{/if}
                {:else}
                  <span class={["badge", gameplay && "gameplay"]}>{gameplay ? "Gameplay" : "Models only"}</span>
                {/if}
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
            {@const detail = releaseEdition.v === "Sim" ? "Digital" : editionMaterials(releaseEdition).join(", ")}
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
                {#if gameplay}
                  <span
                    class="gameplay-icon i-material-symbols:sports-esports"
                    style:color={releaseEdition.beta ? "var(--accent-blue)" : undefined}
                    title={releaseEdition.beta ? "Beta" : "Gameplay"}
                    aria-hidden="true"
                  ></span>
                {/if}
              </button>
              {@render shopLink(item, releaseEdition)}
              <div class="edition-price">
                {#if releaseEdition.standalone === false}
                  <small>Included only</small>
                {:else}
                  {price === undefined ? "Unknown" : formatPrice(price, item.currency)}
                {/if}
              </div>
              <button
                class="wish"
                style:visibility={value.owned ? "hidden" : "visible"}
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
                  disabled={numberedEdition.standalone === false}
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
        tags={catalog.itemTags.get(item.id) ?? []}
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
    --space-card: 0.75rem;
    --size-edition-control: 1.5rem;
    --size-card-placeholder: 14rem;
    --size-card-collapsed: 4.5rem;
    --distance-swipe-limit: 2.25rem;
    --size-catalog: 72rem;
    max-inline-size: var(--size-catalog);
    margin-inline: auto;
    padding: 0.75rem 0.25rem 2rem;
    overflow-anchor: none;
  }
  .catalog-viewport {
    /* Clip the shifted catalog without creating a scrolling container. */
    overflow-x: clip;
  }
  .catalog-content {
    translate: clamp(calc(-1 * var(--distance-swipe-limit)), calc(var(--drag-distance) * 0.3), var(--distance-swipe-limit)) 0;
    transition: translate var(--duration-fast) var(--ease-standard);

    &.is-dragging {
      transition: none;
      cursor: grabbing;
    }
  }
  header {
    margin-block-end: 0.75rem;
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
  .categories,
  .swipe-tabs {
    display: flex;
    margin-block-start: 0.75rem;
    padding: 0.25rem;
    overflow-x: auto;
    gap: 0.25rem;
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .swipe-tabs {
    /* Keep the gesture's category controls visible without moving the page layout. */
    position: fixed;
    inset-block-start: 0;
    inset-inline: 0.25rem;
    z-index: 2;
    max-inline-size: calc(var(--size-catalog) - 0.5rem);
    margin-inline: auto;
    margin-block-start: 0;
    padding-block-start: max(0.25rem, env(safe-area-inset-top));
    box-shadow: 0 0.25rem 0.5rem color-mix(var(--contrast) 25%, transparent);
    translate: 0 calc(-100% - 0.5rem);
    visibility: hidden;
    transition:
      translate var(--duration-fast) var(--ease-standard),
      visibility 0s var(--duration-fast);

    &.is-visible {
      translate: 0 0;
      visibility: visible;
      transition-delay: 0s;
    }
  }
  .category-tab {
    flex: 1 0 auto;
    min-block-size: 2.75rem;
    padding: 0.4rem 0.25rem;
    border-radius: calc(var(--radius-control) - 0.25rem);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    white-space: nowrap;

    &[aria-pressed="true"] {
      background: var(--card);
      color: var(--foreground);
    }
  }
  .tab-highlight {
    display: none;
  }
  @supports (anchor-name: --active-category) and (anchor-scope: --active-category) {
    .categories {
      position: relative;
      isolation: isolate;
    }
    .categories,
    .swipe-tabs {
      anchor-scope: --active-category;
    }
    .category-tab {
      position: relative;
      z-index: 1;

      &[aria-pressed="true"] {
        anchor-name: --active-category;
        background: transparent;
      }
    }
    .tab-highlight {
      position: absolute;
      position-anchor: --active-category;
      inset-block-start: anchor(--active-category top);
      inset-block-end: anchor(--active-category bottom);
      inset-inline-start: anchor(--active-category left);
      inset-inline-end: anchor(--active-category right);
      display: block;
      border-radius: calc(var(--radius-control) - 0.25rem);
      background: var(--card);
      transition:
        inset-block-start var(--duration-fast) var(--ease-standard),
        inset-block-end var(--duration-fast) var(--ease-standard),
        inset-inline-start var(--duration-fast) var(--ease-standard),
        inset-inline-end var(--duration-fast) var(--ease-standard);
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
    grid-row: 2;
    grid-column: 1 / -1;
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
  .bundle-price {
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .bundle-price strong {
    color: var(--accent-green);
  }
  .catalog-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    margin-block: 0.75rem;
    gap: 0.5rem;
  }
  .search {
    margin-inline-end: auto;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .search-controls {
    display: grid;
    gap: 0.25rem;
  }
  .search-heading,
  .search-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .search-heading {
    row-gap: 0.25rem;
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
  .more-chevron,
  .card-chevron {
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
  .more-chevron,
  .card-chevron {
    transition: rotate var(--duration-fast) var(--ease-standard);
  }
  .tag-heading[aria-expanded="true"] .tag-chevron,
  .more-tags[open] .more-chevron,
  .card-heading[aria-expanded="true"] .card-chevron {
    rotate: 180deg;
  }
  .tag-body {
    display: grid;
    padding: 0.75rem;
    gap: 0.75rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--panel);

    &[hidden] {
      display: none;
    }
  }
  .tag-body p {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
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
    transform-origin: bottom;
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
  .search-command {
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
    content-visibility: auto;
    contain-intrinsic-block-size: auto calc(var(--size-card-placeholder) + var(--size-card-collapsed));
    container-type: inline-size;
    overflow: hidden;
    border-radius: var(--radius-card);
    background: var(--card);
    &.is-collapsed {
      contain-intrinsic-block-size: var(--size-card-collapsed);
    }
  }
  h2 {
    display: flex;
    background: var(--panel);
  }
  .card-heading {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    min-inline-size: 0;
    padding: var(--space-card);
    gap: 0.5rem;
    background: var(--panel);
    text-align: start;
  }
  .card-title {
    display: block;
    overflow: hidden;
    font: var(--font-semibold) calc(var(--text-card-title) * 0.92) / var(--line-height-snug) var(--font-display);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-meta {
    display: grid;
    margin-block-start: 0.15rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .card-meta > span {
    grid-area: 1 / 1;
    &.inactive {
      visibility: hidden;
    }
  }
  .clear-feedback {
    color: var(--accent-green);
  }
  .hold-hint {
    color: var(--accent-red);
  }
  .card-body {
    padding: var(--space-card);
    &.pending {
      min-block-size: var(--size-card-placeholder);
    }
    &[hidden] {
      display: none;
    }
  }
  .card-label {
    flex: 1;
    min-inline-size: 0;
  }
  .ownership {
    position: relative;
    padding-inline: var(--space-card);
    border-inline-start: 1px solid color-mix(var(--foreground) 3%, transparent);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }
  .ownership-label {
    display: inline-block;
    padding: 0.2rem 0.45rem;
    border: var(--border-width) solid var(--accent);
    border-radius: var(--radius-control);
    background: var(--accent);
    color: var(--foreground);
    opacity: 0.05;
    transition: opacity var(--duration-fast) var(--ease-standard);
  }
  .ownership[aria-pressed="true"] .ownership-label {
    opacity: 1;
  }
  .ownership:disabled .ownership-label {
    opacity: 0;
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
  }
  .shop {
    display: inline-flex;
    align-items: center;
    padding-inline: 0.25rem;
    border-radius: var(--radius-control);
    font-size: var(--text-lg);
    line-height: var(--size-edition-control);
    white-space: nowrap;
    &.unavailable {
      --accent: var(--accent-red);
    }
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
    & strong {
      white-space: nowrap;
    }
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
  .included-price {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
  input,
  .edition {
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard),
      border-color var(--duration-fast) var(--ease-standard);
  }
  @media (hover: hover) {
    .ownership[aria-pressed="false"]:not(:disabled):hover .ownership-label {
      opacity: 0.5;
    }
    button:not(:disabled, .wish, .cloud-tag, .search-command, .edition-label):hover,
    summary:hover,
    .edition:has(.edition-label:hover, .own:hover) {
      background: color-mix(var(--accent) 14%, var(--panel));
      color: var(--accent);
    }
    .search-command:not(:disabled):hover {
      color: var(--accent);
    }
    .active-tag:not(:disabled):hover,
    input:is([type="search"], [type="number"]):not(:disabled):hover {
      border-color: var(--accent);
    }
    .tag-heading:hover :is(.tag-icon, .tag-chevron),
    .card-heading:hover .card-chevron,
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
      z-index: 1;
      scale: 1.25;
      background: color-mix(var(--accent) 14%, var(--panel));
      box-shadow: 0 0.5rem 1rem color-mix(var(--contrast) 25%, transparent);
      color: var(--accent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tab-highlight {
      transition: none;
    }
    .swipe-tabs {
      transition: none;
    }
    .catalog-content {
      translate: none;
      transition: none;
    }
    button,
    a,
    summary,
    input,
    .edition,
    .ownership-label,
    .tag-chevron,
    .more-chevron,
    .card-chevron {
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
  @container (max-width: 24rem) {
    .edition-label {
      grid-template-columns: minmax(0, 1fr) var(--size-icon-control);
      min-inline-size: 0;
      gap: 0.15rem 0.25rem;
    }
    .edition-name {
      flex-wrap: nowrap;
      overflow: hidden;
    }
    .edition-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .edition-date {
      grid-row: 2;
      grid-column: 1 / -1;
      white-space: nowrap;
    }
    .gameplay-icon {
      grid-row: 1;
      grid-column: 2;
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
      grid-row: auto;
      grid-column: auto;
    }
  }
</style>
