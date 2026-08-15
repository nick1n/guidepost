<script lang="ts">
  import { Star } from "@lucide/svelte";

  type Props = {
    active: boolean;
    onchange: () => void;
    label: string;
  };

  let { active, onchange, label }: Props = $props();
</script>

<button
  type="button"
  aria-pressed={active}
  onclick={(event) => {
    event.stopPropagation();
    onchange();
  }}
  class={[
    "-my-3 flex w-14 cursor-pointer shrink-0 self-stretch items-center justify-center transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    active ? "text-amber-600" : "text-muted-foreground hover:text-foreground",
  ]}
>
  <Star class="size-5" fill={active ? "currentColor" : "none"} />
  <span class="sr-only">
    {active ? `Wishlisted: ${label}` : `Add ${label} to wishlist`}
  </span>
</button>
