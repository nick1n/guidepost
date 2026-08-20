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

<div class="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 py-1">
  {#each tags as tag (tag)}
    <button
      type="button"
      onclick={(event) => selectTag(event, tag)}
      class="bg-panel text-foreground hover:bg-accent hover:text-accent-foreground shrink-0 cursor-pointer rounded-lg px-2 py-1 whitespace-nowrap transition-colors"
    >
      {tag}
    </button>
  {/each}
</div>
