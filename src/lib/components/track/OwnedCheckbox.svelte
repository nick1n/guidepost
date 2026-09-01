<script lang="ts">
  type Props = {
    checked: boolean;
    onchange: () => void;
    label: string;
  };

  let { checked, onchange, label }: Props = $props();

  function onclick(event: MouseEvent) {
    event.stopPropagation();
    onchange();
  }
</script>

<button type="button" role="checkbox" aria-checked={checked} {onclick}>
  <span>{checked ? `Owned: ${label}` : `Mark ${label} as owned`}</span>
</button>

<style>
  button {
    z-index: var(--layer-control, auto);
    position: relative;
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    inline-size: 1.875rem;
    block-size: 1.875rem;
    border: var(--border-size) solid var(--foreground);
    box-shadow: inset 0 0 0 var(--border-size) var(--contrast);
    background: var(--contrast);
    transition: background-color var(--duration-fast) var(--ease-standard);

    &[aria-checked="true"] {
      background: var(--foreground);
    }

    &:focus-visible {
      outline: var(--border-size) solid var(--accent);
      outline-offset: var(--border-size);
    }
  }

  span {
    position: absolute;
    overflow: hidden;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
