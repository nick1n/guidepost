<script lang="ts">
  import OwnedCheckbox from "./OwnedCheckbox.svelte";
  import WishlistButton from "./WishlistButton.svelte";
  import StoreLink from "./StoreLink.svelte";
  import { formatPrice, storeUrl } from "#lib/kdm-data.ts";
  import type { DiceSet } from "#lib/types/index.ts";
  import { collection } from "#lib/state/collection.svelte.ts";
  import { collectionActions } from "#lib/state/collection-actions.ts";

  type Props = {
    item: DiceSet;
  };

  let { item }: Props = $props();

  const entry = $derived(collection.get(item.id));
  const owned = $derived(!!entry.owned);
  const url = $derived(storeUrl(item.url));

  function toggleOwned() {
    collectionActions.run(collection.toggleOwned(item.id));
  }
</script>

<li class="card" data-owned={owned}>
  <div class="header">
    <h3>
      <button type="button" class="ownership" aria-pressed={owned} onclick={toggleOwned}>
        <OwnedCheckbox checked={owned} />
        <span>{item.name}<span class="visually-hidden"> owned</span></span>
      </button>
    </h3>
    {#if !owned}
      <WishlistButton
        active={!!entry.wishlisted}
        onclick={() => collectionActions.run(collection.toggleWishlisted(item.id))}
        label={item.name}
      />
    {/if}
  </div>

  <div class="body">
    <div class="details">
      <span class="price">{formatPrice(item.price)}</span>
      <span class="divider" aria-hidden={true}></span>
      <div class="colors" aria-label={`Colors: ${item.colors.join(", ")}`}>
        {#each item.colors as color, i (color + i)}
          <span class="die" style:background-color={color} style:color={item.colors[i === 0 ? 1 : 0]}>
            {item.text[i]}
          </span>
        {/each}
      </div>
      {#if url}
        <StoreLink href={url} name={item.name} />
      {/if}
    </div>
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
    background: var(--panel);
  }

  .ownership {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    text-align: start;

    &:hover {
      --color-checkbox: var(--card);
    }
    &:focus-visible {
      outline-offset: calc(-1 * var(--border-size));
    }
  }

  h3 {
    display: flex;
    flex: 1;
    min-inline-size: 0;
    font-weight: var(--font-semibold);
    font-size: var(--text-card-title);
    line-height: var(--size-card-header);
    font-family: var(--font-display);
  }

  .body {
    padding: 0.75rem;
  }

  .details {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .price {
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .divider {
    inline-size: 1px;
    block-size: 0.75rem;
    background: var(--border);
  }

  .colors {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .die {
    border-radius: var(--radius-control);
    padding: 0.25rem 0.5rem;
    font-weight: var(--font-bold);
  }
</style>
