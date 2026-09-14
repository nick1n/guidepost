<script lang="ts">
  import { Effect } from "effect";
  import type { Snippet } from "svelte";
  import { DURATION_FAST } from "#lib/constants.ts";

  type DialogFailure = {
    readonly message: string;
  };

  type Props = {
    title: string;
    description: string;
    onconfirm: () => Effect.Effect<unknown, DialogFailure>;
    onconfirmed?: () => Effect.Effect<unknown, DialogFailure>;
    oncancel?: () => Effect.Effect<unknown, unknown>;
    children?: Snippet;
    confirmLabel?: string;
    pendingLabel?: string;
    retryLabel?: string;
    cancelLabel?: string;
    icon?: string;
  };

  let {
    title,
    description,
    onconfirm,
    onconfirmed,
    oncancel,
    children,
    confirmLabel = "Confirm",
    pendingLabel = "Working…",
    retryLabel = "Continue",
    cancelLabel = "Cancel",
    icon = "i-material-symbols:warning-outline",
  }: Props = $props();

  const id = $props.id();
  let dialog: HTMLDialogElement;
  let pending = $state(false);
  let errorMessage = $state<string | undefined>();
  let confirmed = $state(false);
  let closing = false;
  const confirmButtonLabel = $derived.by(() => {
    if (pending) return pendingLabel;
    if (confirmed) return retryLabel;
    return confirmLabel;
  });

  function reportUnexpected(cause: unknown) {
    console.error("Unexpected dialog failure", cause);
  }

  export function show() {
    if (dialog.open || closing || pending) return;

    errorMessage = undefined;
    pending = false;
    confirmed = false;
    dialog.showModal();
    queueMicrotask(() => dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus());
  }

  export function close(returnValue?: string) {
    return Effect.callback((resume) => {
      if (!dialog.open || closing) {
        resume(Effect.void);
        return;
      }

      closing = true;
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;

      const finish = () => {
        if (settled) return;
        settled = true;
        dialog.removeEventListener("transitionend", ontransitionend);
        clearTimeout(timeout);
        closing = false;
        resume(Effect.void);
      };

      function ontransitionend(event: TransitionEvent) {
        if (event.target === dialog && event.propertyName === "opacity") finish();
      }

      dialog.addEventListener("transitionend", ontransitionend);
      dialog.close(returnValue);
      timeout = setTimeout(finish, DURATION_FAST + 50);

      return Effect.sync(() => {
        settled = true;
        dialog.removeEventListener("transitionend", ontransitionend);
        clearTimeout(timeout);
        closing = false;
      });
    });
  }

  function showError(message: string) {
    errorMessage = message;
  }

  function showFollowUpError(message: string) {
    errorMessage = message;
    if (!dialog.open) dialog.showModal();
    queueMicrotask(() => dialog.querySelector<HTMLButtonElement>(".confirm")?.focus());
  }

  function handleConfirmError(error: DialogFailure) {
    return Effect.sync(() => showError(error.message));
  }

  function handleFollowUpError(error: DialogFailure) {
    return Effect.sync(() => showFollowUpError(error.message));
  }

  function handleConfirmCause(cause: unknown) {
    return Effect.sync(() => {
      reportUnexpected(cause);
      showError("We couldn't save that change. Please try again.");
    });
  }

  function handleFollowUpCause(cause: unknown) {
    return Effect.sync(() => {
      reportUnexpected(cause);
      showFollowUpError("The change was saved, but the next page could not be opened. Please try again.");
    });
  }

  function confirm() {
    if (pending) return;

    pending = true;
    errorMessage = undefined;

    const confirmation = confirmed
      ? Effect.void
      : Effect.suspend(onconfirm).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              confirmed = true;
            }),
          ),
        );
    const followUp = onconfirmed
      ? close("confirm").pipe(
          Effect.andThen(Effect.suspend(onconfirmed)),
          Effect.catch(handleFollowUpError),
          Effect.catchCause(handleFollowUpCause),
        )
      : close("confirm");

    Effect.runFork(
      confirmation.pipe(
        Effect.andThen(followUp),
        Effect.catch(handleConfirmError),
        Effect.catchCause(handleConfirmCause),
        Effect.ensuring(
          Effect.sync(() => {
            pending = false;
          }),
        ),
      ),
    );
  }

  function cancel() {
    if (pending || closing) return;

    errorMessage = undefined;
    Effect.runFork(
      Effect.gen(function* () {
        yield* close("cancel");
        if (oncancel) yield* Effect.suspend(oncancel);
      }).pipe(Effect.catchCause((cause) => Effect.sync(() => reportUnexpected(cause)))),
    );
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
  aria-describedby={errorMessage ? `${id}-description ${id}-error` : `${id}-description`}
  aria-busy={pending}
  oncancel={handleCancel}
  {onclick}
>
  <form method="dialog">
    <div class="heading">
      <h2 id={`${id}-title`}>{title}</h2>
      <span class={["icon", icon]} aria-hidden="true"></span>
    </div>
    <p id={`${id}-description`}>{description}</p>
    <fieldset disabled={pending || confirmed}>
      <legend class="visually-hidden">Dialog options</legend>
      {@render children?.()}
    </fieldset>
    {#if errorMessage}
      <p class="error" id={`${id}-error`} role="alert">{errorMessage}</p>
    {/if}
    <div class="actions">
      <button class="action" type="button" onclick={cancel} disabled={pending}>{cancelLabel}</button>
      <button class="action confirm" type="button" onclick={confirm} disabled={pending}>
        {confirmButtonLabel}
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

  form {
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
