<script lang="ts">
  type Props = {
    tags: string[];
    onTagClick?: (tag: string) => void;
  };

  let { tags, onTagClick }: Props = $props();

  let dragging = $state(false);
  let dragged = false;
  let startX = 0;
  let startScrollLeft = 0;

  function selectTag(event: MouseEvent, tag: string) {
    event.stopPropagation();

    if (dragged) {
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
      rail.setPointerCapture(event.pointerId);
    }

    function onpointermove(event: PointerEvent) {
      if (!dragging) return;

      const distance = event.clientX - startX;
      if (!dragged && Math.abs(distance) < 4) return;

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

<div class={["rail", dragging && "is-dragging"]} {@attach dragScroll}>
  {#each tags as tag (tag)}
    <button type="button" onclick={(event) => selectTag(event, tag)} class={[dragging && "is-dragging"]}>
      {tag}
    </button>
  {/each}
</div>

<style>
  .rail {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    margin-inline: -0.75rem;
    padding: 0.25rem 0.75rem;
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
    padding: 0.25rem 0.5rem;
    background: var(--panel);
    color: var(--foreground);
    white-space: nowrap;
    transition:
      color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard);

    &:hover {
      background: var(--accent);
      color: var(--accent-foreground);
    }

    &.is-dragging {
      cursor: grabbing;
    }
  }
</style>
