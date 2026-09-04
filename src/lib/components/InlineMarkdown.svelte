<script lang="ts">
  type Segment = { kind: "text"; value: string } | { kind: "strong" | "em"; value: string };

  type Props = {
    text: string;
  };

  const pattern = /\*\*[^*\r\n]+\*\*|\*[^*\r\n]+\*/g;

  let { text }: Props = $props();
  const segments = $derived(parseInline(text));

  function parseInline(source: string): Segment[] {
    const segments: Segment[] = [];
    let textStart = 0;

    for (const match of source.matchAll(pattern)) {
      const value = match[0];
      const start = match.index ?? 0;
      const delimiterSize = value.startsWith("**") ? 2 : 1;

      if (start > textStart) {
        segments.push({ kind: "text", value: source.slice(textStart, start) });
      }

      segments.push({
        kind: delimiterSize === 2 ? "strong" : "em",
        value: value.slice(delimiterSize, -delimiterSize),
      });

      textStart = start + value.length;
    }

    if (textStart < source.length) {
      segments.push({ kind: "text", value: source.slice(textStart) });
    }

    return segments;
  }
</script>

{#each segments as segment}
  {#if segment.kind === "strong"}
    <strong>{segment.value}</strong>
  {:else if segment.kind === "em"}
    <em>{segment.value}</em>
  {:else}
    {segment.value}
  {/if}
{/each}
