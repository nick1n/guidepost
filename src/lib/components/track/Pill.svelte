<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    tone?: "neutral" | "accent" | "outline";
    onclick?: () => void;
    active?: boolean;
    children: Snippet;
  };

  let { tone = "neutral", onclick, active = false, children }: Props = $props();

  const classes = $derived([
    "inline-flex items-center rounded-lg px-2 py-1 transition-colors",
    tone === "accent" && "text-foreground bg-black",
    tone === "neutral" && "bg-panel text-foreground/80",
    tone === "outline" && "border-foreground/25 text-muted-foreground border",
    onclick && "hover:bg-accent hover:text-accent-foreground cursor-pointer",
    active && "bg-accent text-accent-foreground",
  ]);
</script>

{#if onclick}
  <button type="button" aria-pressed={active} {onclick} class={classes}>
    {@render children()}
  </button>
{:else}
  <span class={classes}>{@render children()}</span>
{/if}
