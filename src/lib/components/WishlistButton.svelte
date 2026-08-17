<script lang="ts">
  type Props = {
    active: boolean;
    onchange: () => void;
    label: string;
  };

  let { active, onchange, label }: Props = $props();

  function onclick(event: Event) {
    event.stopPropagation();
    onchange();
  }
</script>

<button
  type="button"
  aria-pressed={active}
  {onclick}
  class={[
    "-my-3 flex w-14 cursor-pointer shrink-0 items-center justify-center transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    active ? "text-amber-600" : "text-muted-foreground hover:text-foreground",
  ]}
>
  <span
    class={[active ? "i-material-symbols:bookmark-heart-sharp" : "i-material-symbols:bookmark-heart-outline-sharp", "size-10"]}
    aria-hidden="true"
  ></span>
  <span class="sr-only">
    {active ? `Wishlisted: ${label}` : `Add ${label} to wishlist`}
  </span>
</button>
