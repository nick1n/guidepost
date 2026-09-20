<script lang="ts">
  import InlineMarkdown from "#lib/components/InlineMarkdown.svelte";
  import type { Snippet } from "svelte";

  let {
    title,
    meta = "",
    restricted = "",
    open = $bindable(false),
    onadd,
    onaction,
    actionLabel = "Select",
    actionName,
    pressed,
    children,
  }: {
    title: string;
    meta?: string | string[];
    restricted?: string;
    open?: boolean;
    onadd?: Noop;
    onaction?: Noop;
    actionLabel?: string;
    actionName?: string;
    pressed?: boolean;
    children: Snippet;
  } = $props();

  let metaItems = $derived((Array.isArray(meta) ? meta : [meta]).filter(Boolean));

  function add() {
    open = true;
    onadd?.();
  }
</script>

<div class={["section", (onadd || onaction) && "with-add", onadd && onaction && "with-pair"]}>
  <details bind:open>
    <summary>
      <span class="heading">
        {#if restricted}
          <span class="restriction-mark">
            <span class="restriction-icon i-material-symbols:block" aria-hidden="true"></span>
            <span class="visually-hidden">{restricted}</span>
          </span>
        {/if}
        <InlineMarkdown text={title} />
      </span>
      {#if restricted || metaItems.length}
        <small class={[restricted && "restricted"]}>
          {#if restricted}<span class="restriction">{restricted}</span>{/if}
          {#each metaItems as item, index (`${index}-${item}`)}<span class="meta">{item}</span>{/each}
        </small>
      {/if}
      <span class="chevron i-material-symbols:expand-more" aria-hidden="true"></span>
    </summary>
    <div class="content">{@render children()}</div>
  </details>
  {#if onadd || onaction}
    <div class="section-actions">
      {#if onaction}
        <button class="add" onclick={onaction} aria-label={actionName ?? `${actionLabel} ${title}`} aria-pressed={pressed}>
          {actionLabel}
        </button>
      {/if}
      {#if onadd}
        <button class={["add", onaction && "icon-action"]} onclick={add} aria-label={`Add to ${title}`}>
          <span class="add-icon i-material-symbols:add" aria-hidden="true"></span>
          {#if !onaction}Add{/if}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .heading {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .restriction {
    color: var(--accent-red);
    font-weight: var(--font-bold);
  }
  .restriction-mark {
    display: none;
  }
  .restriction-icon {
    display: block;
    inline-size: 1rem;
    block-size: 1rem;
  }
  :global(.signal) .restriction-mark {
    display: block;
    flex-shrink: 0;
  }
  :global(.signal) .restriction {
    display: none;
  }
  .section {
    position: relative;
    border-block-end: 2px solid color-mix(var(--identity) 45%, transparent);
  }
  summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: 0.25rem 0.375rem;
    gap: 0.375rem;
    color: color-mix(var(--identity) 55%, var(--foreground));
    list-style: none;
    cursor: pointer;
    &::-webkit-details-marker {
      display: none;
    }
  }
  small {
    display: flex;
    flex-wrap: wrap;
    gap: 0.875rem;
    grid-row: 2;
    grid-column: 1;
    color: var(--muted-foreground);
    font-weight: var(--font-normal);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }
  .chevron {
    display: inline-block;
    grid-row: 1;
    grid-column: 2;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    color: var(--muted-foreground);
    transition: rotate var(--duration-fast);
  }
  /* Native details toggles before bind:open updates, so layout must follow the attribute. */
  details[open] small:not(.restricted),
  details[open] .meta {
    display: none;
  }
  details:not([open]) summary:has(small) .chevron,
  summary:has(.restricted) .chevron {
    grid-row: 1 / 3;
  }
  details:not([open]) .chevron {
    rotate: -90deg;
  }
  .content {
    padding-block-end: 0.5rem;
    font-weight: var(--font-normal);
    font-size: 1rem;
  }
  .with-add summary {
    anchor-name: --section-header;
    margin-inline-end: 4rem;
  }
  .with-pair summary {
    margin-inline-end: 5.75rem;
  }
  .section-actions {
    display: flex;
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0.125rem;
  }
  .add {
    display: flex;
    position: relative;
    align-items: center;
    justify-content: center;
    inline-size: 3.75rem;
    min-block-size: 2.75rem;
    gap: 0.25rem;
    color: var(--foreground);
    font-size: var(--text-sm);
    &::before {
      position: absolute;
      min-block-size: 2.75rem;
      inset-block-start: 50%;
      inset-inline: 0;
      translate: 0 -50%;
      content: "";
    }
  }
  .with-pair .add {
    inline-size: 3rem;
  }
  .with-pair .icon-action {
    inline-size: 2.75rem;
    margin-inline-end: -0.25rem;
    &::after {
      content: "";
      position: absolute;
      inset-inline-start: 0;
      inset-block: 30%;
      border-inline-start: 1px solid var(--color-divider);
    }
  }
  @supports (block-size: anchor-size(height)) {
    .section-actions {
      position-anchor: --section-header;
      inset-block-start: anchor(top);
      block-size: anchor-size(height);
    }
    .add {
      min-block-size: 0;
    }
  }
  .add-icon {
    inline-size: 1rem;
    block-size: 1rem;
  }
  :global(.folio) .section {
    margin-block: 0.25rem;
    padding-inline: 0.25rem;
    border: 0;
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 10%, var(--panel));
  }
  :global(.folio) summary {
    padding-inline: 0.625rem;
  }
  :global(.folio) .restriction {
    color: var(--foreground);
  }
  :global(.signal) .section {
    margin-block: 0.25rem;
    padding: 0 0.25rem 0.25rem;
    border: 0;
    border-radius: 1.25rem 0.5rem 1.25rem 0.5rem;
    background: color-mix(var(--identity) 12%, var(--background));
  }
  :global(.signal) summary {
    padding-inline: 0.625rem;
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    background: var(--identity);
    color: var(--identity-ink);
  }
  :global(.signal) .with-add summary {
    margin-block-end: 0;
  }
  :global(.signal) .chevron,
  :global(.signal) small {
    color: inherit;
  }
  :global(.signal) .add[aria-pressed="true"] {
    border-radius: var(--radius-control);
    background: var(--foreground);
    color: var(--background);
  }
  :global(.signal) .content {
    padding-block: 0.25rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
