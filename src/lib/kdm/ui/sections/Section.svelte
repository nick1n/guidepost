<script lang="ts">
  import InlineMarkdown from "#lib/components/InlineMarkdown.svelte";
  import KdIcon from "#lib/components/KdIcon.svelte";
  import { sectionIcons, type KdIconName } from "#lib/constants.ts";
  import { onMount, type Snippet } from "svelte";
  import HoldRipple from "#lib/components/gestures/HoldRipple.svelte";
  import { getSectionControls } from "./sections";

  let {
    title,
    meta = "",
    restricted = "",
    open = $bindable(false),
    onadd,
    onaction,
    showAction = true,
    actionLabel = "Select",
    actionName,
    actionIcon,
    actionIconText,
    pressed,
    children,
  }: {
    title: string;
    meta?: string | string[];
    restricted?: string;
    open?: boolean;
    onadd?: Noop;
    onaction?: Noop;
    showAction?: boolean;
    actionLabel?: string;
    actionName?: string;
    actionIcon?: KdIconName;
    actionIconText?: string;
    pressed?: boolean;
    children: Snippet;
  } = $props();

  let metaItems = $derived((Array.isArray(meta) ? meta : [meta]).filter(Boolean));
  let hasAction = $derived(Boolean(onaction && showAction));
  let icon = $derived(sectionIcons[title]);
  const contentId = $props.id();
  const sections = getSectionControls();
  onMount(() =>
    sections.register(
      () => title,
      () => open,
      (value) => (open = value),
    ),
  );

  function add() {
    open = true;
    onadd?.();
  }

  function toggleSection() {
    open = !open;
  }

  function toggleRelated() {
    const open = sections.toggleRelated?.(title);
    return `Matching ${title} sections ${open ? "expanded" : "collapsed"}.`;
  }
</script>

<div class={["section", onadd && hasAction && "with-pair"]}>
  <HoldRipple
    ontap={toggleSection}
    onhold={sections.toggleRelated ? toggleRelated : undefined}
    holdHint={`Hold or press Shift+Enter to expand or collapse matching ${title} sections across dashboards.`}
    coverParent
  >
    {#snippet children(events, paint)}
      <div class="section-header">
        <button class="toggle" type="button" aria-expanded={open} aria-controls={contentId} {...events}>
          <span class={["heading", restricted && "restricted-heading"]}>
            {#if icon}<span class={["section-icon", icon]} aria-hidden="true"></span>{/if}
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
        </button>
        {#if onadd || hasAction}
          <div class="section-actions">
            {#if hasAction}
              <button
                class={["add", actionIcon && "action-button-icon"]}
                type="button"
                onclick={onaction}
                title={actionName ?? `${actionLabel} ${title}`}
                aria-label={actionIcon ? (actionName ?? `${actionLabel} ${title}`) : undefined}
                aria-pressed={pressed}
              >
                {#if actionIcon}<KdIcon class="action-icon" i={actionIcon} text={actionIconText} />{:else}{actionLabel}{/if}
              </button>
            {/if}
            {#if onadd}
              <button
                class={["add", hasAction && "icon-action"]}
                type="button"
                onclick={add}
                title={`Add to ${title}`}
                aria-label={hasAction ? `Add to ${title}` : undefined}
              >
                <span class="add-icon i-material-symbols:add" aria-hidden="true"></span>
                {#if !onaction}Add{/if}
              </button>
            {/if}
          </div>
        {/if}
        {@render paint()}
      </div>
    {/snippet}
  </HoldRipple>
  <div class="content" id={contentId} hidden={!open}>{@render children()}</div>
</div>

<style>
  .heading {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .section-icon {
    display: none;
  }
  :global(.signal) .section-icon {
    display: inline-block;
    flex: none;
    inline-size: 1rem;
    block-size: 1rem;
    color: var(--identity-ink);
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
    border-block-end: 2px solid color-mix(var(--identity) 45%, transparent);
  }
  .section-header {
    position: relative;
    border-radius: inherit;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .toggle {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    min-inline-size: 0;
    padding: 0.25rem 0.375rem;
    user-select: none;
    -webkit-touch-callout: none;
    color: color-mix(var(--identity) 55%, var(--foreground));
    text-align: start;
  }
  small {
    display: flex;
    column-gap: 0.625rem;
    row-gap: 0;
    grid-row: 2;
    grid-column: 1;
    flex-wrap: wrap;
    color: var(--muted-foreground);
    font-weight: var(--font-normal);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }
  .chevron {
    display: inline-block;
    grid-row: 1;
    grid-column: 2;
    inline-size: var(--size-icon-control);
    block-size: var(--size-icon-control);
    color: var(--muted-foreground);
    transition: rotate var(--duration-fast);
  }
  .toggle[aria-expanded="true"] small:not(.restricted),
  .toggle[aria-expanded="true"] .meta {
    display: none;
  }
  .toggle[aria-expanded="false"]:has(small) .chevron,
  .toggle:has(.restricted) .chevron {
    grid-row: 1 / 3;
  }
  .toggle[aria-expanded="true"] .chevron {
    rotate: 180deg;
  }
  .content {
    padding-block-end: 0.5rem;
    font-weight: var(--font-normal);
    font-size: 1rem;
  }
  .section-actions {
    display: flex;
  }
  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 3.75rem;
    min-block-size: var(--size-control);
    gap: 0.25rem;
    color: var(--foreground);
    font-size: var(--text-sm);
  }
  .with-pair .add,
  .action-button-icon {
    inline-size: var(--size-control);
  }
  .with-pair .icon-action {
    position: relative;
    &::after {
      position: absolute;
      inset-block: 30%;
      inset-inline-start: 0;
      border-inline-start: 1px solid var(--color-divider);
      content: "";
    }
  }
  .add-icon {
    inline-size: 1rem;
    block-size: 1rem;
  }
  .with-pair .add-icon {
    inline-size: 1.5rem;
    block-size: 1.5rem;
  }
  .add :global(.action-icon) {
    font-size: 1.125rem;
  }
  :global(.folio) .section {
    margin-block: 0.25rem;
    border: 0;
    border-radius: var(--radius-control);
    background: color-mix(var(--identity) 10%, var(--panel));
  }
  :global(.folio) .toggle {
    padding-inline: 0.625rem;
  }
  :global(.folio) .restricted-heading {
    text-decoration: line-through;
  }
  :global(.folio) .restriction {
    display: none;
  }
  :global(.signal) .section {
    margin-block: 0.25rem;
    padding: 0 0.25rem 0.25rem;
    border: 0;
    border-radius: 1.25rem 0.5rem 1.25rem 0.5rem;
    background: color-mix(var(--identity) 12%, var(--background));
  }
  :global(.signal) .toggle {
    padding-inline: 0.625rem;
    border-radius: 1rem 0.25rem 1rem 0.25rem;
    background: var(--identity);
    color: var(--identity-ink);
  }
  :global(.signal) .chevron,
  :global(.signal) small {
    color: inherit;
  }
  :global(.signal) .action-button-icon {
    --kd-icon-text: var(--identity-ink);

    color: var(--identity);
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
