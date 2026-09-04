<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    title: string;
    description: string;
    onconfirm: () => void | Promise<void>;
    onconfirmed?: () => void | Promise<void>;
    oncancel?: () => void | Promise<void>;
    children?: Snippet;
    confirmLabel?: string;
    confirmingLabel?: string;
    cancelLabel?: string;
    icon?: string;
  };

  let {
    title,
    description,
    onconfirm,
    onconfirmed,
    oncancel: oncancelCallback,
    children,
    confirmLabel = "Confirm",
    confirmingLabel = "Working…",
    cancelLabel = "Cancel",
    icon = "i-material-symbols:warning-outline",
  }: Props = $props();

  const id = $props.id();
  let dialog: HTMLDialogElement;
  let confirming = $state(false);
  let errorMessage = $state<string | undefined>();
  let closePromise: Promise<void> | undefined;

  export function show() {
    if (dialog.open || closePromise) return;

    errorMessage = undefined;
    confirming = false;
    dialog.showModal();
    queueMicrotask(() => dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus());
  }

  function parseTime(value: string) {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return 0;
    return value.trim().endsWith("ms") ? amount : amount * 1000;
  }

  function closeDuration() {
    const styles = getComputedStyle(dialog);
    const duration = styles.transitionDuration.split(",")[0] ?? "0s";
    const delay = styles.transitionDelay.split(",")[0] ?? "0s";
    return parseTime(duration) + parseTime(delay);
  }

  export function close(returnValue?: string) {
    if (!dialog.open) return closePromise ?? Promise.resolve();
    if (closePromise) return closePromise;

    const duration = closeDuration();
    if (duration <= 0) {
      dialog.close(returnValue);
      return Promise.resolve();
    }

    closePromise = new Promise<void>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;

      const finish = () => {
        if (settled) return;
        settled = true;
        dialog.removeEventListener("transitionend", ontransitionend);
        clearTimeout(timeout);
        closePromise = undefined;
        resolve();
      };

      function ontransitionend(event: TransitionEvent) {
        if (event.target === dialog && event.propertyName === "opacity") finish();
      }

      dialog.addEventListener("transitionend", ontransitionend);
      dialog.close(returnValue);
      timeout = setTimeout(finish, duration + 50);
    });

    return closePromise;
  }

  async function confirm() {
    if (confirming) return;

    confirming = true;
    errorMessage = undefined;

    try {
      await onconfirm();
    } catch {
      errorMessage = "We couldn't save that change. Please try again.";
      confirming = false;
      return;
    }

    await close("confirm");
    confirming = false;
    await onconfirmed?.();
  }

  async function cancel() {
    if (confirming) return;

    errorMessage = undefined;
    await close("cancel");
    await oncancelCallback?.();
  }

  function onclick(event: MouseEvent) {
    if (event.target === event.currentTarget) cancel();
  }

  function oncancel(event: Event) {
    event.preventDefault();
    void cancel();
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={`${id}-title`}
  aria-describedby={errorMessage ? `${id}-description ${id}-error` : `${id}-description`}
  aria-busy={confirming}
  {onclick}
  {oncancel}
>
  <form method="dialog">
    <div class="heading">
      <h2 id={`${id}-title`}>{title}</h2>
      <span class={["icon", icon]} aria-hidden="true"></span>
    </div>
    <p id={`${id}-description`}>{description}</p>
    <fieldset disabled={confirming}>
      <legend class="visually-hidden">Dialog options</legend>
      {@render children?.()}
    </fieldset>
    {#if errorMessage}
      <p class="error" id={`${id}-error`} role="alert">{errorMessage}</p>
    {/if}
    <div class="actions">
      <button class="action" type="button" onclick={cancel} disabled={confirming}>{cancelLabel}</button>
      <button class="action confirm" type="button" onclick={confirm} disabled={confirming}>
        {confirming ? confirmingLabel : confirmLabel}
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    --accent: var(--secondary);
    --accent-foreground: var(--contrast);

    inline-size: min(26rem, calc(100% - 2rem));
    margin: auto;
    border: var(--border-size) solid var(--accent);
    padding: 0;
    background: var(--popover);
    color: var(--popover-foreground);
    box-shadow: 0 1.5rem 4rem #0009;
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

  form {
    display: grid;
    padding: clamp(1rem, 4vw, 1.5rem);
    gap: 1rem;
  }

  fieldset {
    min-inline-size: 0;
    border: 0;
    margin: 0;
    padding: 0;
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
    color: var(--accent);
    margin-inline-start: auto;
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

    &.error {
      color: var(--accent-red);
      font-size: var(--text-sm);
    }
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .action {
    min-block-size: 2.5rem;
    border: var(--border-size) solid var(--muted-foreground);
    border-radius: var(--radius-control);
    padding-inline: 0.875rem;
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
      cursor: wait;
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
