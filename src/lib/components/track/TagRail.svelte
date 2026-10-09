<script lang="ts">
  import { identity } from "#lib/constants.ts";

  type Props = {
    tags: string[];
    selectedTags?: string[];
    label?: string;
    onTagClick?: (tag: string) => void;
    tagLabel?: (tag: string) => string;
  };

  let { tags, selectedTags, label, onTagClick, tagLabel = identity }: Props = $props();

  let dragging = $state(false);
  let dragged = false;
  let startX = 0;
  let startScrollLeft = 0;

  function selectTag(event: MouseEvent, tag: string) {
    if (dragged && event.detail !== 0) {
      event.preventDefault();
      dragged = false;
      return;
    }

    onTagClick?.(tag);
  }

  function dragScroll(rail: HTMLDivElement) {
    function onpointerdown(event: PointerEvent) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;

      dragging = true;
      dragged = false;
      startX = event.clientX;
      startScrollLeft = rail.scrollLeft;
    }

    function onpointermove(event: PointerEvent) {
      if (!dragging) return;

      const distance = event.clientX - startX;
      if (!dragged && Math.abs(distance) < 4) return;

      if (!dragged) rail.setPointerCapture(event.pointerId);
      dragged = true;
      event.preventDefault();
      rail.scrollLeft = startScrollLeft - distance;
    }

    function finishDrag(event: PointerEvent) {
      if (!dragging) return;

      dragging = false;
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    }

    function onlostpointercapture() {
      dragging = false;
    }

    rail.addEventListener("pointerdown", onpointerdown);
    rail.addEventListener("pointermove", onpointermove);
    rail.addEventListener("pointerup", finishDrag);
    rail.addEventListener("pointercancel", finishDrag);
    rail.addEventListener("lostpointercapture", onlostpointercapture);

    return () => {
      rail.removeEventListener("pointerdown", onpointerdown);
      rail.removeEventListener("pointermove", onpointermove);
      rail.removeEventListener("pointerup", finishDrag);
      rail.removeEventListener("pointercancel", finishDrag);
      rail.removeEventListener("lostpointercapture", onlostpointercapture);
    };
  }
</script>

<div class={["rail", dragging && "is-dragging"]} aria-label={label} {@attach dragScroll}>
  {#each tags as tag (tag)}
    <button
      type="button"
      aria-pressed={selectedTags ? selectedTags.includes(tag) : undefined}
      onclick={(event) => selectTag(event, tag)}
      class={[dragging && "is-dragging"]}
    >
      {tagLabel(tag)}
    </button>
  {/each}
</div>

<style>
  .rail {
    display: flex;
    gap: var(--tag-gap, 0.5rem);
    min-inline-size: 0;
    overflow-x: auto;
    margin-inline: var(--tag-margin, -0.75rem);
    padding: var(--tag-rail-padding, 0.25rem 0.75rem);
    cursor: grab;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    &.is-dragging {
      cursor: grabbing;
      user-select: none;
    }
  }

  button {
    flex-shrink: 0;
    border-radius: var(--radius-control);
    padding: var(--tag-padding, 0.25rem 0.5rem);
    background: var(--panel);
    color: var(--tag-color, var(--foreground));
    font-size: var(--tag-font-size, inherit);
    white-space: nowrap;
    transition:
      color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard);

    &[aria-pressed="true"] {
      background: var(--accent);
      color: var(--accent-foreground);
    }

    &.is-dragging {
      cursor: grabbing;
    }
  }
  @media (hover: hover) {
    button:not(.is-dragging):hover {
      background: var(--accent);
      color: var(--accent-foreground);
    }
  }
</style>
