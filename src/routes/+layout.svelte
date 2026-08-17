<script lang="ts">
  import "virtual:uno.css";
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>Kingdom Death: Collection Tracker</title>
</svelte:head>

{@render children()}
