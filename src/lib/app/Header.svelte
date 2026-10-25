<script lang="ts">
  let { title, subtitle }: { title: string; subtitle: string } = $props();
</script>

<header>
  <h1>{title}</h1>
  <p>{subtitle}</p>
</header>

<style>
  header {
    /* Keep font-metric fractions from shifting the content below the trimmed heading. */
    block-size: calc-size(auto, round(up, size, 1px));
    margin-block: 0.75rem;
    text-align: center;
  }

  h1 {
    font-weight: var(--font-bold);
    font-size: 5rem;
    line-height: var(--line-height-none);
    font-family: var(--font-display);
    text-box: trim-both cap alphabetic;
    letter-spacing: var(--letter-spacing-tight);
  }

  p {
    color: var(--muted-foreground);
  }
</style>
