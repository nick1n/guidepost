<script lang="ts">
  type Props = {
    href: string;
    label?: string;
    name: string;
  };

  let { href, label = "Shop", name }: Props = $props();
</script>

<a {href} title={href} target="_blank" rel="noopener noreferrer" class="store">
  {label}
  <span class="external-icon i-material-symbols:open-in-new" aria-hidden="true"></span>
  <span class="visually-hidden">page for {name}</span>
</a>

<style>
  .store {
    display: inline-flex;
    align-items: center;
    margin-inline-start: auto;
    padding: 0.25rem 0.5rem;
    gap: 0.25rem;
    color: var(--accent);
    text-underline-offset: 0.25rem;

    &:hover {
      text-decoration: underline;
    }
  }
</style>
