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
  <span class="label">
    {active ? `Wishlisted: ${label}` : `Add ${label} to wishlist`}
  </span>
</button>

<style>
  button {
    display: flex;
    flex: 0 0 3.5rem;
    align-items: flex-start;
    align-self: stretch;
    justify-content: center;
    inline-size: 3.5rem;
    margin-block: -0.75rem;
    padding-block-start: 0.75rem;
    color: var(--muted-foreground);
    transition: color var(--duration-fast) var(--ease-standard);

    &[aria-pressed="true"] {
      color: var(--secondary);
    }

    &:not([aria-pressed="true"]):hover {
      color: var(--foreground);
    }

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: var(--border-size);
    }
  }

  .icon {
    display: inline-block;
    inline-size: 1.875rem;
    block-size: 1.875rem;
  }

  .label {
    position: absolute;
    overflow: hidden;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
