<script lang="ts">
  import "@unocss/reset/tailwind-v4.css";
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

{@render children()}
