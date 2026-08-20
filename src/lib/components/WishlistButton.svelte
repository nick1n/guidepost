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
    "-my-3 flex w-14 shrink-0 cursor-pointer items-center justify-center transition-colors",
    "focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2",
    active ? "text-secondary" : "text-muted-foreground hover:text-foreground",
  ]}
>
  <span class={[active ? "i-material-symbols:favorite" : "i-material-symbols:favorite-outline", "size-7"]} aria-hidden="true"></span>
  <span class="sr-only">
    {active ? `Wishlisted: ${label}` : `Add ${label} to wishlist`}
  </span>
</button>
