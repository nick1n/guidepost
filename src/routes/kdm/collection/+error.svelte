<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { online } from "svelte/reactivity/window";

  const offline = $derived(page.status === 503 && online.current === false);
  const title = $derived(offline ? "You're offline" : "Collection couldn't open");
  let retrying = $state(false);
  let retryFailed = $state(false);

  async function onclick() {
    retrying = true;
    retryFailed = false;
    try {
      await goto(page.url.href, { invalidateAll: true, replaceState: true });
    } catch (cause) {
      console.error("Collection retry failed", cause);
      retryFailed = true;
    } finally {
      retrying = false;
    }
  }
</script>

<svelte:head>
  <title>Collection unavailable | Guidepost</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <a class="back" href={resolve("/")}>
    <span class="control-icon i-material-symbols:arrow-back" aria-hidden="true"></span>Guidepost
  </a>

  <div class="message">
    <span class="status-icon i-material-symbols:inventory-2-outline-sharp" aria-hidden="true"></span>
    <p class="eyebrow">Collection <span class="code">{page.status}</span></p>
    <h1>{title}</h1>
    <p class="description">
      {#if offline}
        This device doesn't have the catalog available offline yet. Connect to the internet and try again.
      {:else}
        {page.error?.message ?? "Something prevented the collection from opening. Please try again."}
      {/if}
    </p>
    <p class="reassurance">Your saved collection stays on this device. Trying again won't change it.</p>

    <div class="actions">
      <button type="button" {onclick} disabled={retrying}>{retrying ? "Trying again..." : "Try again"}</button>
      <a class="home" href={resolve("/")}>Back to Guidepost</a>
    </div>
    <p class="retry-status" role="status">
      {retrying ? "Opening your collection..." : retryFailed ? "We couldn't retry. Reload the page or return to Guidepost." : ""}
    </p>
  </div>
</main>

<style>
  main {
    display: grid;
    grid-template-rows: auto 1fr;
    min-block-size: calc(100svh - var(--border-width));
    inline-size: min(100%, 68rem);
    margin-inline: auto;
    padding: clamp(1rem, 4vw, 2.5rem);
    gap: 2rem;
  }

  .back {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: 0.5rem;
    min-block-size: 2.75rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    font-weight: var(--font-bold);

    &:hover {
      color: var(--foreground);
    }
  }

  .message {
    align-self: center;
    inline-size: min(100%, 42rem);
    margin-inline: auto;
    padding: clamp(1.5rem, 5vw, 3rem);
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-card);
    background: radial-gradient(ellipse at top left, color-mix(var(--color-trail) 16%, transparent), transparent 65%), var(--panel);
  }

  .status-icon {
    --size-icon: 3rem;
    margin-block-end: 1.5rem;
    color: var(--accent);
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-block-end: 0.75rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }

  .code {
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    padding: 0.125rem 0.5rem;
    font-variant-numeric: tabular-nums;
  }

  h1 {
    font-family: var(--font-display);
    font-weight: var(--font-bold);
    font-size: clamp(2rem, 6vw, 3.5rem);
    line-height: var(--line-height-tight);
    letter-spacing: var(--letter-spacing-tight);
    text-wrap: balance;
  }

  .description {
    margin-block-start: 1.25rem;
    line-height: 1.6;
  }

  .reassurance {
    margin-block-start: 0.75rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
    line-height: 1.6;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1.5rem;
    margin-block-start: 2rem;
  }

  button {
    min-block-size: 2.75rem;
    border-radius: var(--radius-control);
    padding: 0.75rem 1.25rem;
    background: var(--accent);
    color: var(--background);
    font-weight: var(--font-bold);
    transition: background-color var(--duration-fast) var(--ease-standard);

    &:hover {
      background: color-mix(var(--accent) 85%, var(--foreground));
    }

    &:disabled {
      cursor: wait;
      opacity: 0.7;
    }
  }

  .home {
    display: inline-flex;
    align-items: center;
    min-block-size: 2.75rem;
    color: var(--muted-foreground);

    &:hover {
      color: var(--foreground);
    }
  }

  .retry-status {
    min-block-size: 1.5rem;
    margin-block-start: 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
  }
</style>
