<script lang="ts">
  import OwnedCheckbox from "./OwnedCheckbox.svelte";
  import WishlistButton from "./WishlistButton.svelte";
  import Pill from "./Pill.svelte";
  import StoreLink from "./StoreLink.svelte";
  import TagRail from "./TagRail.svelte";
  import { formatPrice, nameById, storeUrl } from "#lib/kdm-data.ts";
  import type { Bundle } from "#lib/types/index.ts";
  import { collection } from "#lib/state/collection.svelte.ts";

  type Props = {
    bundle: Bundle;
    partsValue: number;
  };

  let { bundle, partsValue }: Props = $props();

  let expanded = $state(false);

  const entry = $derived(collection.get(bundle.id));
  const owned = $derived(!!entry.owned);
  const url = $derived(storeUrl(bundle.url));
  const ownedCount = $derived(bundle.includes.filter((id) => collection.state[id]?.owned).length);
  const total = $derived(bundle.includes.length);

  function onclick() {
    const nextOwned = !collection.state[bundle.id]?.owned;
    collection.toggleOwned(bundle.id);
    collection.setManyOwned(bundle.includes, nextOwned);
  }

  function toggleBundleOwnedFromKeyboard(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onclick();
  }
</script>

<li class="card" data-owned={owned}>
  <div
    class="header"
    role="button"
    tabindex={0}
    aria-pressed={owned}
    aria-label={`${owned ? "Unmark" : "Mark"} ${bundle.name} as owned`}
    {onclick}
    onkeydown={toggleBundleOwnedFromKeyboard}
  >
    <OwnedCheckbox checked={owned} onchange={onclick} label={bundle.name} />
    <div class="summary">
      <h3>
        {bundle.name}
      </h3>
      <p>
        {ownedCount}/{total} items owned
      </p>
    </div>
    {#if !owned}
      <WishlistButton active={!!entry.wishlisted} onchange={() => collection.toggleWishlisted(bundle.id)} label={bundle.name} />
    {/if}
  </div>

  <div class="progress" aria-hidden={true}>
    <div class="progress-value" style:--progress={`${total ? (ownedCount / total) * 100 : 0}%`}></div>
  </div>

  <div class="body">
    <div class="details">
      <span class="price">{formatPrice(bundle.price)}</span>
      {#if bundle.price != null && partsValue > bundle.price}
        <span class="original-price">
          {formatPrice(partsValue)}
        </span>
      {/if}
      <span class="divider" aria-hidden={true}></span>
      <Pill tone={bundle.gameplay ? "accent" : "outline"}>
        {bundle.gameplay ? "Gameplay" : "Models only"}
      </Pill>
      {#if url}
        <StoreLink href={url} label="Store" itemName={bundle.name} />
      {/if}
    </div>

    <TagRail tags={bundle.tags} />

    <div class="actions">
      <button type="button" onclick={() => collection.setManyOwned(bundle.includes, true)} class="mark-all">
        <span class="button-icon i-material-symbols:check" aria-hidden="true"></span>
        Mark all owned
      </button>
      <button type="button" onclick={() => collection.setManyOwned(bundle.includes, false)} class="clear-all"> Clear all </button>
    </div>

    <button type="button" onclick={() => (expanded = !expanded)} aria-expanded={expanded} class="contents-toggle">
      <span class="expand-icon i-material-symbols:expand-more" style:--rotation={expanded ? "180deg" : "0deg"} aria-hidden="true"></span>
      {expanded ? "Hide contents" : "Show contents"}
    </button>

    {#if expanded}
      <ul class="contents">
        {#each bundle.includes as id (id)}
          {@const isOwned = !!collection.state[id]?.owned}
          <li class="content-item" data-owned={isOwned}>
            <span
              class="item-icon i-material-symbols:check"
              style:--icon-color={isOwned ? "var(--accent)" : "color-mix(var(--muted-foreground) 30%, transparent)"}
              aria-hidden="true"
            ></span>
            <span>{nameById[id] ?? id}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</li>

<style>
  .card {
    overflow: hidden;
    border: var(--border-size) solid transparent;
    border-radius: var(--radius-card);
    background: var(--card);
    background-clip: padding-box;
    transition: border-color var(--duration-fast) var(--ease-standard);

    &[data-owned="true"] {
      border-color: var(--accent);
    }
  }

  .header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding-block: 0.75rem;
    padding-inline-start: 0.75rem;
    background: var(--panel);
    cursor: pointer;

    &:focus-visible {
      outline-offset: calc(-1 * var(--border-size));
    }
  }

  .summary {
    flex: 1;
    min-inline-size: 0;
  }

  h3 {
    font-weight: var(--font-semibold);
    font-size: var(--text-card-title);
    line-height: var(--line-height-tight);
    font-family: var(--font-display);
    text-wrap: balance;
  }

  p {
    margin-block-start: 0.25rem;
    color: color-mix(var(--foreground) 60%, transparent);
    font-variant-numeric: tabular-nums;
  }

  .progress {
    block-size: 0.25rem;
    background: color-mix(var(--background) 60%, transparent);
  }

  .progress-value {
    inline-size: var(--progress);
    block-size: 100%;
    background: var(--accent);
    transition: inline-size var(--duration-fast) var(--ease-standard);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .details {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .price,
  .original-price {
    font-variant-numeric: tabular-nums;
  }

  .price {
    color: var(--accent);
  }

  .original-price {
    color: var(--muted-foreground);
    text-decoration: line-through;
  }

  .divider {
    inline-size: 1px;
    block-size: 0.75rem;
    background: var(--border);
  }

  .button-icon,
  .expand-icon,
  .item-icon {
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  :is(.mark-all, .clear-all) {
    border-radius: var(--radius-control);
    padding: 0.5rem 0.75rem;
  }

  .mark-all {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--accent);
    color: var(--accent-foreground);
    font-weight: var(--font-semibold);
    transition: opacity var(--duration-fast) var(--ease-standard);

    &:hover {
      opacity: 0.85;
    }
  }

  .clear-all {
    background: var(--panel);
    color: color-mix(var(--foreground) 80%, transparent);
    transition: color var(--duration-fast) var(--ease-standard);

    &:hover {
      color: var(--foreground);
    }
  }

  .contents-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-standard);

    &:hover {
      color: var(--foreground);
    }
  }

  .expand-icon {
    rotate: var(--rotation);
    transition: rotate var(--duration-fast) var(--ease-standard);
  }

  .contents {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border-block-start: 1px solid color-mix(var(--border) 60%, transparent);
    padding-block-start: 0.5rem;
  }

  .content-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted-foreground);

    &[data-owned="true"] {
      color: var(--foreground);
    }
  }

  .item-icon {
    flex-shrink: 0;
    color: var(--icon-color);
  }
</style>
