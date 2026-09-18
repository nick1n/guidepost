<script lang="ts">
  import InlineMarkdown from "#lib/components/InlineMarkdown.svelte";
  import type { Snippet } from "svelte";

  let {
    title,
    meta = "",
    open = $bindable(false),
    onadd,
    onaction,
    actionLabel = "Select",
    actionName,
    pressed,
    children,
  }: {
    title: string;
    meta?: string;
    open?: boolean;
    onadd?: Noop;
    onaction?: Noop;
    actionLabel?: string;
    actionName?: string;
    pressed?: boolean;
    children: Snippet;
  } = $props();

  function add() {
    open = true;
    onadd?.();
  }
</script>

<div class={["section", (onadd || onaction) && "with-add"]}>
  <details bind:open>
    <summary>
      <span><InlineMarkdown text={title} /></span>
      {#if !open && meta}
        <small>{meta}</small>
      {/if}
      <span class="chevron i-material-symbols:expand-more" aria-hidden="true"></span>
    </summary>
    <div class="content">{@render children()}</div>
  </details>
  {#if onadd}
    <button class="add" onclick={add} aria-label={`Add to ${title}`}>
      <span class="add-icon i-material-symbols:add" aria-hidden="true"></span>Add
    </button>
  {/if}
  {#if onaction}
    <button class="add" onclick={onaction} aria-label={actionName ?? `${actionLabel} ${title}`} aria-pressed={pressed}>
      {actionLabel}
    </button>
  {/if}
</div>

<style>
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
    flex-shrink: 0;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    color: var(--muted-foreground);
    transition: rotate var(--duration-fast);
  }
  summary:has(small) .chevron {
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
  .with-add {
    & summary {
      anchor-name: --section-header;
      margin-inline-end: 4rem;
    }
  }
  .add {
    display: flex;
    position: absolute;
    align-items: center;
    justify-content: center;
    inline-size: 3.75rem;
    min-block-size: 2.75rem;
    inset-block-start: 0;
    inset-inline-end: 0.125rem;
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
  @supports (block-size: anchor-size(height)) {
    .add {
      position-anchor: --section-header;
      min-block-size: 0;
      inset-block-start: anchor(top);
      block-size: anchor-size(height);
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
  :global(.signal) .section {
    margin-block: 0.25rem;
    padding: 0 0.25rem 0.25rem 0.25rem;
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
  :global(.signal) .add {
    color: var(--foreground);

    &[aria-pressed="true"] {
      border-radius: var(--radius-control);
      background: var(--foreground);
      color: var(--background);
    }
  }
  :global(.signal) .content {
    padding-block-end: 0.25rem;
  }
  :global(.signal) .with-add .content {
    margin-block-start: 0.25rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
