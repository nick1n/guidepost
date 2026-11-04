<script lang="ts">
  import { flushSync, type Snippet } from "svelte";
  import type { KeyboardEventHandler, FocusEventHandler } from "svelte/elements";
  import { createSwipeDismiss } from "#lib/swipe-dismiss.svelte.ts";
  import DragHandle from "./DragHandle.svelte";
  import InlineMarkdown from "./InlineMarkdown.svelte";

  let {
    title,
    description,
    descriptionId,
    children,
    footer,
    ondismiss,
    onconfirm,
    confirmLabel = "Confirm",
    variant = "primary",
    confirmDisabled = false,
    icon = variant === "destructive" ? "i-material-symbols:warning-outline" : undefined,
    onkeydown,
    onfocusin,
    element = $bindable(),
  }: {
    title: string;
    description?: string;
    descriptionId?: string;
    children?: Snippet;
    footer?: Snippet;
    ondismiss?: Noop;
    onconfirm?: Noop;
    confirmLabel?: string;
    variant?: "primary" | "destructive";
    confirmDisabled?: boolean;
    icon?: string;
    onkeydown?: KeyboardEventHandler<HTMLDialogElement>;
    onfocusin?: FocusEventHandler<HTMLDialogElement>;
    element?: HTMLDialogElement;
  } = $props();

  const id = $props.id();
  const describedBy = $derived(descriptionId ?? (description ? `${id}-description` : undefined));
  let open = $state(false);
  const dismissal = createSwipeDismiss(dismiss);

  export function show() {
    // Apply pending options before native focus and guard the sheet's full closing transition.
    flushSync();
    if (
      !element?.isConnected ||
      element.open ||
      element.getAnimations({ subtree: true }).some((animation) => animation.playState !== "finished")
    )
      return false;
    dismissal.reset();
    element.showModal();
    open = true;
    return true;
  }

  export function close() {
    if (!element?.open) return false;
    // Restore transitions before removing the native open state after a drag.
    flushSync(() => dismissal.reset());
    element.close();
    open = false;
    return true;
  }

  function dismiss() {
    if (close()) ondismiss?.();
  }

  function confirm() {
    if (!onconfirm || confirmDisabled || !close()) return;
    onconfirm();
  }

  function onclick(event: MouseEvent) {
    if (event.target === element) dismiss();
  }

  function oncancel(event: Event) {
    event.preventDefault();
    dismiss();
  }
</script>

<div class={["scrim", open && "is-open"]} aria-hidden="true"></div>
<dialog
  bind:this={element}
  aria-labelledby={id}
  aria-describedby={describedBy}
  data-dragging={dismissal.distance > 0}
  style:--drag={dismissal.distance + "px"}
  style:--color-modal-accent={variant === "destructive" ? "var(--destructive)" : "var(--accent)"}
  {onclick}
  {oncancel}
  {onkeydown}
  {onfocusin}
  {@attach dismissal.attach}
>
  <div class="sheet">
    <header data-drag-handle>
      <DragHandle />
      <h2 {id} style:justify-self={description || icon ? "stretch" : "center"}>
        {title}
        {#if icon}<span class={["icon", icon]} aria-hidden="true"></span>{/if}
      </h2>
    </header>
    <div class="body">
      {#if description}
        <div class="content">
          <p id={describedBy}><InlineMarkdown text={description} /></p>
          {@render children?.()}
        </div>
      {:else}
        {@render children?.()}
      {/if}
    </div>
    <footer>
      {#if footer}
        {@render footer()}
      {:else if onconfirm}
        <div class="actions">
          <button class="action" type="button" onclick={dismiss}>Cancel</button>
          <button class="action confirm" type="button" onclick={confirm} disabled={confirmDisabled}>{confirmLabel}</button>
        </div>
      {/if}
    </footer>
  </div>
</dialog>

<style>
  .scrim {
    visibility: hidden;
    z-index: 7;
    position: fixed;
    inset: 0;
    background: #00000080;
    opacity: 0;
    transition:
      opacity var(--duration-fast),
      visibility var(--duration-fast);

    &.is-open {
      visibility: visible;
      opacity: 1;
    }
  }
  dialog {
    inline-size: max-content;
    max-inline-size: calc(100% - 2rem);
    max-block-size: calc(var(--viewport-height) - 2rem);
    margin: auto;
    padding: 0;
    overflow: visible;
    border: 0;
    background: transparent;
    color: var(--foreground);
    transition:
      display var(--duration-fast),
      overlay var(--duration-fast);
    transition-behavior: allow-discrete;
    &[open] {
      display: grid;
    }
    &::backdrop {
      background: transparent;
    }
  }
  .sheet {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-block-size: 0;
    max-block-size: inherit;
    translate: 0 calc(50dvh + 50%);
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-card);
    backdrop-filter: var(--filter-glass);
    background: var(--surface-glass);
    box-shadow:
      0 1rem 4rem #00000099,
      inset 0 1px #ffffff0a;
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--ease-standard),
      translate var(--duration-fast) var(--ease-standard);
  }
  dialog[open] .sheet {
    translate: 0 var(--drag);
    opacity: 1;
  }
  dialog[data-dragging="true"] .sheet {
    transition: none;
  }
  header {
    display: grid;
    justify-items: center;
    padding: 0 1rem;
    gap: 0.5rem;
  }
  h2 {
    display: flex;
    align-items: center;
    /* Reserve the scaled icon's extra width without increasing the heading's height. */
    gap: calc(var(--size-icon-control) + 0.5rem);
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    font-family: var(--font-display);
  }

  .body {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: minmax(0, 1fr);
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }
  footer {
    padding: 0.5rem 1rem 1rem;
  }
  .content {
    display: grid;
    inline-size: min(24rem, calc(100vw - 4rem));
    padding: 1rem;
    gap: 1rem;
    text-align: start;
  }
  .icon {
    --size-icon: var(--size-icon-control);
    flex: none;
    margin-inline-start: auto;
    transform-origin: right;
    scale: 2;
    color: var(--color-modal-accent);
  }
  p {
    color: var(--muted-foreground);
    text-wrap: pretty;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .action {
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
    padding-inline: 0.875rem;
    border: var(--border-width) solid var(--muted-foreground);
    border-radius: var(--radius-control);
    font-weight: var(--font-semibold);
    transition:
      border-color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);

    &:is(:hover, :focus-visible) {
      border-color: var(--foreground);
      color: var(--foreground);
    }

    &.confirm {
      border-color: var(--color-modal-accent);
      background: var(--color-modal-accent);
      color: var(--contrast);

      &:is(:hover, :focus-visible) {
        border-color: var(--foreground);
        background: var(--foreground);
        color: var(--contrast);
      }
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }
  }
  @starting-style {
    dialog[open] .sheet {
      translate: 0 calc(50dvh + 50%);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet,
    dialog[open] .sheet {
      translate: 0 var(--drag);
    }
  }
</style>
