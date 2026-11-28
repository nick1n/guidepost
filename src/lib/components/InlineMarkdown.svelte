<script lang="ts">
  import { parseInline } from "#lib/inline-markdown.ts";
  import KdIcon from "./KdIcon.svelte";

  type Props = {
    text: string;
  };

  let { text }: Props = $props();
  const segments = $derived(parseInline(text));
</script>

{#each segments as segment}
  {#if segment.kind === "strong"}
    <strong>{segment.value}</strong>
  {:else if segment.kind === "em"}
    <em>{segment.value}</em>
  {:else if segment.kind === "icon"}
    <KdIcon i={segment.value} />
  {:else}
    {segment.value}
  {/if}
{/each}
