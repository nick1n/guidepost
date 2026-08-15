<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    tone?: "neutral" | "accent" | "outline";
    onclick?: () => void;
    active?: boolean;
    children: Snippet;
  };

  let { tone = "neutral", onclick, active = false, children }: Props = $props();

  const className = $derived([
    "inline-flex items-center rounded-lg px-2 py-1 transition-colors",
    tone === "accent" && "bg-black text-foreground",
    tone === "neutral" && "bg-panel text-foreground/80",
    tone === "outline" && "border border-foreground/25 text-muted-foreground",
    onclick && "cursor-pointer hover:bg-accent hover:text-accent-foreground",
    active && "bg-accent text-accent-foreground",
  ]);
</script>

{#if onclick}
  <button type="button" aria-pressed={active} {onclick} class={className}>
    {@render children()}
  </button>
{:else}
  <span class={className}>{@render children()}</span>
{/if}
