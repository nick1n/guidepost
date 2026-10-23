<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { prefersReducedMotion as reducedMotion } from "svelte/motion";
  import { DURATION_FAST } from "#lib/constants.ts";
  import { createSwipeDismiss } from "#lib/swipe-dismiss.svelte.ts";
  import KdIcon from "#lib/components/KdIcon.svelte";
  import { selectDigit } from "./cards.ts";

  let { card, onselect }: { card: number; onselect: (card: number) => void } = $props();
  const id = $props.id();
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  let dialog: HTMLDialogElement;
  let closing = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const dismissal = createSwipeDismiss(close);

  onDestroy(() => clearTimeout(closeTimer));

  export function show() {
    if (dialog.open || closing) return;
    dismissal.reset();
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }

  async function close() {
    if (!dialog.open || closing) return;
    closing = true;
    dismissal.reset();
    // Re-enable transitions after dragging before removing the native open state.
    await tick();
    if (!dialog.isConnected) return;
    dialog.close();
    closeTimer = setTimeout(finishClose, reducedMotion.current ? 0 : DURATION_FAST + 50);
  }

  function finishClose() {
    clearTimeout(closeTimer);
    closing = false;
  }

  function ontransitionend(event: TransitionEvent) {
    if (closing && !dialog.open && event.target === dialog && event.propertyName === "translate") finishClose();
  }

  function onclick(event: MouseEvent) {
    if (event.target === dialog) close();
  }

  function oncancel(event: Event) {
    event.preventDefault();
    close();
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={`${id}-title`}
  data-dragging={dismissal.distance > 0}
  style:--drag={`${dismissal.distance}px`}
  {onclick}
  {oncancel}
  {ontransitionend}
  {@attach dismissal.attach}
>
  <header data-drag-handle>
    <span class="grip" aria-hidden="true"></span>
    <h2 id={`${id}-title`}>Select hunt event</h2>
  </header>
  <div class="dice">
    {#each [10, 1] as place (place)}
      <fieldset class={place === 1 ? "ones" : undefined}>
        <legend>{place === 10 ? "Tens" : "Ones"}</legend>
        <div class="stack">
          {#each digits as digit (digit)}
            <button
              class={["die", place === 10 && "light"]}
              type="button"
              aria-label={`${place === 10 ? "Tens" : "Ones"} ${digit}`}
              aria-pressed={(place === 10 ? Math.floor(card / 10) % 10 : card % 10) === digit}
              onclick={() => onselect(selectDigit(card, place, digit))}
            >
              <span>
                {#if digit === 0}<KdIcon i="lantern" />{:else}{digit}{/if}
              </span>
            </button>
          {/each}
        </div>
      </fieldset>
    {/each}
  </div>
  <footer><button class="close" type="button" onclick={close}>Close</button></footer>
</dialog>

<style>
  dialog {
    grid-template-rows: auto minmax(0, 1fr) auto;
    inline-size: max-content;
    max-inline-size: calc(100% - 2rem);
    max-block-size: calc(100dvh - 2rem);
    margin: auto;
    padding: 0;
    translate: 0 calc(50dvh + 50%);
    border: var(--border-width) solid var(--grey-6);
    border-radius: var(--radius-card);
    background: var(--panel);
    box-shadow: 0 1.5rem 4rem #00000099;
    color: var(--foreground);
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--ease-standard),
      translate var(--duration-fast) var(--ease-standard),
      display var(--duration-fast),
      overlay var(--duration-fast);
    transition-behavior: allow-discrete;
    &[open] {
      display: grid;
      translate: 0 var(--drag);
      opacity: 1;
    }
    &[data-dragging="true"] {
      transition: none;
    }
    &::backdrop {
      background: #000000b3;
    }
  }
  header {
    display: grid;
    justify-items: center;
    padding: 0.75rem 1rem 1rem;
    gap: 0.75rem;
    cursor: grab;
    touch-action: none;
  }
  .grip {
    inline-size: 2.5rem;
    block-size: 0.25rem;
    border-radius: var(--radius-control);
    background: var(--grey-6);
  }
  h2 {
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    font-family: var(--font-display);
  }
  .close {
    inline-size: 100%;
    min-block-size: 2.75rem;
    padding: 0.5rem 1rem;
    border: var(--border-width) solid var(--grey-6);
    border-radius: var(--radius-control);
    background: var(--card);
    font-weight: var(--font-bold);
    touch-action: pan-x;
    transition: var(--transition-colors);
    &:is(:hover, :focus-visible) {
      border-color: var(--grey-4);
      background: var(--grey-7);
    }
  }
  footer {
    padding: 0.5rem 1rem 1rem;
  }
  .dice {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    justify-content: center;
    min-block-size: 0;
    padding-inline: 1rem;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    gap: 2.5rem;
  }
  fieldset {
    display: grid;
    justify-items: center;
    min-inline-size: 0;
  }
  legend {
    margin-block-end: 1rem;
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-align: center;
  }
  .stack {
    display: grid;
    grid-template-rows: repeat(9, 2.25rem) 2.75rem;
    inline-size: 5.25rem;
    padding-inline: 0.125rem;
    padding-block-end: 1.125rem;
  }
  .die {
    display: grid;
    place-items: center;
    justify-self: end;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    rotate: 45deg;
    border: var(--border-width) solid var(--grey-4);
    border-radius: var(--radius-control);
    background: var(--background);
    color: var(--foreground);
    font-weight: var(--font-bold);
    font-size: var(--text-xl);
    line-height: var(--line-height-none);
    font-variant-numeric: tabular-nums;
    transition: var(--transition-colors);
    &:nth-child(even) {
      justify-self: start;
    }
    &.light {
      background: var(--grey-0);
      color: var(--contrast);
    }
    &[aria-pressed="true"] {
      border-color: var(--accent);
      outline: var(--border-width) solid var(--accent);
      outline-offset: 0.25rem;
      box-shadow: 0 0 1rem color-mix(var(--accent) 40%, transparent);
    }
    &:is(:hover, :focus-visible) {
      border-color: var(--accent);
      box-shadow: 0 0 1rem color-mix(var(--accent) 40%, transparent);
    }
    & > span {
      display: grid;
      place-items: center;
      inline-size: 100%;
      block-size: 100%;
      rotate: -45deg;
    }
  }
  .ones .die {
    justify-self: start;
    &:nth-child(even) {
      justify-self: end;
    }
  }
  @starting-style {
    dialog[open] {
      translate: 0 calc(50dvh + 50%);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    dialog,
    dialog[open] {
      translate: 0 var(--drag);
    }
  }
</style>
