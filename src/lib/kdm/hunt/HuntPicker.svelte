<script module lang="ts">
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
</script>

<script lang="ts">
  import KdIcon from "#lib/components/KdIcon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import { selectDigit } from "./cards.ts";

  let { card, onselect }: { card: number; onselect: (card: number) => void } = $props();
  const id = $props.id();
  let dialog = $state<HTMLDialogElement>();
  let modal: Modal;
  let numberPlace = 10;
  let activePlace = 10;

  export function show() {
    if (!modal.show()) return;
    numberPlace = 10;
    activePlace = 10;
    dialog?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }

  function close() {
    modal.close();
  }

  function onfocusin(event: FocusEvent) {
    const column = (event.target as Element).closest<HTMLElement>("[data-place]");
    if (column) activePlace = Number(column.dataset.place);
    numberPlace = column ? activePlace : 10;
  }

  function selectedDigit(place: number) {
    return place === 10 ? Math.floor(card / 10) : card % 10;
  }

  function focusDigit(place: number, digit: number) {
    dialog?.querySelector<HTMLButtonElement>(`[data-place="${place}"] [data-digit="${digit}"]`)?.focus();
  }

  function chooseDigit(place: number, digit: number) {
    onselect(selectDigit(card, place, digit));
    focusDigit(place, digit);
  }

  function onkeydown(event: KeyboardEvent) {
    if (!dialog?.open || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) close();
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      if (event.repeat) return;
      chooseDigit(numberPlace, Number(event.key));
      numberPlace = numberPlace === 10 ? 1 : 10;
      focusDigit(numberPlace, selectedDigit(numberPlace));
      return;
    }
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-digit]");
    const place = button ? Number(button.closest<HTMLElement>("[data-place]")?.dataset.place) : activePlace;
    const index = digits.indexOf(selectedDigit(place));
    let digit: number;
    switch (event.key) {
      case "ArrowUp":
        digit = digits[(index + digits.length - 1) % digits.length];
        break;
      case "ArrowDown":
        digit = digits[(index + 1) % digits.length];
        break;
      case "Home":
        digit = digits[0];
        break;
      case "End":
        digit = digits[digits.length - 1];
        break;
      case "ArrowLeft":
      case "ArrowRight": {
        event.preventDefault();
        const next = event.key === "ArrowLeft" ? 10 : 1;
        focusDigit(next, selectedDigit(next));
        return;
      }
      default:
        return;
    }
    event.preventDefault();
    chooseDigit(place, digit);
  }
</script>

<Modal bind:this={modal} bind:element={dialog} title="Select hunt event" descriptionId={id + "-keys"} {onkeydown} {onfocusin}>
  <p id={id + "-keys"} class="visually-hidden">
    Use Up and Down to select a digit and Left and Right to switch columns. Number keys alternate between tens and ones. Enter or Escape
    closes the dialog.
  </p>
  <div class="dice">
    {#each [10, 1] as place (place)}
      {@const selected = selectedDigit(place)}
      <fieldset class={place === 1 ? "ones" : undefined} data-place={place}>
        <legend>{place === 10 ? "tens" : "ones"}</legend>
        <div class="stack">
          {#each digits as digit (digit)}
            <button
              class={["die", place === 10 && "light"]}
              type="button"
              aria-label={`${place === 10 ? "tens" : "ones"} ${digit}`}
              aria-pressed={selected === digit}
              tabindex={selected === digit ? 0 : -1}
              data-digit={digit}
              onclick={() => chooseDigit(place, digit)}
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
  {#snippet footer()}
    <button class="close" type="button" onclick={close}>Close</button>
  {/snippet}
</Modal>

<style>
  .close {
    inline-size: 100%;
    min-inline-size: var(--size-control);
    min-block-size: var(--size-control);
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
  .dice {
    --gap-dice: 2.5rem;
    /* Larger rotated dice need more edge space to keep their outlines inside the scroll area. */
    --space-dice: max(1rem, calc(var(--size-control) - 2rem));
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-content: center;
    justify-self: center;
    inline-size: calc(var(--size-control) * 42 / 11 + var(--gap-dice) + 2 * var(--space-dice));
    max-inline-size: 100%;
    min-block-size: 0;
    padding-inline: var(--space-dice);
    gap: var(--gap-dice);
  }
  fieldset {
    display: grid;
    justify-items: center;
    min-inline-size: 0;
  }
  fieldset:focus-within legend {
    position: relative;
    isolation: isolate;
    color: var(--accent-foreground);
    &::before,
    &::after {
      content: "";
      position: absolute;
      z-index: -1;
    }
    &::before {
      inset: 0 -0.75rem;
      background: var(--blue-4);
    }
    &::after {
      z-index: -2;
      inset: 0.25rem -1.25rem -0.25rem;
      background: var(--blue-5);
      clip-path: polygon(
        0 0,
        100% 0,
        calc(100% - 0.375rem) 50%,
        100% 100%,
        calc(100% - 0.625rem) 100%,
        calc(100% - 0.625rem) calc(100% - 0.25rem),
        0.625rem calc(100% - 0.25rem),
        0.625rem 100%,
        0 100%,
        0.375rem 50%
      );
    }
  }
  legend {
    margin-block-end: 1rem;
    font-weight: var(--font-bold);
    font-size: 1rem;
    text-align: center;
  }
  .stack {
    /* Preserve the original staggered geometry as the control size changes. */
    display: grid;
    grid-template-rows: repeat(9, calc(var(--size-control) * 9 / 11)) var(--size-control);
    inline-size: min(100%, calc(var(--size-control) * 21 / 11));
    padding-inline: 0.125rem;
    padding-block-end: calc(var(--size-control) * 9 / 22);
  }
  .die {
    display: grid;
    place-items: center;
    justify-self: end;
    inline-size: var(--size-control);
    block-size: var(--size-control);
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
      outline: var(--border-width) solid var(--accent);
      outline-offset: 0.125rem;
    }
    &:is([aria-pressed="true"], :hover, :focus-visible) {
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
</style>
