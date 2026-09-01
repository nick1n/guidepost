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

<button type="button" aria-pressed={active} {onclick}>
  <span class={["icon", active ? "i-material-symbols:favorite" : "i-material-symbols:favorite-outline"]} aria-hidden="true"></span>
  <span class="visually-hidden">
    {active ? `Wishlisted: ${label}` : `Add ${label} to wishlist`}
  </span>
</button>

<style>
  button {
    display: flex;
    flex-shrink: 0;
    align-items: flex-start;
    align-self: stretch;
    justify-content: center;
    inline-size: 3.5rem;
    margin-block: -0.75rem;
    padding-block-start: 0.75rem;
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-standard);

    &[aria-pressed="true"] {
      color: var(--accent-red);
    }

    &:not([aria-pressed="true"]):hover {
      color: var(--accent-red);
    }
  }

  .icon {
    display: inline-block;
    inline-size: 1.875rem;
    block-size: 1.875rem;
  }
</style>
