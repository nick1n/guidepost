<script module lang="ts">
  const titles = { main: "Menu", account: "Account", notifications: "Notification log", settings: "Settings" };
</script>

<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { asset, resolve } from "$app/paths";
  import { version } from "../../../package.json";
  import { getSiteMenu } from "#lib/state/site-menu.svelte.ts";
  import { getDatePreferences } from "#lib/state/date-preferences.svelte.ts";
  import { getNotificationLog } from "#lib/state/notification-log.svelte.ts";
  import { MenuSession } from "./menu-session.ts";
  import { swipeDismiss } from "../swipe.ts";
  import MenuButton from "./MenuButton.svelte";
  import ShowdownSettings from "./ShowdownSettings.svelte";

  const menu = getSiteMenu();
  const dates = getDatePreferences();
  const log = getNotificationLog();
  const id = $props.id();
  let view = $state<keyof typeof titles>("main");
  let content: HTMLDivElement;
  let heading: HTMLHeadingElement;
  let fullscreen = $state(false);
  let fullscreenAvailable = $state(false);
  let fullscreenPending = $state(false);
  let fullscreenError = $state("");
  let updateStatus = $state("");
  let online = $state(true);
  let drag = $state(0);
  const latest = $derived(log.notices[0]);
  const hasNavbar = $derived(page.route.id?.startsWith("/kdm/showdown"));

  function record(message: string, kind: "info" | "error" = "info") {
    log.record({ kind, message, timestamp: Date.now() });
  }

  const session = new MenuSession({
    history: {
      isOpen: () => Boolean(page.state.siteMenu),
      open: () =>
        goto((page.shallow?.url ?? page.url).href, { shallow: true, persistState: true, state: { ...page.state, siteMenu: true } }),
      back: () => history.back(),
      navigate: (href) => goto(href),
    },
    onchange(open) {
      menu.open = open;
      if (open) view = "main";
      else {
        if (content) content.scrollTop = 0;
        drag = 0;
      }
    },
    report: (message) => record(message, "error"),
  });
  const swipe = swipeDismiss({ dismiss: session.close, ondrag: (distance) => (drag = distance) });
  const onnavigate = session.navigate;

  // Browser history owns visibility; the session synchronizes the native modal and its browser resources.
  $effect(() => {
    const open = Boolean(page.state.siteMenu);
    untrack(() => session.synchronize(open));
  });

  onMount(() => {
    const unregister = menu.registerOpen(session.open);
    fullscreenAvailable = Boolean(document.fullscreenEnabled);
    fullscreen = Boolean(document.fullscreenElement);
    online = navigator.onLine;
    return unregister;
  });

  async function showView(next: typeof view) {
    view = next;
    await tick();
    content.scrollTop = 0;
    heading.focus({ preventScroll: true });
  }

  function back() {
    void showView("main");
  }

  function onfullscreenchange() {
    fullscreen = Boolean(document.fullscreenElement);
    fullscreenError = "";
  }

  async function toggleFullscreen() {
    if (!fullscreenAvailable || fullscreenPending) return;
    fullscreenPending = true;
    fullscreenError = "";
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      onfullscreenchange();
      record(fullscreen ? "Entered fullscreen." : "Left fullscreen.");
    } catch {
      fullscreenError = "Could not change fullscreen mode. Please try again.";
      record(fullscreenError, "error");
    } finally {
      fullscreenPending = false;
    }
  }

  function checkForUpdates() {
    updateStatus = "Update checks are not available yet.";
  }
</script>

<svelte:document {onfullscreenchange} />
<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

{#if !hasNavbar}
  <div class="clearance" aria-hidden="true"></div>
  <div class="launcher"><MenuButton /></div>
{/if}

<dialog aria-labelledby={`${id}-heading`} data-swipe-ignore {@attach (dialog) => untrack(() => session.attach(dialog))} {@attach swipe}>
  <div class="sheet" data-dragging={drag > 0} style:translate={drag > 0 ? `0 ${drag}px` : undefined}>
    <div class="grip" data-drag-handle aria-hidden="true"><span></span></div>
    <header>
      <h2 id={`${id}-heading`} bind:this={heading} tabindex="-1">
        {#if view !== "main"}
          <button class="back" type="button" onclick={back}>
            {titles[view]}<span class="visually-hidden">, back to menu</span>
          </button>
        {:else}
          <span class="heading-label">{titles[view]}</span>
        {/if}
      </h2>
    </header>
    <div class="body" bind:this={content}>
      {#if view === "main"}
        <button class="brand" type="button" onclick={checkForUpdates}>
          <svg class="logo" viewBox="205 300 440 440" aria-hidden="true" focusable="false">
            <image href={asset("logo/guidepost-min.svg")} width="850" height="1100" transform="rotate(-28 425 510)" />
          </svg>
          <span class="copy">
            <strong>Guidepost <span class="version">v{version}</span></strong>
            <span role="status">{updateStatus || "Check for updates"}</span>
          </span>
          <span class="row-icon i-material-symbols:refresh" aria-hidden="true"></span>
        </button>
        <div class="group">
          <button class="row" type="button" onclick={() => showView("account")}>
            <span class="row-icon i-material-symbols:account-circle-outline" aria-hidden="true"></span>
            <span class="copy"><strong>Guest</strong><span>User account</span></span>
            <span class="chevron i-material-symbols:chevron-right" aria-hidden="true"></span>
          </button>
          <button class="row" type="button" onclick={() => showView("settings")}>
            <span class="row-icon i-material-symbols:settings-outline" aria-hidden="true"></span>
            <span class="copy"><strong>Settings</strong><span>Date format and showdown display</span></span>
            <span class="chevron i-material-symbols:chevron-right" aria-hidden="true"></span>
          </button>
          <button class="row" type="button" onclick={() => showView("notifications")}>
            <span class="row-icon i-material-symbols:notifications-outline" aria-hidden="true"></span>
            <span class="copy">
              <strong>Notification log <span class="count">{log.notices.length}</span></strong>
              <span class="activity-detail">
                <span class="latest">{latest?.message ?? "No activity yet"}</span>
                {#if latest}<time datetime={new Date(latest.timestamp).toISOString()}>{dates.formatTime(latest.timestamp)}</time>{/if}
              </span>
            </span>
            <span class="chevron i-material-symbols:chevron-right" aria-hidden="true"></span>
          </button>
        </div>
        <nav class="navigation" aria-label="Site">
          <a href={resolve("/")} onclick={(event) => onnavigate(event, resolve("/"))}>
            <span class="row-icon i-material-symbols:home-outline" aria-hidden="true"></span>Home
          </a>
          <button type="button" disabled={!fullscreenAvailable || fullscreenPending} onclick={toggleFullscreen}>
            <span
              class={["row-icon", fullscreen ? "i-material-symbols:fullscreen-exit" : "i-material-symbols:fullscreen"]}
              aria-hidden="true"
            ></span>
            {!fullscreenAvailable
              ? "Fullscreen unavailable"
              : fullscreenPending
                ? "Changing display?"
                : fullscreen
                  ? "Exit fullscreen"
                  : "Fullscreen"}
          </button>
        </nav>
        {#if fullscreenError}<p class="error" role="alert">{fullscreenError}</p>{/if}
      {:else if view === "account"}
        <div class="empty">
          <span class="empty-icon i-material-symbols:account-circle-outline" aria-hidden="true"></span>
          <h3>Playing as a guest</h3>
          <p>Your collection is saved in this browser. Accounts and device sync are not available yet.</p>
        </div>
      {:else if view === "notifications"}
        <p class="description">Activity from this session, newest first.</p>
        {#if log.notices.length}
          <ol>
            {#each log.notices as notice (notice.id)}
              <li data-kind={notice.kind}>
                <span
                  class={[
                    "notice-icon",
                    notice.kind === "error"
                      ? "i-material-symbols:error-outline"
                      : notice.kind === "success"
                        ? "i-material-symbols:check-circle-outline"
                        : "i-material-symbols:info-outline",
                  ]}
                  aria-hidden="true"
                ></span>
                <div>
                  <span class="visually-hidden">{notice.kind === "error" ? "Error: " : notice.kind === "success" ? "Success: " : ""}</span>
                  <p>{notice.message}</p>
                  <time datetime={new Date(notice.timestamp).toISOString()}>{dates.formatTimestamp(notice.timestamp)}</time>
                </div>
              </li>
            {/each}
          </ol>
        {:else}
          <div class="empty">
            <span class="empty-icon i-material-symbols:notifications-outline" aria-hidden="true"></span>
            <h3>No activity yet</h3>
            <p>Saved collection changes and notifications will appear here.</p>
          </div>
        {/if}
      {:else}
        <div class="date-settings">
          <label for={`${id}-date-format`}>Date format</label>
          <select id={`${id}-date-format`} value={dates.dateFormat} onchange={(event) => dates.setDateFormat(event.currentTarget.value)}>
            {#each dates.formats as format (format.value)}
              <option value={format.value}>{format.label}</option>
            {/each}
          </select>
        </div>
        <ShowdownSettings {onnavigate} />
      {/if}
    </div>
    <footer>
      <div class="status">
        <span class={["connection", !online && "offline"]}></span>{online ? "Online" : "Offline"}<span>Saved on this device</span>
      </div>
      <div class="toggle-space" aria-hidden="true"></div>
    </footer>
  </div>
  <div class="toggle"><MenuButton onclose={session.close} onback={view !== "main" ? back : undefined} /></div>
</dialog>

<style>
  .clearance {
    block-size: calc(var(--size-floating-control) + var(--inset-floating-control) * 2 + env(safe-area-inset-bottom));
  }
  .launcher {
    z-index: 5;
    position: fixed;
    inset-block-end: max(var(--inset-floating-control), env(safe-area-inset-bottom));
    inset-inline-end: max(var(--inset-floating-control), env(safe-area-inset-right));
  }
  dialog {
    --space-menu: 0.75rem;
    --toggle-padding-inline: 0.5rem;
    --toggle-padding-block: 0.5rem;

    position: fixed;
    inline-size: min(24rem, var(--viewport-width, 100vw));
    max-inline-size: none;
    max-block-size: calc(100dvh - 1rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    margin: 0;
    inset: auto 0 0 auto;
    padding: 0;
    overflow: visible;
    border: 0;
    background: transparent;
    color: var(--foreground);
    transition:
      display var(--duration-fast),
      overlay var(--duration-fast);
    transition-behavior: allow-discrete;

    &[open] {
      display: flex;
    }
    &::backdrop {
      background: #00000000;
      transition:
        background-color var(--duration-fast),
        display var(--duration-fast),
        overlay var(--duration-fast);
      transition-behavior: allow-discrete;
    }
    &[open]::backdrop {
      background: #00000080;
    }
  }
  .sheet {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    max-block-size: inherit;
    overflow: hidden;
    translate: 0 calc(100% + var(--inset-floating-control));
    border: var(--border-width) solid var(--grey-7);
    border-inline-end: 0;
    border-block-end: 0;
    border-start-start-radius: var(--radius-card);
    background: var(--panel);
    box-shadow:
      0 1rem 4rem #00000099,
      inset 0 1px #ffffff0a;
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--ease-standard),
      translate var(--duration-fast) var(--ease-standard);
  }
  dialog[open] .sheet {
    translate: 0 0;
    opacity: 1;
  }
  .sheet[data-dragging="true"] {
    transition: none;
  }
  @starting-style {
    dialog[open] .sheet {
      translate: 0 1rem;
      opacity: 0;
    }
    dialog[open]::backdrop {
      background: #00000000;
    }
  }
  .toggle-space {
    flex: none;
    inline-size: var(--toggle-size, var(--size-floating-control));
    block-size: var(--toggle-size, var(--size-floating-control));
  }
  .toggle {
    --size-floating-control: var(--toggle-size);
    position: absolute;
    inset-block-end: var(--toggle-padding-block);
    inset-inline-end: var(--toggle-padding-inline);
  }
  .grip {
    display: grid;
    flex: none;
    place-items: center;
    block-size: 1.25rem;
    cursor: grab;
    touch-action: none;

    & span {
      inline-size: 2.5rem;
      block-size: 0.25rem;
      border-radius: var(--radius-control);
      background: var(--grey-6);
    }
  }
  header {
    flex: none;
    touch-action: pan-x;
    border-block-end: var(--border-width) solid var(--color-divider);
  }
  h2 {
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    font-family: var(--font-display);
  }
  .heading-label,
  .back {
    display: flex;
    align-items: center;
    inline-size: 100%;
    min-block-size: 2.75rem;
    padding: 0.5rem 1rem;
    gap: 0.75rem;
    text-align: start;
  }
  .body {
    min-block-size: 0;
    padding: var(--space-menu);
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }
  .date-settings {
    display: grid;
    margin-block-end: 1.25rem;
    gap: 0.5rem;

    & label {
      font-weight: var(--font-bold);
    }
  }
  select {
    inline-size: 100%;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background: var(--card);
    color: var(--foreground);
  }
  .brand {
    margin-block-end: var(--space-menu);
    overflow: clip;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background:
      radial-gradient(ellipse 85% 180% at 8% 50% in oklch, #ffb25140 0%, #fb823b33 24%, #d440301a 58%, transparent 100%), var(--background);

    & .row-icon {
      color: var(--muted-foreground);
    }
  }
  .logo {
    flex: none;
    inline-size: 3.5rem;
    block-size: 3.5rem;
    margin: -0.75rem -1rem;
    overflow: visible;
  }
  .copy {
    display: grid;
    flex: 1;
    min-inline-size: 0;
    gap: 0.25rem;

    & > :is(span, time) {
      color: var(--muted-foreground);
      font-size: var(--text-sm);
      line-height: var(--line-height-snug);
    }
  }
  strong {
    font-weight: var(--font-bold);
    font-size: var(--text-md);
  }
  .version {
    color: var(--muted-foreground);
    font-weight: var(--font-normal);
    font-size: var(--text-sm);
  }
  .group {
    margin-block-end: var(--space-menu);
    overflow: hidden;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
  }
  .brand,
  .row {
    display: flex;
    align-items: center;
    inline-size: 100%;
    min-block-size: 4rem;
    padding: 0.875rem;
    gap: 0.75rem;
    text-align: start;
  }
  .row + .row {
    border-block-start: var(--border-width) solid var(--grey-7);
  }
  .brand {
    padding-block: calc(0.875rem - var(--border-width));
  }
  .row-icon {
    --size-icon: 1.5rem;
    flex: none;
    color: var(--accent);
  }
  .chevron {
    --size-icon: 1.25rem;
    flex: none;
    color: var(--muted-foreground);
  }
  .activity-detail {
    display: flex;
    min-inline-size: 0;
    gap: 0.5rem;

    & time {
      flex: none;
      white-space: nowrap;
    }
  }
  .latest {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    margin-inline-start: 0.25rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .navigation {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-menu);

    & :is(a, button) {
      display: flex;
      align-items: center;
      justify-content: center;
      min-block-size: 3rem;
      padding: 0.5rem;
      gap: 0.5rem;
      border: var(--border-width) solid var(--grey-7);
      border-radius: var(--radius-control);
      background: var(--card);
      font-size: var(--text-md);
    }
  }
  footer {
    display: flex;
    flex: none;
    align-items: center;
    padding: 0.5rem var(--toggle-padding-inline) var(--toggle-padding-block) 1rem;
    gap: 0.75rem;
    border-block-start: var(--border-width) solid var(--color-divider);
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  .status {
    display: grid;
    grid-template-columns: auto 1fr;
    flex: 1;
    align-items: center;
    gap: 0.25rem 0.375rem;

    & > span:last-child {
      grid-column: 1 / -1;
    }
  }
  .connection {
    inline-size: 0.375rem;
    block-size: 0.375rem;
    border-radius: 50%;
    background: var(--accent-green);

    &.offline {
      background: var(--muted-foreground);
    }
  }
  .empty {
    display: grid;
    justify-items: center;
    padding: 2rem 0.75rem;
    gap: 0.875rem;
    text-align: center;

    & p {
      max-inline-size: 28ch;
      color: var(--muted-foreground);
      font-size: var(--text-md);
      line-height: var(--line-height-snug);
    }
  }
  .empty-icon {
    --size-icon: 3rem;
    color: var(--muted-foreground);
  }
  h3 {
    font-weight: var(--font-bold);
  }
  .description {
    margin-block-end: 1rem;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  li {
    display: flex;
    padding-block: 0.875rem;
    gap: 0.75rem;
    border-block-end: var(--border-width) solid var(--color-divider);

    & p {
      font-size: var(--text-md);
      line-height: var(--line-height-snug);
      overflow-wrap: anywhere;
    }
    & time {
      display: block;
      margin-block-start: 0.375rem;
      color: var(--muted-foreground);
      font-size: var(--text-sm);
    }
  }
  .notice-icon {
    --size-icon: 1.25rem;
    flex: none;
    color: var(--accent);
  }
  li[data-kind="error"] .notice-icon,
  .error {
    color: var(--red-3);
  }
  li[data-kind="success"] .notice-icon {
    color: var(--accent-green);
  }
  .error {
    padding: 0.75rem;
    font-size: var(--text-sm);
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
  :is(button, a) {
    transition: var(--transition-colors);
  }
  @media (hover: hover) {
    :is(.row, .back):hover:not(:disabled),
    .navigation :is(a, button):hover {
      background: var(--blue-9);
    }
    .brand:hover {
      background-color: var(--card);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet,
    dialog[open] .sheet {
      translate: none;
    }
  }
</style>
