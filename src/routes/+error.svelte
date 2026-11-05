<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Cause, Effect, Fiber } from "effect";
  import { onDestroy } from "svelte";
  import { online } from "svelte/reactivity/window";
  import { getActions } from "#lib/app/actions.ts";
  import { navigate } from "#lib/app/navigation/navigate.ts";
  import { suggestPage } from "#lib/app/navigation/route-suggestion.ts";

  const actions = getActions();
  const offline = $derived(online.current === false);
  const missing = $derived(page.status === 404);
  const suggestion = $derived(missing ? suggestPage(page.url) : undefined);
  const title = $derived(missing ? "Page not found" : offline ? "You're offline" : "This page couldn't open");
  let retrying = $state(false);
  let retryFailed = $state(false);
  let active: Fiber.Fiber<unknown, unknown> | undefined;

  const retry = Effect.fn("Page.retry")(() =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        retrying = true;
        retryFailed = false;
      }),
      () =>
        navigate(page.url.href, "Page retry failed", { invalidateAll: true, replaceState: true }).pipe(
          Effect.catchCause((cause) => {
            if (!Cause.hasInterrupts(cause)) retryFailed = true;
            return Effect.failCause(cause);
          }),
        ),
      () => Effect.sync(() => (retrying = false)),
    ),
  );

  function onclick() {
    if (!retrying) active = actions.run(retry(), { success: false });
  }

  onDestroy(() => {
    if (active) actions.run(Fiber.interrupt(active), { success: false });
  });
</script>

<svelte:head>
  <title>{title} | Guidepost</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <div class="message">
    <header>
      <p class="status">Error <span class="code">{page.status}</span></p>
      <span class="status-icon i-material-symbols:error-outline" aria-hidden="true"></span>
      <h1>{title}</h1>
    </header>
    <p class="description">
      {#if missing}
        This page may have moved, or the address may be incorrect. Return to Guidepost to find your way.
      {:else if offline}
        This page isn't available offline on this device. Connect to the internet and try again.
      {:else}
        {page.error?.message ?? "Something prevented this page from opening. Please try again."}
      {/if}
    </p>

    {#if suggestion}
      <p class="suggestion">
        <span>Did you mean?</span>
        <a href={suggestion.href}>{suggestion.path}<span class="i-material-symbols:arrow-forward" aria-hidden="true"></span></a>
      </p>
    {/if}

    <div class="actions">
      {#if !missing}<button type="button" {onclick} disabled={retrying}>Try again</button>{/if}
      <a class={["home", missing && "primary"]} href={resolve("/")}>Back to Guidepost</a>
    </div>
    {#if !missing}
      <p class="retry-status" role="status">
        <span class={[!retryFailed && "is-hidden"]} aria-hidden={!retryFailed}>
          We couldn't retry. Reload the page or return to Guidepost.
        </span>
        {#if retrying}
          <span>Opening the page...</span>
        {/if}
      </p>
    {/if}
  </div>
</main>

<style>
  main {
    display: grid;
    place-items: center;
    inline-size: min(100%, 68rem);
    margin-inline: auto;
    padding: clamp(1rem, 4vw, 2.5rem);
  }

  .message {
    inline-size: min(100%, 42rem);
    padding: clamp(1.5rem, 4vw, 2rem);
    border: var(--border-width) solid var(--color-divider);
    border-radius: var(--radius-card);
    background: radial-gradient(ellipse at top left, color-mix(var(--red-4) 16%, transparent), transparent 65%), var(--panel);
  }

  header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.375rem 0;
    align-items: start;
  }

  .status-icon {
    --size-icon: 3rem;
    grid-row: 1 / 3;
    grid-column: 2;
    color: var(--accent);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }

  .code {
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    font-variant-numeric: tabular-nums;
  }

  h1 {
    grid-column: 1;
    font-weight: var(--font-bold);
    font-size: clamp(2rem, 6vw, 3.5rem);
    line-height: var(--line-height-tight);
    font-family: var(--font-display);
    letter-spacing: var(--letter-spacing-tight);
    text-wrap: balance;
  }

  .description {
    margin-block-start: 0.75rem;
    line-height: 1.6;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-block-start: 1.25rem;
    gap: 0.75rem 1.5rem;
  }

  button,
  .home {
    min-block-size: 2.75rem;
  }

  button,
  .primary {
    padding: 0.75rem 1.25rem;
    border-radius: var(--radius-control);
    background: var(--accent);
    color: var(--background);
    font-weight: var(--font-bold);
    transition: background-color var(--duration-fast) var(--ease-standard);

    &:hover {
      background: var(--blue-2);
    }

    &:disabled {
      cursor: wait;
      opacity: 0.7;
    }
  }

  .home {
    display: inline-flex;
    align-items: center;
    &:not(.primary) {
      color: var(--muted-foreground);

      &:hover {
        color: var(--foreground);
      }
    }
  }

  .suggestion {
    display: grid;
    gap: 0.5rem;
    margin-block-start: 1.25rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);

    a {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border: var(--border-width) solid var(--color-divider);
      border-radius: var(--radius-control);
      background: var(--background);
      color: var(--accent);
      font-size: 1rem;
      overflow-wrap: anywhere;
      transition: var(--transition-colors);

      &:hover {
        border-color: var(--accent);
        background: var(--card);
      }
    }

    [aria-hidden] {
      flex-shrink: 0;
    }
  }

  .retry-status {
    display: grid;
    margin-block-start: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--text-md);
  }

  .retry-status span {
    grid-area: 1 / 1;

    &.is-hidden {
      visibility: hidden;
    }
  }
</style>
