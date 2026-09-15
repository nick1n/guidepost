<script lang="ts">
  import { onDestroy, type Snippet } from "svelte";
  import { DURATION_FAST } from "#lib/constants.ts";

  type Props = {
    title: string;
    description: string;
    onconfirm: () => void;
    oncancel?: () => void;
    children?: Snippet;
    confirmLabel?: string;
    confirmDisabled?: boolean;
    cancelLabel?: string;
    icon?: string;
  };

  let {
    title,
    description,
    onconfirm,
    oncancel,
    children,
    confirmLabel = "Confirm",
    confirmDisabled = false,
    cancelLabel = "Cancel",
    icon = "i-material-symbols:warning-outline",
  }: Props = $props();

  const id = $props.id();
  let dialog: HTMLDialogElement;
  let closing = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => clearTimeout(closeTimer));

  export function show() {
    if (dialog.open || closing) return;
    dialog.showModal();
    queueMicrotask(() => {
      if (dialog.open) dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();
    });
  }

  export function close(returnValue?: string) {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.close(returnValue);
    closeTimer = setTimeout(finishClose, DURATION_FAST + 50);
  }

  function finishClose() {
    clearTimeout(closeTimer);
    closing = false;
  }

  function ontransitionend(event: TransitionEvent) {
    if (closing && event.target === dialog && event.propertyName === "opacity") finishClose();
  }

  function confirm() {
    if (!dialog.open || closing || confirmDisabled) return;
    close("confirm");
    onconfirm();
  }

  function cancel() {
    if (!dialog.open || closing) return;
    close("cancel");
    oncancel?.();
  }

  function onclick(event: MouseEvent) {
    if (event.target === event.currentTarget) cancel();
  }

  function handleCancel(event: Event) {
    event.preventDefault();
    cancel();
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={`${id}-title`}
  aria-describedby={`${id}-description`}
  oncancel={handleCancel}
  {onclick}
  {ontransitionend}
>
  <div class="content">
    <div class="heading">
      <h2 id={`${id}-title`}>{title}</h2>
      <span class={["icon", icon]} aria-hidden="true"></span>
    </div>
    <p id={`${id}-description`}>{description}</p>
    {#if children}
      <fieldset>
        <legend class="visually-hidden">Dialog options</legend>
        {@render children()}
      </fieldset>
    {/if}
    <div class="actions">
      <button class="action" type="button" onclick={cancel}>{cancelLabel}</button>
      <button class="action confirm" type="button" onclick={confirm} disabled={confirmDisabled}>
        {confirmLabel}
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    --accent: var(--secondary);
    --accent-foreground: var(--contrast);

    inline-size: min(26rem, calc(100% - 2rem));
    margin: auto;
    padding: 0;
    border: var(--border-size) solid var(--accent);
    background: var(--popover);
    box-shadow: 0 1.5rem 4rem #0009;
    color: var(--popover-foreground);
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--ease-standard),
      translate var(--duration-fast) var(--ease-standard),
      display var(--duration-fast),
      overlay var(--duration-fast);
    transition-behavior: allow-discrete;

    &[open] {
      opacity: 1;
    }

    &::backdrop {
      background: transparent;
      transition:
        background-color var(--duration-fast) var(--ease-standard),
        display var(--duration-fast),
        overlay var(--duration-fast);
      transition-behavior: allow-discrete;
    }

    &[open]::backdrop {
      background: #000b;
    }
  }

  .content {
    display: grid;
    padding: clamp(1rem, 4vw, 1.5rem);
    gap: 1rem;
  }

  fieldset {
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .heading {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 1rem;
  }

  .icon {
    display: inline-block;
    inline-size: 2rem;
    block-size: 2rem;
    margin-inline-start: auto;
    color: var(--accent);
  }

  h2 {
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    line-height: var(--line-height-tight);
    font-family: var(--font-display);
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
    min-block-size: 2.5rem;
    padding-inline: 0.875rem;
    border: var(--border-size) solid var(--muted-foreground);
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
      border-color: var(--accent);
      background: var(--accent);
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
    dialog[open] {
      translate: 1.5rem 0;
      opacity: 0;
    }

    dialog[open]::backdrop {
      background: transparent;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    dialog,
    dialog::backdrop {
      transition: none;
    }

    .action {
      transition: none;
    }
  }
</style>
