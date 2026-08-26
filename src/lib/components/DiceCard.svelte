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

<li
  class={["bg-card overflow-hidden rounded-2xl border-2 bg-clip-padding transition-colors", owned ? "border-accent" : "border-transparent"]}
>
  <div
    class="bg-panel flex cursor-pointer items-start gap-3 py-3 pl-3"
    role="button"
    tabindex={0}
    aria-pressed={owned}
    aria-label={`${owned ? "Unmark" : "Mark"} ${item.name} as owned`}
    onclick={() => collection.toggleOwned(item.id)}
    {onkeydown}
  >
    <OwnedCheckbox checked={owned} onchange={() => collection.toggleOwned(item.id)} label={item.name} />
    <h3 class="font-display flex-1 text-2xl leading-tight font-semibold">
      {item.name}
    </h3>
    {#if !owned}
      <WishlistButton active={!!entry.wishlisted} onchange={() => collection.toggleWishlisted(item.id)} label={item.name} />
    {/if}
  </div>

  <div class="flex flex-col gap-3 px-3 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-accent tabular-nums">{formatPrice(item.price)}</span>
      <span class="bg-border h-3 w-px" aria-hidden={true}></span>
      <div class="flex items-center gap-2" aria-label={`Colors: ${item.colors.join(", ")}`}>
        {#each item.colors as c, i (c + i)}
          <span class="rounded-lg px-2 py-1 font-bold" style:background-color={c} style:color={item.colors[+!i]}>
            {item.text[i]}
          </span>
        {/each}
      </div>
      {#if url}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent ml-auto inline-flex w-fit items-center gap-1 underline-offset-4 hover:underline"
        >
          Store <span class="i-material-symbols:open-in-new size-4" aria-hidden="true"></span>
          <span class="sr-only">page for {item.name}</span>
        </a>
      {/if}
    </div>
  </div>
</li>
