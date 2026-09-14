<script lang="ts">
  type Props = {
    checked: boolean;
    onchange: Noop;
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
    inline-size: var(--size-card-header);
    block-size: var(--size-card-header);
    border: var(--border-size) solid var(--foreground);
    background: var(--color-checkbox, var(--contrast));
    box-shadow: inset 0 0 0 var(--border-size) var(--contrast);
    transition: background-color var(--duration-fast) var(--ease-standard);

    &:hover {
      --color-checkbox: var(--color-divider);
    }

    &[aria-checked="true"] {
      --color-checkbox: var(--foreground);
    }
  }
</style>
