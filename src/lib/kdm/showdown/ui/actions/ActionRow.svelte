<script lang="ts">
  import InlineMarkdown from "#lib/components/InlineMarkdown.svelte";
  import ActionCost from "./ActionCost.svelte";
  import { describeCost, type Cost } from "#lib/kdm/showdown/sheet.ts";

  let {
    title,
    cost,
    short,
    description,
    group,
    disabled,
    onspend,
  }: {
    title: string;
    cost: readonly Cost[];
    short: string;
    description: string;
    group: string;
    disabled: boolean;
    onspend: (event: MouseEvent) => void;
  } = $props();
</script>

<li class="row">
  <details name={group}>
    <summary class="read">
      <span class="heading">
        <strong>{title}</strong>
        <span class="chevron i-material-symbols:expand-more" aria-hidden="true"></span>
      </span>
      <small class="preview">{short}</small>
    </summary>
    <div class="description">
      <p><InlineMarkdown text={description} /></p>
    </div>
  </details>
  <button
    class="spend"
    type="button"
    aria-label={cost.length ? `Spend ${describeCost(cost)} for ${title}` : `Use ${title} for free`}
    {disabled}
    onclick={onspend}
  >
    <ActionCost {cost} />
  </button>
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    overflow: hidden;
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  details,
  details::details-content {
    display: contents;
  }
  details:not([open])::details-content {
    display: none;
  }
  details[open] .preview {
    display: none;
  }
  .read {
    display: block;
    grid-column: 1;
    cursor: pointer;
    min-inline-size: 0;
    padding: 0.375rem 0.5rem;
    text-align: start;

    &::-webkit-details-marker {
      display: none;
    }

    &:hover {
      background: var(--identity-9);
    }

    &:focus-visible {
      outline: var(--border-width) solid var(--accent);
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
  details[open] .chevron {
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
    grid-row: 1;
    grid-column: 2;
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
