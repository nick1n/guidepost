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
      background: color-mix(var(--identity) 10%, transparent);
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
    color: color-mix(var(--identity) 55%, var(--foreground));
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
    background: color-mix(var(--identity) 14%, var(--panel));

    &:hover:not(:disabled) {
      background: color-mix(var(--identity) 25%, var(--panel));
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
    background: color-mix(var(--identity) 4%, var(--panel));
  }
  :global(.folio) .row {
    border-radius: 0.25rem;
  }
  :global(.folio) strong {
    font-weight: var(--font-normal);
    font-size: var(--text-md);
    font-family: var(--font-editorial);
  }
  :global(.folio) .description {
    border-block-start: 3px double color-mix(var(--identity) 35%, transparent);
    font-family: var(--font-editorial);
  }
  :global(.signal) .row {
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    background: color-mix(var(--identity) 16%, var(--background));
  }
  :global(.signal) .spend:not(:disabled) {
    --color-action-cost: var(--foreground);

    background: color-mix(var(--identity) 30%, var(--background));

    &:hover {
      background: color-mix(var(--identity) 40%, var(--background));
    }
  }
</style>
