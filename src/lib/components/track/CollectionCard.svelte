<script module lang="ts">
  import type { reviewEntries } from "#lib/catalog-view.ts";
  import type { Edition } from "#lib/types/index.ts";
  import type { Attachment } from "svelte/attachments";

  type Entry = ReturnType<typeof reviewEntries>[number];
  const ownershipMessages = {
    cleared: "Ownership cleared",
    owned: "All editions owned",
    hint: "Hold to clear ownership",
  };
  type OwnershipKind = keyof typeof ownershipMessages;
  const ownershipFeedbackDuration = 5000;
  const shopStates = {
    "in-stock": { icon: "i-material-symbols:arrow-outward", description: "In stock" },
    "out-of-stock": { icon: "i-material-symbols:do-not-disturb-on", description: "Out of stock" },
    missing: { icon: "i-material-symbols:link-off", description: "Listing missing" },
    unknown: { icon: "i-material-symbols:arrow-outward", description: "Stock unknown" },
  };

  type Props = {
    item: Entry;
    ready: boolean;
    collapsed: boolean;
    selectedTags: string[];
    observe: Attachment<HTMLElement>;
    onToggle: () => void;
    onHold: () => string;
    onTagClick: (tag: string) => void;
  };
</script>

<script lang="ts">
  import TagRail from "#lib/components/track/TagRail.svelte";
  import KdIcon from "#lib/components/KdIcon.svelte";
  import HoldRipple from "#lib/components/gestures/HoldRipple.svelte";
  import {
    reviewShopLink,
    reviewEditions,
    reviewEditionReleased,
    reviewPrice,
    reviewTagLabel,
    reviewBadges,
    reviewIncludedEditionLabel,
    reviewRequirements,
  } from "#lib/catalog-view.ts";
  import { editionGameplay, editionMaterials, formatPrice } from "#lib/kdm-data.ts";
  import { onDestroy } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { getCollection } from "#lib/state/collection.svelte.ts";
  import { getDatePreferences } from "#lib/state/date-preferences.svelte.ts";
  import { getCollectionActions, ownershipMessage, wishMessage, includedMessage } from "#lib/state/collection-actions.ts";
  import { getCopyNumberEdits } from "#lib/state/copy-number-edits.svelte.ts";
  import { collectionKey, copyNumberMaximum } from "#lib/types/collection.ts";

  let { item, ready, collapsed, selectedTags, observe, onToggle, onHold, onTagClick }: Props = $props();

  const collection = getCollection();
  const dates = getDatePreferences();

  function release(edition: Edition) {
    return edition.releaseDate ? dates.formatDate(edition.releaseDate) : (edition.releaseWindow ?? "date unknown");
  }
  const collectionActions = getCollectionActions();
  const copies = getCopyNumberEdits();
  const catalog = collection.catalog;
  const writable = $derived(collection.canWrite);
  let inspected = $state<string>();
  let contentsOpen = $state(false);
  const animatingEditions = new SvelteSet<string>();
  let feedback = $state<OwnershipKind>();
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    clearTimeout(feedbackTimer);
    copies.flush(item.id);
  });
  const editions = $derived(
    reviewEditions(item).filter(
      (edition) => !edition.includedOnly || selection(edition).owned || collection.coverage.edition(item.id, edition.id).available,
    ),
  );
  const selected = $derived(
    editions.find((edition) => edition.id === inspected) ??
      editions.findLast((edition) => selection(edition).owned) ??
      editions.findLast((edition) => !edition.includedOnly && reviewEditionReleased(edition)) ??
      editions.findLast((edition) => !edition.includedOnly) ??
      editions.at(-1),
  );
  const badges = $derived(reviewBadges(item));
  const requirements = $derived(reviewRequirements(item, catalog.byId));
  const numberedEditions = $derived(editions.filter((edition) => edition.numbered === true && selection(edition).owned));
  const hasOwned = $derived(editions.some((edition) => selection(edition).owned));
  const hasPartial = $derived(!hasOwned && editions.some((edition) => includedOwnership(edition).exactCount > 0));

  function selection(edition: Edition) {
    return collection.getEdition(item.id, edition.id);
  }
  function updateProgressAnimation(event: TransitionEvent, editionId: string) {
    if (event.target !== event.currentTarget || event.propertyName !== "--ownership-progress") return;
    if (event.type === "transitionrun") animatingEditions.add(editionId);
    else animatingEditions.delete(editionId);
  }
  function includedOwnership(edition: Edition, target = item) {
    return collection.coverage.contents(target.id, edition.id);
  }
  function showOwnershipFeedback(kind: OwnershipKind) {
    clearTimeout(feedbackTimer);
    feedback = kind;
    feedbackTimer = setTimeout(() => (feedback = undefined), ownershipFeedbackDuration);
  }
  function tapOwnership() {
    if (!writable) return;
    const previouslyOwned = hasOwned;
    if (selected && !selection(selected).owned) toggleOwned(selected);
    if (previouslyOwned) showOwnershipFeedback("hint");
  }
  function holdOwnership() {
    if (!writable) return "Collection changes are unavailable until your collection is loaded.";
    const owned = !hasOwned;
    const targets = editions.filter((edition) => owned || selection(edition).owned).map((edition) => ({ item, edition }));
    collectionActions.run(collection.setEditionsOwned(targets, owned), { success: ownershipMessage(targets, owned) });
    showOwnershipFeedback(owned ? "owned" : "cleared");
    return `${item.name}, all editions marked ${owned ? "owned" : "not owned"}.`;
  }
  function selectEdition(edition: Edition) {
    if (selected?.id === edition.id) toggleOwned(edition);
    else inspected = edition.id;
  }
  function toggleOwned(edition: Edition, target = item, owned?: boolean) {
    if (!writable) return;
    if (target.id === item.id) inspected = edition.id;
    clearTimeout(feedbackTimer);
    feedback = undefined;
    const shouldOwn = owned ?? !collection.getEdition(target.id, edition.id).owned;
    collectionActions.run(collection.toggleEditionOwned(collectionKey(target.id, edition.id), shouldOwn), {
      success: ownershipMessage([{ item: target, edition }], shouldOwn),
    });
  }
  function toggleWish(edition: Edition, target = item) {
    if (!writable) return;
    const entry = collection.getEdition(target.id, edition.id);
    const wished = !entry.owned && !entry.wished;
    collectionActions.run(collection.toggleWish(collectionKey(target.id, edition.id)), {
      success: wishMessage({ item: target, edition }, wished),
    });
  }
  function toggleIncludedOwned(edition: Edition, target: Entry, owned?: boolean) {
    if (!writable) return;
    const shouldOwn = owned ?? !collection.coverage.edition(target.id, edition.id).available;
    const restoring = collection.getEdition(target.id, edition.id).missing;
    collectionActions.run(collection.toggleIncludedOwned(collectionKey(target.id, edition.id), shouldOwn), {
      success: includedMessage({ item: target, edition }, shouldOwn, restoring),
    });
  }
</script>

<article class={[badges.beta && !badges.gameplay && "beta-only", collapsed && "is-collapsed"]} {@attach observe}>
  <h2>
    <HoldRipple
      ontap={tapOwnership}
      onhold={holdOwnership}
      holdHint={hasOwned
        ? "Click to own the selected edition. Hold or press Shift+Enter to remove ownership from all editions of this item."
        : "Click to own the selected edition. Hold or press Shift+Enter to own all editions of this item."}
    >
      {#snippet children(events, paint)}
        <button
          class="ownership"
          type="button"
          aria-label="Ownership of {item.name}"
          aria-pressed={hasOwned}
          disabled={!writable || (!hasOwned && !selected)}
          {...events}
        >
          {@render paint()}
          <span class="card-label">
            <span class="card-title">{item.name}</span>
            <span class={["card-meta", feedback && (feedback === "hint" ? "hold-hint" : "ownership-feedback")]}>
              {#if feedback}
                {ownershipMessages[feedback]}
              {:else}
                {item.category === "bundles" ? "bundle" : (item.category === "accessories" && item.accessoryType) || item.kind || "item"}
                {#if editions.length > 1}
                  / {editions.length} versions
                {/if}
              {/if}
            </span>
          </span>
          <span class={["ownership-label", hasPartial && "partial"]}>{hasPartial ? "Partial" : "Owned"}</span>
        </button>
      {/snippet}
    </HoldRipple>
    <HoldRipple
      ontap={onToggle}
      onhold={onHold}
      holdHint="Click to collapse or expand this card. Hold or press Shift+Enter to collapse or expand all cards across every category."
    >
      {#snippet children(events, paint)}
        <button
          class="card-heading"
          type="button"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${item.name}`}
          aria-expanded={!collapsed}
          aria-controls={`card-body-${item.id}`}
          {...events}
        >
          {@render paint()}
          <span class="card-chevron control-icon i-material-symbols:expand-more" aria-hidden="true"></span>
        </button>
      {/snippet}
    </HoldRipple>
  </h2>
  <div class={["card-body", !ready && "pending"]} id={`card-body-${item.id}`} hidden={collapsed}>
    {#if ready}
      {#if selected}
        <div class="edition-details">
          {#each editions as summaryEdition (summaryEdition.id)}
            {@const active = selected.id === summaryEdition.id}
            {@const price = reviewPrice(item, summaryEdition)}
            {@const bundle = catalog.bundlePricing(item.id, summaryEdition.id, collection.state)}
            <div class={["edition-summary", !active && "inactive"]} inert={!active}>
              {#if !summaryEdition.includedOnly}
                <div class="edition-value">
                  <strong class="price">{price === undefined ? "Price unknown" : formatPrice(price, item.currency)}</strong>
                  <span class="caption">for {summaryEdition.label}</span>
                </div>
              {/if}
              <div class="badges">
                {#if item.category === "accessories"}
                  {#if item.accessoryType}{@render badge(item.accessoryType, item.accessoryType)}{/if}
                {:else if badges.gameplay}
                  {@render badge("gameplay", "Gameplay", "gameplay")}
                {:else if !badges.beta}
                  <span class="badge">{item.category === "homebrew" && item.kind === "accessory" ? "other" : "Models only"}</span>
                {/if}
                {#if badges.beta}{@render badge("beta", "Beta", "beta")}{/if}
              </div>
              {#if bundle}
                <p class="bundle-price">
                  Items separately: {formatPrice(bundle.total, item.currency)}
                  {#if bundle.savings !== undefined && bundle.savings > 0}
                    <strong>Save {formatPrice(bundle.savings, item.currency)} ({bundle.percent}%)</strong>
                  {/if}
                </p>
              {/if}
            </div>
          {/each}
        </div>
        <div class="editions">
          {#each editions as releaseEdition (releaseEdition.id)}
            {@render editionRow(releaseEdition, selected.id === releaseEdition.id)}
          {/each}
        </div>
        {#if numberedEditions.length}
          <div class="copies">
            {#each numberedEditions as numberedEdition (numberedEdition.id)}
              {@const value = selection(numberedEdition)}
              <label class="copy">
                <span>{numberedEdition.label} #</span>
                <input
                  type="number"
                  min="1"
                  max={Math.min(numberedEdition.runSize ?? copyNumberMaximum, copyNumberMaximum)}
                  disabled={!writable}
                  value={copies.value(item.id, numberedEdition.id) ?? value.copyNumber ?? ""}
                  oninput={(event) => copies.update({ item, edition: numberedEdition }, event.currentTarget)}
                  onblur={() => copies.flush(item.id, numberedEdition.id)}
                  onkeydown={(event) => copies.keydown(item.id, numberedEdition.id, event)}
                  placeholder="13"
                  aria-describedby={numberedEdition.runSize ? `run-${item.id}-${numberedEdition.id}` : undefined}
                />
                {#if numberedEdition.runSize}<span>of {numberedEdition.runSize}</span>{/if}
              </label>
            {/each}
          </div>
        {/if}
        <div class="edition-details">
          {#each editions as detailEdition (detailEdition.id)}
            {@const active = selected.id === detailEdition.id}
            <div class={["edition-detail", !active && "inactive"]} inert={!active}>
              {@render editionDetail(detailEdition)}
            </div>
          {/each}
        </div>
      {:else}<p class="included-note">No selectable editions are recorded yet.</p>{/if}
      <TagRail
        tagLabel={reviewTagLabel}
        tags={item.tags}
        {selectedTags}
        label={`${item.name} tags`}
        {onTagClick}
        --tag-rail-padding="0.25rem"
        --tag-padding="0.25rem 0.375rem"
        --tag-color="var(--muted-foreground)"
        --tag-font-size="var(--text-sm)"
      />
      {#if item.notes || item.aliases?.length || item.gameplayContent}
        <details class="notes">
          <summary>{item.aliases?.length ? "Notes & other names" : "Notes"}</summary>
          {#if item.notes}<p>{item.notes}</p>{/if}
          {#if item.gameplayContent}<p>{item.gameplayContent}</p>{/if}
          {#if item.aliases?.length}<p>Also known as: {item.aliases.join(", ")}</p>{/if}
        </details>
      {/if}
      {#if requirements.length}
        <div class="requirements">
          <KdIcon i="require" />
          <p><span class="visually-hidden">Requires: </span>{requirements.map((required) => required.name).join(", ")}</p>
        </div>
      {/if}
    {/if}
  </div>
</article>

{#snippet badge(tag: string, label: string, variant?: "beta" | "gameplay")}
  <button class={["badge", variant]} type="button" aria-pressed={selectedTags.includes(tag)} onclick={() => onTagClick(tag)}>
    {label}
  </button>
{/snippet}

{#snippet editionDetail(edition: Edition)}
  {@const { children, exactCount } = includedOwnership(edition)}
  {#if children.length}
    <details class="contents" bind:open={contentsOpen}>
      <summary>
        {edition.label} includes
        <span class="contents-count">
          {exactCount} of {children.length} owned
        </span>
      </summary>
      {#if edition.includesAllSim}
        <p>Includes every current and future Sim edition. This shows the editions currently in the catalog.</p>
      {/if}
      {#if contentsOpen && selected?.id === edition.id}
        <ul>
          {#each children as child (collectionKey(child.item.id, child.edition.id))}
            {@const price = reviewPrice(child.item, child.edition)}
            {@const name = child.name === child.item.name ? child.name : `${child.name}, ${child.item.name}`}
            {@const label = reviewIncludedEditionLabel(item, child.edition)}
            {@const value = collection.getEdition(child.item.id, child.edition.id)}
            <li class="included-row">
              <label class="own">
                <input
                  type="checkbox"
                  aria-label={child.status.available ? `Mark ${name}, ${label} missing` : `Have ${name}, ${label}`}
                  checked={child.exactOwned}
                  disabled={!writable}
                  aria-describedby={child.owned && !child.exactOwned
                    ? `other-owned-${item.id}-${edition.id}-${child.item.id}-${child.edition.id}`
                    : undefined}
                  onchange={(event) => toggleIncludedOwned(child.edition, child.item, event.currentTarget.checked)}
                />
              </label>
              <button
                class="edition-label"
                type="button"
                aria-label={child.status.available ? `Mark ${name}, ${label} missing` : `Have ${name}, ${label}`}
                aria-pressed={child.exactOwned}
                disabled={!writable}
                onclick={() => toggleIncludedOwned(child.edition, child.item)}
              >
                <span>{child.name} <small>{label}</small></span>
                {#if child.owned && !child.exactOwned}
                  <span class="included-owned" id={`other-owned-${item.id}-${edition.id}-${child.item.id}-${child.edition.id}`}>
                    Owned: {[...new Set(child.ownedEditions.map((edition) => reviewIncludedEditionLabel(item, edition)))].join(", ")}
                  </span>
                {:else if child.status.source === "upgrade"}
                  <span class="included-owned">
                    Upgraded with {child.status.via
                      .filter(({ item }) => item.id !== child.item.id)
                      .map(({ item }) => item.name)
                      .join(", ")}
                  </span>
                {/if}
              </button>
              {#if !child.edition.includedOnly && price !== 0}
                <span class="included-price">{price === undefined ? "Price unknown" : formatPrice(price, child.item.currency)}</span>
              {/if}
              <button
                class="wish"
                type="button"
                aria-label="Wishlist {child.item.name}, {child.edition.label}"
                aria-pressed={!!value.wished}
                disabled={!writable || !!value.owned}
                onclick={() => toggleWish(child.edition, child.item)}
              >
                <span
                  class={["wish-icon", value.wished ? "i-material-symbols:favorite" : "i-material-symbols:favorite-outline"]}
                  aria-hidden="true"
                ></span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </details>
  {/if}
{/snippet}

{#snippet shopLink(edition: Edition)}
  {@const shop = reviewShopLink(item, edition)}
  {#if shop}
    <a class="shop" data-state={shop.state} href={shop.url} target="_blank" rel="noreferrer" title={shopStates[shop.state].description}>
      {shop.url.startsWith("https://docs.google.com/spreadsheets/") ? "Link" : "Shop"}<span
        class={["external-icon", shopStates[shop.state].icon]}
        aria-hidden="true"
      ></span>
      <span class="visually-hidden">{item.name}, {edition.label}, {shopStates[shop.state].description}</span>
    </a>
  {/if}
{/snippet}

{#snippet editionRow(edition: Edition, active: boolean)}
  {@const value = selection(edition)}
  {@const ownership = includedOwnership(edition)}
  {@const hasContents = ownership.children.length > 0}
  {@const gameplay = editionGameplay(item, edition)}
  {@const price = reviewPrice(item, edition)}
  {@const detail = [...new Set([edition.name, ...(edition.format === "digital" ? ["Digital"] : editionMaterials(edition))])]
    .filter((part) => part && !edition.label.toLowerCase().includes(part.toLowerCase()))
    .join(", ")}
  <div
    class={["edition", active && "inspected", hasContents && "contents-progress", animatingEditions.has(edition.id) && "is-animating"]}
    style:--ownership-progress={hasContents ? `${(ownership.exactCount / ownership.children.length) * 100}%` : undefined}
    ontransitionrun={(event) => updateProgressAnimation(event, edition.id)}
    ontransitionend={(event) => updateProgressAnimation(event, edition.id)}
    ontransitioncancel={(event) => updateProgressAnimation(event, edition.id)}
  >
    <label class="own">
      <input
        type="checkbox"
        aria-label={value.owned ? `Remove ownership of ${item.name}, ${edition.label}` : `Have ${item.name}, ${edition.label}`}
        checked={!!value.owned}
        aria-describedby={hasContents ? `ownership-${item.id}-${edition.id}` : undefined}
        disabled={!writable}
        onchange={(event) => toggleOwned(edition, item, event.currentTarget.checked)}
      />
      {#if hasContents}
        <span class="visually-hidden" id={`ownership-${item.id}-${edition.id}`}>
          {ownership.exactCount} of {ownership.children.length} included items owned.
        </span>
      {/if}
    </label>
    <button
      class="edition-label"
      type="button"
      aria-pressed={active}
      aria-label="View {item.name}, {edition.label}{gameplay ? (edition.beta ? ', includes beta gameplay' : ', includes gameplay') : ''}"
      onclick={() => selectEdition(edition)}
    >
      <span class="edition-name">
        <strong class="edition-title">{edition.label}</strong>
        {#if detail}<span class="edition-meta">{detail}</span>{/if}
      </span>
    </button>
    <div class="edition-release">
      {#if edition.runSize}
        <small class="run" id={`run-${item.id}-${edition.id}`}>Run of {edition.runSize}</small>
      {/if}
      <small class="edition-date">{release(edition)}</small>
    </div>
    {@render shopLink(edition)}
    {#if gameplay}
      <span
        class={["gameplay-icon", "i-material-symbols:sports-esports", edition.beta && "beta"]}
        title={edition.beta ? "Beta" : "Gameplay"}
        aria-hidden="true"
      ></span>
    {/if}
    <div class="edition-price">
      {#if edition.includedOnly}
        <small>Included only</small>
      {:else if price !== 0}
        {price === undefined ? "Unknown" : formatPrice(price, item.currency)}
      {/if}
    </div>
    <button
      class="wish"
      type="button"
      aria-pressed={!!value.wished}
      aria-label="Wishlist {item.name}, {edition.label}"
      disabled={!writable || !!value.owned}
      onclick={() => toggleWish(edition)}
    >
      <span class={["wish-icon", value.wished ? "i-material-symbols:favorite" : "i-material-symbols:favorite-outline"]} aria-hidden="true"
      ></span>
    </button>
  </div>
{/snippet}

<style>
  @property --ownership-progress {
    syntax: "<percentage>";
    inherits: false;
    initial-value: 0%;
  }
  @property --ownership-progress-color {
    syntax: "<color>";
    inherits: false;
    initial-value: oklch(40% 0 0);
  }

  .shop,
  .price {
    color: var(--accent);
  }
  .caption,
  .card-meta,
  .edition-meta,
  .copy,
  .included-note,
  .bundle-price {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  small,
  .contents-count,
  .notes p {
    color: var(--muted-foreground);
  }
  .bundle-price,
  .price,
  .edition-release,
  .edition-price,
  .included-price {
    font-variant-numeric: tabular-nums;
  }
  .card-body,
  .edition-detail {
    display: grid;
    gap: 0.5rem;
  }
  .card-chevron {
    color: var(--muted-foreground);
    transition: rotate var(--duration-fast) var(--ease-standard);
  }
  .card-heading[aria-expanded="true"] .card-chevron {
    rotate: 180deg;
  }
  input[type="number"] {
    inline-size: 100%;
    padding: 0.5rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--card);
  }
  .bundle-price {
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
  }
  .bundle-price strong {
    color: var(--accent-green);
  }
  article {
    --space-card: 0.75rem;
    --space-edition-control: 0.25rem;
    --gap-edition: 0.5rem;
    --size-edition-control: 1.5rem;
    --size-card-placeholder: 14rem;
    --size-card-collapsed: 4.5rem;

    contain-intrinsic-block-size: auto calc(var(--size-card-placeholder) + var(--size-card-collapsed));
    container-type: inline-size;
    content-visibility: auto;
    overflow: hidden;
    border-radius: var(--radius-card);
    background: var(--card);
    &.beta-only {
      border-radius: 0;
    }
    &.is-collapsed {
      /* Lay out the lightweight headers at their real heights for scroll anchoring. */
      content-visibility: visible;
    }
  }
  h2 {
    display: flex;
    background: var(--panel);
  }
  .card-heading {
    display: grid;
    position: relative;
    flex-shrink: 0;
    place-items: center;
    padding: var(--space-card);
    border-inline-start: 1px solid color-mix(var(--foreground) 3%, transparent);
  }
  .card-title,
  .card-meta {
    display: block;
  }
  .card-meta {
    margin-block-start: 0.125rem;
    line-height: var(--line-height-none);
  }
  .card-title {
    font: var(--font-semibold) 1rem / var(--line-height-none) var(--font-display);
  }
  .ownership-feedback {
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
    display: flex;
    position: relative;
    flex: 1;
    align-items: center;
    min-inline-size: 0;
    padding: var(--space-card);
    gap: 0.5rem;
    text-align: start;
  }
  .ownership-label {
    display: inline-block;
    flex-shrink: 0;
    padding: 0.25rem 0.5rem;
    border: var(--border-width) solid var(--accent);
    border-radius: var(--radius-control);
    background: var(--accent);
    color: var(--foreground);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    opacity: 0.05;
    transition: opacity var(--duration-fast) var(--ease-standard);
  }
  .ownership[aria-pressed="true"] .ownership-label,
  .ownership-label.partial {
    opacity: 1;
  }
  .ownership:disabled .ownership-label {
    opacity: 0;
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
  .price {
    font-size: var(--text-lg);
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }
  .badge {
    --badge-fill: var(--grey-7);

    padding: 0.25rem 0.5rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);

    &[aria-pressed="true"] {
      background: var(--badge-fill);
    }

    &:focus-visible {
      outline: var(--border-width) solid currentColor;
      outline-offset: 3px;
    }

    &.beta {
      --badge-fill: var(--blue-8);

      border-radius: 0;
      border-color: var(--accent);
      color: var(--accent);
    }

    &.gameplay {
      --badge-fill: var(--green-8);

      border-color: var(--accent-green);
      color: var(--accent-green);
    }
  }
  .shop,
  .wish {
    /* Extend padded hit areas into the gap without moving their visible contents. */
    margin-inline-start: calc(-1 * var(--space-edition-control));
    padding-inline: var(--space-edition-control);
  }
  .shop {
    --accent: var(--accent-blue);

    display: inline-flex;
    grid-column: 3;
    align-items: center;
    align-self: stretch;
    justify-self: center;
    margin-inline-end: calc(-1 * var(--space-edition-control));
    font-size: var(--text-md);
    line-height: var(--size-edition-control);
    white-space: nowrap;
    &:is([data-state="out-of-stock"], [data-state="missing"]) {
      gap: 0.125rem;
    }

    &:is([data-state="out-of-stock"], [data-state="unknown"]) {
      --accent: var(--muted-foreground);
    }

    &[data-state="missing"] {
      --accent: var(--red-3);
    }
  }
  .shop:is([data-state="out-of-stock"], [data-state="missing"]) .external-icon {
    --size-icon: calc(var(--size-external) - 0.125rem);
  }
  .editions {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr) max-content max-content auto max-content;
  }
  .edition,
  .included-row {
    display: grid;
    position: relative;
    grid-template-rows: auto auto;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    align-items: center;
    gap: 0 var(--gap-edition);
    border-block-end: var(--border-width) solid var(--grey-8);
    background-clip: padding-box;

    &.inspected {
      background-color: var(--panel);
    }
  }
  .edition > :is(.edition-label, .shop, .gameplay-icon, .edition-price) {
    grid-row: 1;
  }
  .edition.contents-progress {
    --ownership-progress-color: var(--grey-7);

    border-image: linear-gradient(to left, var(--ownership-progress-color) var(--ownership-progress), var(--grey-8) 0) 1;
    transition:
      var(--transition-colors),
      --ownership-progress-color var(--duration-fast) var(--ease-standard),
      --ownership-progress var(--duration-medium) var(--ease-standard);

    &.is-animating {
      --ownership-progress-color: var(--grey-4);
    }
  }
  .edition:not(:has(.run)) > .edition-label {
    grid-row: 1 / -1;
  }
  :is(.edition, .included-row) > :is(.own, .shop, .wish) {
    /* Keep the independent controls above the edition button's row-wide hit area. */
    z-index: 1;
  }
  .own,
  .wish {
    display: grid;
    grid-row: 1 / -1;
    place-items: center;
    align-self: stretch;
    min-block-size: var(--size-edition-control);
    cursor: pointer;
  }
  .own {
    grid-column: 1;
    padding-inline: 0.125rem;
    border-radius: var(--radius-control);

    &:has(input:disabled) {
      cursor: default;
    }
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
    opacity: 0.5;

    &:is(:hover:not(:disabled), :focus-visible, :checked) {
      opacity: 1;
    }

    &:checked {
      background:
        linear-gradient(var(--foreground) 0 0) content-box,
        var(--contrast);
    }
    &:disabled {
      cursor: default;
    }
  }
  .edition-label {
    display: grid;
    grid-column: 2;
    align-items: center;
    min-inline-size: 0;
    min-block-size: var(--size-edition-control);
    padding-block: 0.25rem;
    border-radius: var(--radius-control);
    font-size: var(--text-md);
    line-height: var(--line-height-snug);
    text-align: start;

    &::after {
      position: absolute;
      inset: 0;
      content: "";
      cursor: inherit;
    }
  }
  .edition-name {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.125rem 0.5rem;
    overflow-wrap: anywhere;
  }
  .edition-meta {
    text-transform: lowercase;
  }
  .edition-release {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-row: 2;
    grid-column: 2 / -2;
    align-items: baseline;
    padding-block-end: 0.25rem;
    gap: var(--gap-edition);
    font-size: var(--text-sm);
    line-height: 1;
    white-space: nowrap;
  }
  .edition-release small {
    font-size: inherit;
  }
  .edition-date {
    grid-column: 2;
  }
  .gameplay-icon,
  .wish-icon {
    --size-icon: 1.25rem;
  }
  .gameplay-icon {
    grid-column: 4;
    justify-self: center;
    color: var(--accent-green);
    /* Let clicks reach the edition button's row-wide hit area beneath the masked icon. */
    pointer-events: none;
    &.beta {
      color: var(--accent-blue);
    }
  }
  .edition-price {
    grid-column: 5;
    font-size: var(--text-md);
    text-align: end;
  }
  .edition-price small {
    display: block;
    font-size: var(--text-sm);
  }
  .wish {
    --accent: var(--accent-red);
    grid-column: 6;
    &:disabled {
      visibility: hidden;
    }
  }
  .wish-icon {
    color: var(--accent-red);
    transition:
      scale var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);
  }
  .copies {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
  }
  .copy {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }
  .copy input {
    flex-shrink: 0;
    inline-size: 5rem;
    padding: 0.375rem;
    color: var(--foreground);
  }
  .contents,
  .notes {
    font-size: var(--text-sm);
  }
  summary {
    padding: 0.25rem;
    cursor: pointer;
  }
  .contents-count {
    float: inline-end;
  }
  .contents ul {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr) max-content max-content;
    margin-block-start: 0.5rem;
  }
  .included-price {
    grid-column: 3;
    text-align: end;
    white-space: nowrap;
  }
  .included-row {
    grid-template-rows: auto;
  }
  .included-row .edition-label {
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    align-items: baseline;
    gap: 0.125rem 0.5rem;
  }
  .included-row .wish {
    grid-column: 4;
  }
  .included-owned {
    color: var(--accent-green);
    font-size: var(--text-sm);
  }
  .notes p {
    margin-block-start: 0.5rem;
    white-space: pre-line;
  }
  .requirements {
    display: flex;
    align-items: start;
    gap: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-lg);
  }
  .requirements p {
    font-size: var(--text-sm);
  }

  button:disabled,
  input:disabled {
    cursor: default;
    opacity: 0.4;
  }
  .ownership:disabled {
    opacity: 1;
  }
  button,
  a,
  summary,
  input,
  .edition,
  .included-row {
    transition: var(--transition-colors);
  }
  @media (hover: hover) {
    .ownership:not(:disabled):hover,
    .card-heading:hover,
    .ownership:not(:disabled):hover .ownership-label {
      transition-duration: 0s;
    }
    button.badge:hover {
      background: var(--badge-fill);
    }
    .ownership[aria-pressed="false"]:not(:disabled):hover .ownership-label:not(.partial) {
      opacity: 0.5;
    }
    button:not(:disabled, .wish, .edition-label, .badge):hover,
    summary:hover,
    .edition:hover,
    .included-row:hover {
      background: var(--blue-8);
      color: var(--accent);
    }
    input[type="number"]:not(:disabled):hover {
      border-color: var(--accent);
    }
    .card-heading:hover .card-chevron,
    summary:hover .contents-count {
      color: var(--accent);
    }
    .wish:not(:disabled):hover {
      background: var(--red-8);
      & .wish-icon {
        scale: 1.12;
        color: var(--red-3);
      }
    }
    .shop:hover {
      color: var(--accent);
      text-decoration: underline;
      text-underline-offset: 0.2em;
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
  @container (min-width: 31.5rem) {
    .edition {
      grid-template-rows: auto;
    }
    .editions {
      grid-template-columns: max-content minmax(0, 1fr) repeat(6, max-content);
    }
    .edition-label {
      padding-block: 0.125rem;
    }
    .edition-name {
      display: grid;
      grid-template-columns: minmax(0, max-content) minmax(0, max-content);
    }
    .edition-title,
    .edition-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .edition-release {
      display: contents;
    }
    .edition-release small {
      grid-row: 1;
      padding: 0.125rem 0;
      text-align: right;
    }
    .run {
      grid-column: 3;
    }
    .shop {
      grid-column: 4;
    }
    .gameplay-icon {
      grid-column: 5;
    }
    .edition-date {
      grid-column: 6;
    }
    .edition-date,
    .edition-price {
      line-height: 1;
    }
    .edition-price {
      grid-column: 7;
    }
    .wish {
      grid-column: 8;
    }
  }
</style>
