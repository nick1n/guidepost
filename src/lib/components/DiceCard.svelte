<script lang="ts">
  import { ExternalLink } from "@lucide/svelte";
  import OwnedCheckbox from "./OwnedCheckbox.svelte";
  import WishlistButton from "./WishlistButton.svelte";
  import { type DiceSet, formatPrice, storeUrl } from "#lib/kdm-data.js";
  import type { EntryState } from "#lib/collection.svelte.js";

  type Props = {
    item: DiceSet;
    entry: EntryState;
    onToggleOwned: () => void;
    onToggleWishlist: () => void;
  };

  let { item, entry, onToggleOwned, onToggleWishlist }: Props = $props();

  const owned = $derived(!!entry.owned);
  const url = $derived(storeUrl(item.url));
</script>

<li
  class={[
    "overflow-hidden rounded-2xl border-2 bg-card transition-colors bg-clip-padding",
    owned ? "border-accent" : "border-transparent",
  ]}
>
  <div
    class="flex cursor-pointer items-center gap-3 bg-panel pl-3 py-3"
    role="button"
    tabindex={0}
    aria-pressed={owned}
    aria-label={`${owned ? "Unmark" : "Mark"} ${item.name} as owned`}
    onclick={onToggleOwned}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggleOwned();
      }
    }}
  >
    <OwnedCheckbox checked={owned} onchange={onToggleOwned} label={item.name} />
    <h3 class="flex-1 text-2xl font-display font-semibold leading-tight">
      {item.name}
    </h3>
    {#if !owned}
      <WishlistButton
        active={!!entry.wishlisted}
        onchange={onToggleWishlist}
        label={item.name}
      />
    {/if}
  </div>

  <div class="flex flex-col gap-3 px-3 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="tabular-nums text-accent">{formatPrice(item.price)}</span>
      <span class="h-3 w-px bg-border" aria-hidden={true}></span>
      <div
        class="flex items-center gap-2"
        aria-label={`Colors: ${item.colors.join(", ")}`}
      >
        {#each item.colors as c, i (c + i)}
          <span
            class="rounded-lg font-bold py-1 px-2"
            style:background-color={c}
            style:color={item.colors[+!i]}
          >
            {item.text?.[i]}
          </span>
        {/each}
      </div>
      {#if url}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex ml-auto w-fit items-center gap-1 text-accent underline-offset-4 hover:underline"
        >
          Store <ExternalLink class="size-4" aria-hidden={true} />
          <span class="sr-only">page for {item.name}</span>
        </a>
      {/if}
    </div>
  </div>
</li>
