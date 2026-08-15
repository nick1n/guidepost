<script lang="ts">
  type Props = {
    tags: string[];
    onTagClick?: (tag: string) => void;
  };

  let { tags, onTagClick }: Props = $props();
</script>

<div class="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 py-1">
  {#each tags as tag (tag)}
    <button
      type="button"
      onclick={(event) => {
        event.stopPropagation();
        onTagClick?.(tag);
      }}
      class="shrink-0 cursor-pointer whitespace-nowrap rounded-lg bg-panel px-2 py-1 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {tag}
    </button>
  {/each}
</div>
