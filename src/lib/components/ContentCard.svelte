<script lang="ts">
  import { ExternalLink, Lock, Unlock } from "@lucide/svelte";
  import OwnedCheckbox from "./OwnedCheckbox.svelte";
  import WishlistButton from "./WishlistButton.svelte";
  import VersionPicker from "./VersionPicker.svelte";
  import EditionPicker from "./EditionPicker.svelte";
  import TagRail from "./TagRail.svelte";
  import Pill from "./Pill.svelte";
  import {
    type ContentItem,
    effectivePrice,
    formatPrice,
    nameById,
    storeUrl,
  } from "$lib/kdm-data";
  import type { EntryState } from "$lib/collection.svelte";

  type Props = {
    item: ContentItem;
    entry: EntryState;
    requiresOwned: boolean;
    onToggleOwned: () => void;
    onToggleWishlist: () => void;
    onSetVersion: (v: string) => void;
    onSetEdition: (id: string) => void;
    onSetEditionNumber: (id: string, n?: number) => void;
    onTagClick: (tag: string) => void;
    onKindClick: (kind: ContentItem["kind"]) => void;
    onGameplayClick: (gameplay: boolean) => void;
  };

  let {
    item,
    entry,
    requiresOwned,
    onToggleOwned,
    onToggleWishlist,
    onSetVersion,
    onSetEdition,
    onSetEditionNumber,
    onTagClick,
    onKindClick,
    onGameplayClick,
  }: Props = $props();

  const owned = $derived(!!entry.owned);
  const url = $derived(storeUrl(item.url));
  const isBeta = $derived(!!item.editions);
  const price = $derived(
    effectivePrice(
      item,
      entry.versions ?? (entry.version ? [entry.version] : []),
      entry.editions ?? (entry.edition ? [entry.edition] : []),
    ),
  );
  const editionValue = $derived(
    entry.editions ?? (entry.edition ? [entry.edition] : []),
  );
  const versionValue = $derived(
    entry.versions ?? (entry.version ? [entry.version] : []),
  );
  const copyNumbers = $derived(
    entry.editionNumbers ??
      (entry.edition && entry.editionNumber != null
        ? { [entry.edition]: entry.editionNumber }
        : undefined),
  );
</script>

<li
  class={[
    "relative overflow-hidden border-2 bg-card transition-colors bg-clip-padding",
    owned ? "border-accent" : "border-transparent",
    isBeta ? "" : "rounded-2xl",
  ]}
>
  {#if isBeta}
    <div
      class="pointer-events-none absolute -left-10 top-4 w-32 rotate-135 bg-beta py-1 h-4"
      aria-hidden={true}
    ></div>
  {/if}

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
    <div class="min-w-0 flex-1">
      <h3 class="font-display text-2xl truncate font-semibold leading-tight">
        {item.name}
      </h3>
      {#if item.alt}
        <p class="mt-1 truncate text-foreground/60">{item.alt}</p>
      {/if}
    </div>
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
      <span class="tabular-nums text-accent">{formatPrice(price)}</span>
      <span class="h-5 w-px bg-border" aria-hidden={true}></span>
      <Pill
        tone={item.gameplay ? "accent" : "outline"}
        onclick={() => onGameplayClick(item.gameplay)}
      >
        {item.gameplay ? "Gameplay" : "Models only"}
      </Pill>
      <Pill tone="neutral" onclick={() => onKindClick(item.kind)}
        >{item.kind}</Pill
      >
      {#if url}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex px-2 py-1 items-center ml-auto gap-1 text-accent underline-offset-4 hover:underline"
        >
          Shop <ExternalLink class="size-4" aria-hidden={true} />
          <span class="sr-only">page for {item.name}</span>
        </a>
      {/if}
    </div>

    <TagRail tags={item.tags} {onTagClick} />

    {#if isBeta && item.editions}
      <EditionPicker
        editions={item.editions}
        value={editionValue}
        {copyNumbers}
        onselect={onSetEdition}
        onSetCopyNumber={onSetEditionNumber}
      />
    {/if}

    {#if item.versions}
      <VersionPicker
        versions={item.versions}
        value={versionValue}
        onselect={onSetVersion}
      />
    {/if}

    {#if item.requires && item.requires.length > 0}
      <div
        class={[
          "flex items-center -mx-3 -mb-3 px-3 py-1 gap-2 leading-relaxed bg-destructive",
          requiresOwned ? "text-muted-foreground" : "text-foreground",
        ]}
      >
        <span class="rounded-full bg-black p-1 shrink-0 font-bold">
          {#if requiresOwned}
            <Unlock class="size-3" aria-hidden={true} />
          {:else}
            <Lock class="size-3" aria-hidden={true} />
          {/if}
        </span>
        <span class="font-bold"
          >{item.requires
            .map((r) => nameById[r]?.replace(/ expansion/gi, "") ?? r)
            .join(", ")}</span
        ><span>Required</span>
      </div>
    {/if}
  </div>
</li>
