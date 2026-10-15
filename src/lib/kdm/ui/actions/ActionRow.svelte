<script lang="ts">
  import InlineMarkdown from "#lib/components/InlineMarkdown.svelte";
  import ActionCost from "./ActionCost.svelte";
  import { describeCost, type Cost } from "../../showdown/sheet";

  let {
    title,
    cost,
    short,
    description,
    open,
    disabled,
    onexpand,
    onspend,
  }: {
    title: string;
    cost: readonly Cost[];
    short: string;
    description: string;
    open: boolean;
    disabled: boolean;
    onexpand: () => void;
    onspend: () => void;
  } = $props();

  const descriptionId = $props.id();
</script>

<li class="row">
  <button class="read" type="button" aria-expanded={open} aria-controls={descriptionId} onclick={onexpand}>
    <span class="heading">
      <strong>{title}</strong>
      <span class="chevron i-material-symbols:expand-more" aria-hidden="true"></span>
    </span>
    {#if !open}<small class="preview">{short}</small>{/if}
  </button>
  <button
    class="spend"
    type="button"
    aria-label={cost.length ? `Spend ${describeCost(cost)} for ${title}` : `Use ${title} for free`}
    {disabled}
    onclick={onspend}
  >
    <ActionCost {cost} />
  </button>
  <div class="description" id={descriptionId} hidden={!open}>
    <p><InlineMarkdown text={description} /></p>
  </div>
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    overflow: hidden;
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .read {
    min-inline-size: 0;
    padding: 0.375rem 0.5rem;
    text-align: start;

    &:hover {
      background: var(--identity-9);
    }

    &:focus-visible {
      outline-offset: -2px;
    }
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    font-size: var(--text-sm);
  }
  strong {
    color: var(--identity-3);
  }
  .chevron {
    --size-icon: 1rem;
    color: var(--muted-foreground);
    transition: rotate var(--duration-fast);
  }
  .read[aria-expanded="true"] .chevron {
    rotate: 180deg;
  }
  .preview {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    line-height: var(--line-height-snug);
  }
  .spend {
    padding-inline: 0.5rem;
    background: var(--identity-10);

    &:hover:not(:disabled) {
      background: var(--identity-9);
    }

    &:focus-visible {
      outline-offset: -2px;
    }

    &:disabled {
      --color-action-cost: var(--muted-foreground);

      background: var(--panel);
      cursor: default;
    }
  }
  .description {
    grid-column: 1 / -1;
    padding: 0.5rem;
    border-block-start: 1px solid var(--color-divider);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    line-height: var(--line-height-snug);

    :global(strong) {
      color: var(--foreground);
    }

    :global(.kd-icon) {
      color: var(--identity);
      font-size: 1rem;
    }
  }
  :global(.obsidian) .row {
    background: var(--identity-10);
  }
  :global(.folio) .row {
    border-radius: 0.25rem;
  }
  :global(.folio) strong {
    font-weight: var(--font-normal);
    font-size: var(--text-md);
    font-family: var(--font-serif);
  }
  :global(.folio) .description {
    border-block-start: 3px double var(--identity-7);
    font-family: var(--font-serif);
  }
  :global(.signal) .row {
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    background: var(--identity-9);
  }
  :global(.signal) .read:hover {
    background: var(--identity-8);
  }
  :global(.signal) .spend:not(:disabled) {
    --color-action-cost: var(--foreground);

    background: var(--identity-8);

    &:hover {
      background: var(--identity-7);
    }
  }
</style>
