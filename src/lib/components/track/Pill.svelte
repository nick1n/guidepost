<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    tone?: "neutral" | "accent" | "outline";
    onclick?: () => void;
    children: Snippet;
  };

  let { tone = "neutral", onclick, children }: Props = $props();
</script>

{#if onclick}
  <button type="button" {onclick} class="pill" data-tone={tone}>
    {@render children()}
  </button>
{:else}
  <span class="pill" data-tone={tone}>{@render children()}</span>
{/if}

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-control);
    padding: 0.25rem 0.5rem;
    transition:
      color var(--duration-fast) var(--ease-standard),
      background-color var(--duration-fast) var(--ease-standard);

    &[data-tone="accent"] {
      background: var(--contrast);
      color: var(--foreground);
    }

    &[data-tone="neutral"] {
      background: var(--panel);
      color: color-mix(var(--foreground) 80%, transparent);
    }

    &[data-tone="outline"] {
      border: 1px solid color-mix(var(--foreground) 25%, transparent);
      color: var(--muted-foreground);
    }
  }

  button {
    &:hover {
      background: var(--accent);
      color: var(--accent-foreground);
    }
  }
</style>
