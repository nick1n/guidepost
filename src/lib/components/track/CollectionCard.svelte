<script module lang="ts">
  import type { reviewEntries, reviewIndex, ReviewEdition } from "#lib/catalog-view.ts";
  import type { Attachment } from "svelte/attachments";

  type Entry = ReturnType<typeof reviewEntries>[number];
  export type Selection = { owned?: boolean; wished?: boolean; copy?: string };
  export type Owner = { parent: string; parentEdition: string; edition?: string };
  const ownershipMessages = {
    cleared: "Ownership cleared",
    owned: "All editions owned",
    hint: "Hold to clear ownership",
    "own-hint": "Hold when unowned to own all editions",
  };
  export type OwnershipKind = keyof typeof ownershipMessages;

  type Props = {
    item: Entry;
    catalog: ReturnType<typeof reviewIndex>;
    ready: boolean;
    collapsed: boolean;
    selected: ReviewEdition | undefined;
    feedback: OwnershipKind | undefined;
    selectedTags: string[];
    contentsOpen: Record<string, boolean>;
    getSelection: (edition: ReviewEdition) => Readonly<Selection>;
    getOwners: (edition: ReviewEdition) => Owner[];
    observe: Attachment<HTMLElement>;
    onToggle: () => void;
    onHold: () => string;
    onOwnership: () => void;
    onHoldOwnership: () => string;
    onEditionSelect: (edition: ReviewEdition) => void;
    onOwnedChange: (edition: ReviewEdition) => void;
    onWishChange: (edition: ReviewEdition) => void;
    onCopyChange: (edition: ReviewEdition, copy: string) => void;
    onTagClick: (tag: string) => void;
  };

  function key(item: Entry, edition: ReviewEdition) {
    return `${item.id}:${edition.v}`;
  }
  function release(edition: ReviewEdition) {
    return edition.r ?? edition.releaseWindow ?? "Date unknown";
  }
</script>

<script lang="ts">
  import TagRail from "#lib/components/track/TagRail.svelte";
  import HoldRipple from "#lib/components/gestures/HoldRipple.svelte";
  import { reviewShopUrl, reviewEditions, reviewNumberedEditions, reviewPrice, reviewTagLabel, reviewBadges } from "#lib/catalog-view.ts";
  import { editionGameplay, editionMaterials, formatPrice } from "#lib/kdm-data.ts";

  let {
    item,
    catalog,
    ready,
    collapsed,
    selected,
    feedback,
    selectedTags,
    contentsOpen = $bindable(),
    getSelection,
    getOwners,
    observe,
    onToggle,
    onHold,
    onOwnership,
    onHoldOwnership,
    onEditionSelect,
    onOwnedChange,
    onWishChange,
    onCopyChange,
    onTagClick,
  }: Props = $props();

  const editions = $derived(reviewEditions(item));
  const badges = $derived(reviewBadges(item));
  const numberedEditions = $derived(reviewNumberedEditions(item).filter((edition) => getSelection(edition).owned));
  const hasOwned = $derived(editions.some((edition) => getSelection(edition).owned));
</script>

<article class={[badges.beta && !badges.gameplay && "beta-only", collapsed && "is-collapsed"]} {@attach observe}>
  <h2>
    <HoldRipple
      ontap={onToggle}
      onhold={onHold}
      holdHint="Click to collapse or expand this card. Hold or press Shift+Enter to collapse or expand all cards across every category."
    >
      {#snippet children(events, paint)}
        <button class="card-heading" type="button" aria-expanded={!collapsed} aria-controls={`card-body-${item.id}`} {...events}>
          {@render paint()}
          <span class="card-label">
            <span class="card-title">{item.name}</span>
            <span class={["card-meta", feedback && (feedback === "hint" ? "hold-hint" : "ownership-feedback")]}>
              {#if feedback}
                {ownershipMessages[feedback]}
              {:else}
                {item.category === "bundles" ? "bundle" : (item.kind ?? "Item")}
                {#if editions.length > 1}
                  &nbsp;/ {editions.length} versions
                {/if}
              {/if}
            </span>
          </span>
          <span class="card-chevron control-icon i-material-symbols:expand-more" aria-hidden="true"></span>
        </button>
      {/snippet}
    </HoldRipple>
    <HoldRipple
      ontap={onOwnership}
      onhold={onHoldOwnership}
      holdHint={hasOwned
        ? "Click to own the selected edition. Hold or press Shift+Enter to remove ownership from all editions of this item."
        : "Click to own the selected edition. Hold or press Shift+Enter to own all editions of this item."}
    >
      {#snippet children(events, paint)}
        <button
          class="ownership"
          type="button"
          aria-label="Owned editions of {item.name}"
          aria-pressed={hasOwned}
          disabled={!hasOwned && (!selected || selected.standalone === false)}
          {...events}
        >
          {@render paint()}
          <span class="ownership-label">Owned</span>
        </button>
      {/snippet}
    </HoldRipple>
  </h2>
  <div class={["card-body", !ready && "pending"]} id={`card-body-${item.id}`} hidden={collapsed}>
    {#if ready}
      {#if selected}
        <div class="edition-details">
          {#each editions as summaryEdition (summaryEdition.v)}
            {@const active = selected.v === summaryEdition.v}
            {@const price = reviewPrice(item, summaryEdition)}
            {@const bundle = catalog.bundlePricing(item.id, summaryEdition.v)}
            <div class={["edition-summary", !active && "inactive"]} inert={!active}>
              <div class="edition-value">
                <strong class="price">{price === undefined ? "Price unknown" : formatPrice(price, item.currency)}</strong>
                <span class="caption">for {summaryEdition.v}</span>
              </div>
              <div class="badges">
                {#if item.category === "accessories"}
                  {#if item.accessoryType}{@render badge(item.accessoryType, item.accessoryType)}{/if}
                {:else if badges.gameplay}
                  {@render badge("gameplay", "Gameplay", "gameplay")}
                {:else if !badges.beta}
                  <span class="badge">Models only</span>
                {/if}
                {#if badges.beta}{@render badge("beta", "Beta", "beta")}{/if}
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
        <div class="editions">
          {#each editions as releaseEdition (releaseEdition.v)}
            {@render editionRow(releaseEdition, selected.v === releaseEdition.v)}
          {/each}
        </div>
        {#if numberedEditions.length}
          <div class="copies">
            {#each numberedEditions as numberedEdition (numberedEdition.v)}
              {@const value = getSelection(numberedEdition)}
              <label class="copy">
                <span>{numberedEdition.v} #</span>
                <input
                  type="number"
                  min="1"
                  max={numberedEdition.runSize ?? 999}
                  disabled={numberedEdition.standalone === false}
                  value={value.copy ?? ""}
                  oninput={(event) => onCopyChange(numberedEdition, event.currentTarget.value)}
                  placeholder="13"
                />
              </label>
            {/each}
          </div>
        {/if}
        <div class="edition-details">
          {#each editions as detailEdition (detailEdition.v)}
            {@const active = selected.v === detailEdition.v}
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
</article>

{#snippet badge(tag: string, label: string, variant?: "beta" | "gameplay")}
  <button class={["badge", variant]} type="button" aria-pressed={selectedTags.includes(tag)} onclick={() => onTagClick(tag)}>{label}</button
  >
{/snippet}

{#snippet editionDetail(edition: ReviewEdition)}
  {@const references = getOwners(edition)}
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
      {#if contentsOpen[key(item, edition)] && selected?.v === edition.v}
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
              <li>
                <span>{child.name}</span>
                <small>{child.edition ?? child.materials?.join(", ") ?? "Edition unspecified"}</small>
              </li>
            {/each}
          {/if}
        </ul>
      {/if}
      {#if !included.length}<p>No inclusions are listed for this edition.</p>{/if}
    </details>
  {/if}
{/snippet}

{#snippet shopLink(edition: ReviewEdition)}
  {@const url = reviewShopUrl(item, edition)}
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

{#snippet editionRow(edition: ReviewEdition, active: boolean)}
  {@const value = getSelection(edition)}
  {@const gameplay = editionGameplay(item, edition)}
  {@const price = reviewPrice(item, edition)}
  {@const detail = edition.v === "Sim" ? "Digital" : editionMaterials(edition).join(", ")}
  <div class={["edition", active && "inspected"]}>
    <label class="own">
      <input
        type="checkbox"
        aria-label="Own {item.name}, {edition.v}"
        checked={!!value.owned}
        disabled={edition.standalone === false}
        onchange={() => onOwnedChange(edition)}
      />
    </label>
    <button
      class="edition-label"
      type="button"
      aria-pressed={active}
      aria-label="View {item.name}, {edition.v}{gameplay ? (edition.beta ? ', includes beta gameplay' : ', includes gameplay') : ''}"
      onclick={() => onEditionSelect(edition)}
    >
      <span class="edition-name">
        <strong class="edition-title">{edition.v}</strong>
        {#if detail && detail !== edition.v}<span class="edition-material">{detail}</span>{/if}
      </span>
      <small class="edition-date">{release(edition)}</small>
    </button>
    {#if gameplay}
      <span
        class={["gameplay-icon", "i-material-symbols:sports-esports", edition.beta && "beta"]}
        title={edition.beta ? "Beta" : "Gameplay"}
        aria-hidden="true"
      ></span>
    {/if}
    {@render shopLink(edition)}
    <div class="edition-price">
      {#if edition.standalone === false}
        <small>Included only</small>
      {:else}
        {price === undefined ? "Unknown" : formatPrice(price, item.currency)}
      {/if}
    </div>
    <button
      class="wish"
      type="button"
      aria-pressed={!!value.wished}
      aria-label="Wishlist {item.name}, {edition.v}"
      disabled={!!value.owned || edition.standalone === false}
      onclick={() => onWishChange(edition)}
    >
      <span class={["wish-icon", value.wished ? "i-material-symbols:favorite" : "i-material-symbols:favorite-outline"]} aria-hidden="true"
      ></span>
    </button>
  </div>
{/snippet}

<style>
  .shop,
  .price {
    color: var(--accent);
  }
  .caption,
  .card-meta,
  .edition-material,
  .run,
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
  .edition-date,
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
    flex-shrink: 0;
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
    display: flex;
    position: relative;
    flex: 1;
    align-items: center;
    min-inline-size: 0;
    padding: var(--space-card);
    text-align: start;
  }
  .card-title,
  .card-meta {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-title {
    font: var(--font-semibold) 1rem / var(--line-height-snug) var(--font-display);
  }
  .card-meta {
    margin-block-start: 0.15rem;
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
    position: relative;
    padding-inline: var(--space-card);
    border-inline-start: 1px solid color-mix(in oklch, var(--foreground) 3%, transparent);
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
    gap: 0.4rem;
  }
  .badge {
    padding: 0.2rem 0.45rem;
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);

    &[aria-pressed="true"] {
      background: color-mix(in oklch, currentColor 12%, transparent);
    }

    &:focus-visible {
      outline: var(--border-width) solid currentColor;
      outline-offset: 3px;
    }

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
    grid-column: 4;
    align-items: center;
    justify-self: center;
    padding-inline: 0.25rem;
    border-radius: var(--radius-control);
    font-size: var(--text-md);
    line-height: var(--size-edition-control);
    white-space: nowrap;
    &.unavailable {
      --accent: var(--accent-red);
    }
  }
  .external-icon {
    --size-icon: 1em;
    color: var(--accent);
  }
  .editions {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr) max-content max-content auto max-content;
  }
  .edition {
    display: grid;
    position: relative;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    align-items: center;
    gap: 0.25rem;
    border-block-end: 1px solid #fff1;
    background-clip: padding-box;

    &:last-child {
      border-block-end: 0;
    }
    &.inspected {
      background-color: var(--panel);
    }
  }
  .edition > :is(.own, .shop, .wish) {
    /* Keep the independent controls above the edition button's row-wide hit area. */
    z-index: 1;
  }
  .own,
  .wish {
    display: grid;
    place-items: center;
    min-block-size: var(--size-edition-control);
    padding-inline: 0.25rem;
    cursor: pointer;
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
    opacity: 0.5;

    &:is(:hover, :focus-visible, :checked) {
      opacity: 1;
    }

    &:checked {
      background:
        linear-gradient(var(--foreground) 0 0) content-box,
        var(--contrast);
    }
  }
  .edition-label {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    min-inline-size: 0;
    min-block-size: var(--size-edition-control);
    padding: 0.25rem 0.125rem;
    gap: 0.125rem 0.5rem;
    border-radius: var(--radius-control);
    font-size: var(--text-md);
    line-height: var(--line-height-snug);
    text-align: start;

    &::after {
      position: absolute;
      inset: 0;
      content: "";
      cursor: pointer;
    }
  }
  .edition-name {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.125rem 0.5rem;
    overflow-wrap: anywhere;
  }
  .edition-date {
    font-size: clamp(var(--text-xs), 3.75cqi, var(--text-sm));
    white-space: nowrap;
  }
  .gameplay-icon,
  .wish-icon {
    --size-icon: 1.25rem;
  }
  .gameplay-icon {
    grid-column: 3;
    justify-self: center;
    color: var(--accent-green);
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
    align-self: stretch;
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
    padding: 0.25rem;
    cursor: pointer;
  }
  .contents-count {
    float: inline-end;
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
    white-space: nowrap;
  }
  .notes p {
    margin-block-start: 0.5rem;
    white-space: pre-line;
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
    transition: var(--transition-colors);
  }
  @media (hover: hover) {
    button.badge:hover {
      background: color-mix(in oklch, currentColor 12%, transparent);
    }
    .ownership[aria-pressed="false"]:not(:disabled):hover .ownership-label {
      opacity: 0.5;
    }
    button:not(:disabled, .wish, .edition-label, .badge):hover,
    summary:hover,
    .edition:hover {
      background: color-mix(in oklch, var(--accent) 14%, var(--panel));
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
      background: color-mix(in oklch, var(--accent-red) 24%, var(--panel));
      & .wish-icon {
        scale: 1.12;
        color: color-mix(in oklch, var(--accent-red) 75%, var(--foreground));
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
  @container (min-width: 32rem) {
    .edition-label {
      grid-template-columns: minmax(0, 1fr) 6rem;
      padding-block: 0.125rem;
    }
    .edition-name {
      display: grid;
      grid-template-columns: minmax(0, max-content) minmax(0, max-content);
    }
    .edition-title,
    .edition-material {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .edition-date {
      grid-row: 1;
      grid-column: 2;
      text-align: center;
    }
  }
</style>
