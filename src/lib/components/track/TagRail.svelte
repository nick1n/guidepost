<script lang="ts">
  type Props = {
    tags: string[];
    onTagClick?: (tag: string) => void;
  };

  let { tags, onTagClick }: Props = $props();

  function selectTag(event: MouseEvent, tag: string) {
    event.stopPropagation();
    onTagClick?.(tag);
  }
</script>

<div class="rail">
  {#each tags as tag (tag)}
    <button type="button" onclick={(event) => selectTag(event, tag)}>
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
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
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

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: var(--border-size);
    }
  }
</style>
