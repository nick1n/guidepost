<script lang="ts">
  type Props = {
    href: string;
    label: string;
    itemName: string;
    padded?: boolean;
  };

  let { href, label, itemName, padded = false }: Props = $props();
</script>

<a {href} title={href} target="_blank" rel="noopener noreferrer" class={["store", padded && "is-padded"]}>
  {label}
  <span class="external-icon i-material-symbols:open-in-new" aria-hidden="true"></span>
  <span class="visually-hidden">page for {itemName}</span>
</a>

<style>
  .store {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-inline-start: auto;
    color: var(--accent);
    text-underline-offset: 0.25rem;

    &:hover {
      text-decoration: underline;
    }

    &.is-padded {
      padding: 0.25rem 0.5rem;
    }
  }

  .external-icon {
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
  }
</style>
