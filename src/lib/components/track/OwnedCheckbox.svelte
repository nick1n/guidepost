<script lang="ts">
  type Props = {
    checked: boolean;
  };

  let { checked }: Props = $props();
</script>

<span class="checkbox" data-checked={checked} aria-hidden="true"></span>

<style>
  .checkbox {
    flex-shrink: 0;
    inline-size: var(--size-card-header);
    block-size: var(--size-card-header);
    border: var(--border-size) solid var(--foreground);
    background: var(--color-checkbox, var(--contrast));
    box-shadow: inset 0 0 0 var(--border-size) var(--contrast);
    transition: background-color var(--duration-fast) var(--ease-standard);

    &[data-checked="true"] {
      --color-checkbox: var(--foreground);
    }
  }
</style>
