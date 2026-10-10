<script lang="ts">
  import { resolve } from "$app/paths";
</script>

<svelte:head>
  <title>Quick Start | Guidepost</title>
</svelte:head>

<main>
  <h1>coming soon</h1>

  <nav aria-labelledby="showdown-previews">
    <h2 id="showdown-previews">Showdown design previews</h2>
    <a href={resolve("/kdm/showdown1")}>Showdown draft 1</a>
    <a href={resolve("/kdm/showdown2")}>Showdown draft 2</a>
    <a href={resolve("/kdm/showdown3")}>Showdown draft 3</a>
  </nav>
</main>

<style>
  main {
    padding: 1.5rem;
  }

  nav {
    display: grid;
    gap: 0.75rem;
    margin-block-start: 1.5rem;
    justify-items: start;
  }

  a {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 0.2em;

    &:hover {
      color: var(--foreground);
    }
  }
</style>
