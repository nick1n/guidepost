<script lang="ts">
  import OwnedCheckbox from "./OwnedCheckbox.svelte";
  import WishlistButton from "./WishlistButton.svelte";
  import { formatPrice, storeUrl } from "#lib/kdm-data.ts";
  import type { DiceSet } from "#lib/types/index.ts";
  import { collection } from "#lib/state/collection.svelte.ts";

  type Props = {
    item: DiceSet;
  };

  let { item }: Props = $props();

  const entry = $derived(collection.get(item.id));
  const owned = $derived(!!entry.owned);
  const url = $derived(storeUrl(item.url));

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    collection.toggleOwned(item.id);
  }
</script>

<li class="card" data-owned={owned}>
  <div
    class="header"
    role="button"
    tabindex={0}
    aria-pressed={owned}
    aria-label={`${owned ? "Unmark" : "Mark"} ${item.name} as owned`}
    onclick={() => collection.toggleOwned(item.id)}
    {onkeydown}
  >
    <OwnedCheckbox checked={owned} onchange={() => collection.toggleOwned(item.id)} label={item.name} />
    <h3>
      {item.name}
    </h3>
    {#if !owned}
      <WishlistButton active={!!entry.wishlisted} onchange={() => collection.toggleWishlisted(item.id)} label={item.name} />
    {/if}
  </div>

  <div class="body">
    <div class="details">
      <span class="price">{formatPrice(item.price)}</span>
      <span class="divider" aria-hidden={true}></span>
      <div class="colors" aria-label={`Colors: ${item.colors.join(", ")}`}>
        {#each item.colors as c, i (c + i)}
          <span class="die" style:background-color={c} style:color={item.colors[+!i]}>
            {item.text[i]}
          </span>
        {/each}
      </div>
      {#if url}
        <a href={url} target="_blank" rel="noopener noreferrer" class="store">
          Store <span class="external-icon i-material-symbols:open-in-new" aria-hidden="true"></span>
          <span class="store-label">page for {item.name}</span>
        </a>
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
    align-items: flex-start;
    gap: 0.75rem;
    padding-block: 0.75rem;
    padding-inline-start: 0.75rem;
    background: var(--panel);
    cursor: pointer;

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: calc(-1 * var(--border-size));
    }
  }

  h3 {
    flex: 1;
    font-weight: var(--font-semibold);
    font-size: var(--text-card-title);
    line-height: var(--line-height-tight);
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

  .store {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-inline-start: auto;
    color: var(--accent);
    text-underline-offset: 0.25rem;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: var(--border-size);
    }
  }

  .external-icon {
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
  }

  .store-label {
    position: absolute;
    overflow: hidden;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
