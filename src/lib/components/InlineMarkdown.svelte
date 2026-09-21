<script module lang="ts">
  import { KD_ICONS, type KdIconName } from "#lib/constants.ts";

  const pattern = /\*\*[^*\r\n]+\*\*|\*[^*\r\n]+\*|\[[a-z0-9-]+\]/g;
</script>

<script lang="ts">
  import KdIcon from "./KdIcon.svelte";

  type Segment =
    | {
        kind: "text" | "strong" | "em";
        value: string;
      }
    | { kind: "icon"; value: KdIconName };

  type Props = {
    text: string;
  };

  let { text }: Props = $props();
  const segments = $derived(parseInline(text));

  function parseInline(source: string): Segment[] {
    const segments: Segment[] = [];
    let textStart = 0;

    for (const match of source.matchAll(pattern)) {
      const value = match[0];
      const start = match.index;
      const delimiterSize = value.startsWith("**") ? 2 : 1;

      if (start > textStart) {
        segments.push({ kind: "text", value: source.slice(textStart, start) });
      }

      if (value.startsWith("[")) {
        const name = value.slice(1, -1);
        segments.push(Object.hasOwn(KD_ICONS, name) ? { kind: "icon", value: name as KdIconName } : { kind: "text", value });
      } else {
        segments.push({
          kind: delimiterSize === 2 ? "strong" : "em",
          value: value.slice(delimiterSize, -delimiterSize),
        });
      }

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
  {:else if segment.kind === "icon"}
    <KdIcon i={segment.value} />
  {:else}
    {segment.value}
  {/if}
{/each}
