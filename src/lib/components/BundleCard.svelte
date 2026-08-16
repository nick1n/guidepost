<script lang="ts">
  import { Check, ChevronDown, ExternalLink } from "@lucide/svelte";
  import OwnedCheckbox from "./OwnedCheckbox.svelte";
  import WishlistButton from "./WishlistButton.svelte";
  import Pill from "./Pill.svelte";
  import TagRail from "./TagRail.svelte";
  import { type Bundle, formatPrice, nameById, storeUrl } from "#lib/kdm-data.js";
  import type { CollectionState, EntryState } from "#lib/collection.svelte.js";

  type Props = {
    bundle: Bundle;
    entry: EntryState;
    collectionState: CollectionState;
    partsValue: number;
    onToggleOwned: () => void;
    onToggleWishlist: () => void;
    onSetPartsOwned: (owned: boolean) => void;
  };

  let {
    bundle,
    entry,
    collectionState,
    partsValue,
    onToggleOwned,
    onToggleWishlist,
    onSetPartsOwned,
  }: Props = $props();

  let expanded = $state(false);

  const owned = $derived(!!entry.owned);
  const url = $derived(storeUrl(bundle.url));
  const ownedCount = $derived(
    bundle.includes.filter((id) => collectionState[id]?.owned).length,
  );
  const total = $derived(bundle.includes.length);
  const savings = $derived(
    bundle.price != null ? partsValue - bundle.price : 0,
  );
</script>

<li
  class={[
    "overflow-hidden rounded-2xl border-2 bg-card transition-colors bg-clip-padding",
    owned ? "border-accent" : "border-transparent",
  ]}
>
  <div
    class="flex cursor-pointer items-start gap-3 bg-panel pl-3 py-3"
    role="button"
    tabindex={0}
    aria-pressed={owned}
    aria-label={`${owned ? "Unmark" : "Mark"} ${bundle.name} as owned`}
    onclick={onToggleOwned}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggleOwned();
      }
    }}
  >
    <OwnedCheckbox
      checked={owned}
      onchange={onToggleOwned}
      label={bundle.name}
    />
    <div class="min-w-0 flex-1">
      <h3
        class="font-display text-2xl font-semibold leading-tight text-balance"
      >
        {bundle.name}
      </h3>
      <p class="mt-1 tabular-nums text-foreground/60">
        {ownedCount}/{total} items owned
      </p>
    </div>
    {#if !owned}
      <WishlistButton
        active={!!entry.wishlisted}
        onchange={onToggleWishlist}
        label={bundle.name}
      />
    {/if}
  </div>

  <div class="h-1 w-full bg-background/60" aria-hidden={true}>
    <div
      class="h-full bg-accent transition-all"
      style:width="{total ? (ownedCount / total) * 100 : 0}%"
    ></div>
  </div>

  <div class="flex flex-col gap-3 px-3 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="tabular-nums text-accent">{formatPrice(bundle.price)}</span>
      {#if savings > 0}
        <span class="tabular-nums text-muted-foreground line-through">
          {formatPrice(partsValue)}
        </span>
      {/if}
      <span class="h-3 w-px bg-border" aria-hidden={true}></span>
      <Pill tone={bundle.gameplay ? "accent" : "outline"}>
        {bundle.gameplay ? "Gameplay" : "Models only"}
      </Pill>
      {#if url}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          class="ml-auto inline-flex items-center gap-1 self-center text-accent underline-offset-4 hover:underline"
        >
          Store <ExternalLink class="size-4" aria-hidden={true} />
          <span class="sr-only">page for {bundle.name}</span>
        </a>
      {/if}
    </div>

    <TagRail tags={bundle.tags} />

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        onclick={() => onSetPartsOwned(true)}
        class="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 font-semibold text-accent-foreground transition-opacity hover:opacity-85"
      >
        <Check class="size-4" strokeWidth={3} aria-hidden={true} />
        Mark all owned
      </button>
      <button
        type="button"
        onclick={() => onSetPartsOwned(false)}
        class="rounded-lg bg-panel px-3 py-2 text-foreground/80 transition-colors hover:text-foreground"
      >
        Clear all
      </button>
    </div>

    <button
      type="button"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
      class="flex items-center gap-1 text-muted-foreground hover:text-foreground"
    >
      <ChevronDown
        class={expanded
          ? "size-4 transition-transform rotate-180"
          : "size-4 transition-transform"}
        aria-hidden={true}
      />
      {expanded ? "Hide contents" : "Show contents"}
    </button>

    {#if expanded}
      <ul class="flex flex-col gap-1 border-t border-border/60 pt-2">
        {#each bundle.includes as id (id)}
          {@const isOwned = !!collectionState[id]?.owned}
          <li class="flex items-center gap-2">
            <Check
              class={isOwned
                ? "size-4 shrink-0 text-accent"
                : "size-4 shrink-0 text-muted-foreground/30"}
              strokeWidth={3}
              aria-hidden={true}
            />
            <span class={isOwned ? "text-foreground" : "text-muted-foreground"}>
              {nameById[id] ?? id}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</li>
