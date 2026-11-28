<script lang="ts">
  import { parseMarkdown } from "#lib/markdown.ts";
  import InlineMarkdown from "./InlineMarkdown.svelte";

  let { text }: { text: string } = $props();
  const blocks = $derived(parseMarkdown(text));
</script>

{#each blocks as block (block)}
  {#if block.kind === "paragraph"}
    <p><InlineMarkdown text={block.text} /></p>
  {:else}
    <hr />
  {/if}
{/each}

<style>
  p {
    white-space: pre-line;
  }

  :is(p, hr) + :is(p, hr) {
    margin-block-start: 0.75em;
  }

  hr {
    border-color: var(--color-divider);
  }
</style>
