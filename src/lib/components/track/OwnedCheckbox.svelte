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
  <span class="visually-hidden">{checked ? `Owned: ${label}` : `Mark ${label} as owned`}</span>
</button>

<style>
  button {
    z-index: var(--layer-control, auto);
    position: relative;
    flex-shrink: 0;
    inline-size: 1.875rem;
    block-size: 1.875rem;
    border: var(--border-size) solid var(--foreground);
    box-shadow: inset 0 0 0 var(--border-size) var(--contrast);
    background: var(--contrast);
    transition: background-color var(--duration-fast) var(--ease-standard);

    &[aria-checked="true"] {
      background: var(--foreground);
    }
  }
</style>
