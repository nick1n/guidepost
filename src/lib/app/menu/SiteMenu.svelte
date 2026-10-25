<script module lang="ts">
  const titles = { main: "Menu", account: "Account", notifications: "Notification log", settings: "Settings" };
</script>

<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { Effect } from "effect";
  import type { ResetError } from "#lib/app/delete-data.ts";
  import { getCollectionActions } from "#lib/kdm/collection/state/collection-actions.ts";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { asset, resolve } from "$app/paths";
  import { version } from "../../../../package.json";
  import { getSiteMenu } from "#lib/app/menu/site-menu.svelte.ts";
  import { getDatePreferences } from "#lib/app/preferences/date-preferences.svelte.ts";
  import { getGlassPreferences } from "#lib/app/preferences/glass-preferences.svelte.ts";
  import { getNotificationLog } from "#lib/app/notifications/notification-log.svelte.ts";
  import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
  import Select from "#lib/components/Select.svelte";
  import ToggleButton from "#lib/components/ToggleButton.svelte";
  import { MenuSession } from "./menu-session.ts";
  import { createSwipeDismiss } from "#lib/swipe-dismiss.svelte.ts";
  import MenuButton from "./MenuButton.svelte";
  import ShowdownSettings from "#lib/kdm/showdown/ui/ShowdownSettings.svelte";
  import HuntSettings from "#lib/kdm/hunt/HuntSettings.svelte";

  const menu = getSiteMenu();
  const dates = getDatePreferences();
  const glass = getGlassPreferences();
  const log = getNotificationLog();
  const actions = getCollectionActions();
  let { onreset }: { onreset: () => Effect.Effect<void, ResetError> } = $props();
  let resetting = $state(false);
  let resetError = $state("");
  let resetDialog: ConfirmDialog;
  const id = $props.id();
  let view = $state<keyof typeof titles>("main");
  let content: HTMLDivElement;
  let fullscreen = $state(false);
  let fullscreenAvailable = $state(false);
  let fullscreenPending = $state(false);
  let fullscreenError = $state("");
  let updateStatus = $state("");
  let updating = $state(false);
  let updateAttempt = $state(0);
  let updateTimer: Timeout;
  let online = $state(true);
  const latest = $derived(log.notices[0]);
  const hasNavbar = $derived(page.route.id?.startsWith("/kdm/showdown") || page.route.id === "/kdm/hunt");

  function record(message: string, kind: "info" | "error" = "info") {
    log.record({ kind, message, timestamp: Date.now() });
  }

  const session = new MenuSession({
    history: {
      isOpen: () => Boolean(page.state.siteMenu),
      open: async () => {
        const href = window.location.href;
        // Native hash entries have no framework state for Back to restore when the menu closes.
        if (history.state === null) await goto(href, { shallow: true, replace: true, state: page.state });
        await goto(href, { shallow: true, persistState: true, state: { ...page.state, siteMenu: true } });
      },
      back: () => history.back(),
      navigate: (href) => goto(href),
    },
    onchange(open) {
      menu.open = open;
      menu.onback = undefined;
      if (open) view = "main";
      else {
        if (content) content.scrollTop = 0;
        dismissal.reset();
      }
    },
    report: (message) => record(message, "error"),
  });
  const dismissal = createSwipeDismiss(session.close);
  const onnavigate = session.navigate;

  // Browser history owns visibility; the session synchronizes the drawer and its browser resources.
  $effect(() => {
    const open = Boolean(page.state.siteMenu);
    untrack(() => session.synchronize(open));
  });

  onMount(() => {
    const unregister = menu.register({ open: session.open, close: session.close });
    fullscreenAvailable = Boolean(document.fullscreenEnabled);
    fullscreen = Boolean(document.fullscreenElement);
    online = navigator.onLine;
    return () => {
      unregister();
      clearTimeout(updateTimer);
    };
  });

  async function showView(next: typeof view) {
    view = next;
    if (next === "notifications") log.acknowledgeErrors();
    menu.onback = next === "main" ? undefined : back;
    await tick();
    content.scrollTop = 0;
    const target = next === "main" ? content.querySelector("button") : content.previousElementSibling?.querySelector("button");
    target?.focus({ preventScroll: true });
  }

  function alignControls(element: HTMLDivElement) {
    let frame = 0;
    function measure() {
      frame = 0;
      const width = `${element.offsetWidth - element.clientWidth}px`;
      if (element.style.getPropertyValue("--width-scrollbar") !== width) element.style.setProperty("--width-scrollbar", width);
    }
    // Scrollbar padding can resize the body, so write outside the observer's delivery cycle.
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(measure);
    });
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }

  function back() {
    void showView("main");
  }

  function onfullscreenchange() {
    fullscreen = Boolean(document.fullscreenElement);
    fullscreenError = "";
  }

  function onkeydown(event: KeyboardEvent) {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      document.querySelector("dialog:modal")
    )
      return;
    const target = event.composedPath()[0];
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role=textbox]"))) return;
    event.preventDefault();
    if (menu.open) session.close();
    else void session.open();
  }

  async function toggleFullscreen() {
    if (!fullscreenAvailable || fullscreenPending) return;
    fullscreenPending = true;
    fullscreenError = "";
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      onfullscreenchange();
    } catch {
      fullscreenError = "Could not change fullscreen mode. Please try again.";
      record(fullscreenError, "error");
    } finally {
      fullscreenPending = false;
    }
  }

  function checkForUpdates() {
    updateStatus = "Update checks are not available yet.";
    updating = true;
    updateAttempt += 1;
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => (updating = false), 2000);
  }

  function resetData() {
    if (resetting) return;
    resetting = true;
    resetError = "";
    actions.run(
      Effect.suspend(onreset).pipe(
        Effect.tapError((error) => Effect.sync(() => (resetError = error.message))),
        Effect.ensuring(Effect.sync(() => (resetting = false))),
      ),
      { success: false },
    );
  }
</script>

<svelte:document {onfullscreenchange} />
<svelte:window {onkeydown} ononline={() => (online = true)} onoffline={() => (online = false)} />

{#if !hasNavbar}
  <div class="clearance" aria-hidden="true"></div>
  <div class="launcher"><MenuButton /></div>
{/if}

<div class={["scrim", menu.open && "is-open"]} aria-hidden="true"></div>
<dialog
  aria-labelledby={`${id}-heading`}
  data-swipe-ignore
  {@attach (dialog) => untrack(() => session.attach(dialog))}
  {@attach dismissal.attach}
>
  <div
    class="sheet"
    data-dragging={dismissal.distance > 0}
    style:translate={dismissal.distance > 0 ? `0 ${dismissal.distance}px` : undefined}
  >
    <div class="grip" data-drag-handle aria-hidden="true"><span></span></div>
    <header>
      <h2 id={`${id}-heading`}>
        {#if view !== "main"}
          <button class="back" type="button" onclick={back}>
            {titles[view]}<span class="visually-hidden">, back to menu</span>
          </button>
        {:else}
          <span class="heading-label">{titles[view]}</span>
        {/if}
      </h2>
    </header>
    <div class="body" bind:this={content} {@attach alignControls}>
      {#if view === "main"}
        <button class="brand" type="button" onclick={checkForUpdates}>
          <svg class="logo" viewBox="205 300 440 440" aria-hidden="true" focusable="false">
            <image href={asset("logo/guidepost-min.svg")} width="850" height="1100" transform="rotate(-28 425 510)" />
          </svg>
          <span class="copy">
            <strong>Guidepost <span class="version">v{version}</span></strong>
            <span role="status">{updateStatus || "Check for updates"}</span>
          </span>
          {#key updateAttempt}
            {#if updating}<span class="update-border" aria-hidden="true"></span>{/if}
            <span class={["refresh", updating && "animating"]} aria-hidden="true">
              <span class="row-icon i-material-symbols:refresh"></span>
            </span>
          {/key}
        </button>
        <div class="group">
          <button class="row" type="button" onclick={() => showView("account")}>
            <span class="row-icon i-material-symbols:account-circle-outline" aria-hidden="true"></span>
            <span class="copy"><strong>Guest</strong><span>User account</span></span>
            <span class="chevron i-material-symbols:chevron-right" aria-hidden="true"></span>
          </button>
          <button class="row" type="button" onclick={() => showView("settings")}>
            <span class="row-icon i-material-symbols:settings-outline" aria-hidden="true"></span>
            <span class="copy"><strong>Settings</strong><span>Display and gameplay options</span></span>
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
              <li class="notice" data-kind={notice.kind}>
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
                  {#if notice.details?.length}
                    <details>
                      <summary>View editions ({notice.details.length})</summary>
                      <ul>
                        {#each notice.details as detail, index (index)}
                          <li>{detail}</li>
                        {/each}
                      </ul>
                    </details>
                  {/if}
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
        <ToggleButton pressed={glass.enabled} onclick={() => glass.setEnabled(!glass.enabled)} style="margin-block-end: 0.75rem">
          Glass effects
        </ToggleButton>
        <div class="date-settings">
          <label for={`${id}-date-format`}>Date format</label>
          <Select id={`${id}-date-format`} value={dates.dateFormat} onchange={(event) => dates.setDateFormat(event.currentTarget.value)}>
            {#each dates.formats as format (format.value)}
              <option value={format.value}>{format.label}</option>
            {/each}
          </Select>
        </div>
        <HuntSettings />
        <ShowdownSettings {onnavigate} />
        <div class="reset-settings">
          <button class="reset" type="button" disabled={resetting} onclick={() => resetDialog.show()}>
            {resetting ? "Deleting saved data…" : "Reset saved data"}
          </button>
          <p class="description">Permanently delete all saved collections and settings from this browser.</p>
          {#if resetError}<p class="error" role="alert">{resetError}</p>{/if}
        </div>
      {/if}
    </div>
    <footer>
      <div class="status">
        <span class={["connection", !online && "offline"]}></span>{online ? "Online" : "Offline"}<span>Saved on this device</span>
      </div>
      <div class="toggle-space" aria-hidden="true"></div>
    </footer>
  </div>
</dialog>

<ConfirmDialog
  bind:this={resetDialog}
  title="Reset saved data?"
  description="This permanently deletes all data from every app database in this browser, including all collections, ownership, wishlists, missing-content marks, copy numbers, and app and hunt settings. The app will reload with default settings. This cannot be undone. Export a backup from your collection first if you want to keep it."
  confirmLabel="Reset saved data"
  confirmDisabled={resetting}
  onconfirm={resetData}
/>

<style>
  .clearance {
    block-size: calc(var(--size-floating-control) + var(--inset-floating-control) * 2 + env(safe-area-inset-bottom));
  }
  .launcher {
    z-index: 6;
    position: fixed;
    inset-block-end: max(0.5rem, env(safe-area-inset-bottom));
    inset-inline-end: max(0.5rem, env(safe-area-inset-right));
  }
  .scrim {
    z-index: 4;
    position: fixed;
    inset: 0;
    background: #00000080;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity var(--duration-fast),
      visibility var(--duration-fast);

    &.is-open {
      opacity: 1;
      visibility: visible;
    }
  }
  dialog {
    --space-menu: 0.75rem;
    --toggle-padding-inline: 0.5rem;
    --toggle-padding-block: 0.5rem;

    z-index: 5;
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
    transition: display var(--duration-fast);
    transition-behavior: allow-discrete;

    &[open] {
      display: flex;
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
    border-start-start-radius: clamp(0px, calc((var(--viewport-width, 100vw) - 24rem) * 1e5), var(--radius-card));
    background: var(--surface-glass);
    backdrop-filter: var(--filter-glass);
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
  }
  .toggle-space {
    flex: none;
    inline-size: var(--toggle-size, var(--size-floating-control));
    block-size: var(--toggle-size, var(--size-floating-control));
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
    border-block-end: var(--border-width) solid var(--grey-7);
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
    padding-inline-end: max(0px, calc(var(--toggle-padding-inline) - var(--width-scrollbar, 0px)));
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
  .reset-settings {
    display: grid;
    gap: 0.5rem;
    margin-block-start: 1.25rem;
    padding-block-start: 1rem;
    border-block-start: var(--border-width) solid var(--grey-7);
  }
  .reset {
    min-block-size: 2.75rem;
    padding: 0.5rem 0.875rem;
    border: var(--border-width) solid var(--destructive);
    border-radius: var(--radius-control);
    background: var(--panel);
    color: var(--destructive);
    font-weight: var(--font-semibold);

    &:is(:hover, :focus-visible):not(:disabled) {
      background: var(--destructive);
      color: var(--foreground);
    }
  }
  .brand {
    position: relative;
    margin-block-end: var(--space-menu);
    overflow: clip;
    overflow-clip-margin: border-box;
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-control);
    background:
      radial-gradient(ellipse 85% 180% at 8% 50% in oklch, #ffb25140 0%, #fb823b33 24%, #d440301a 58%, transparent 100%), var(--background);

    &::after {
      content: "";
      position: absolute;
      inset: calc(-1 * var(--border-width));
      border: var(--border-width) solid var(--grey-7);
      border-radius: inherit;
      pointer-events: none;
    }
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
  .refresh {
    display: grid;
    flex: none;
    place-items: center;

    &.animating .row-icon {
      animation: refresh-spin 1s linear 2;
    }
  }
  @property --menu-update-angle {
    syntax: "<angle>";
    inherits: false;
    initial-value: 0deg;
  }
  .update-border {
    position: absolute;
    z-index: 1;
    inset: calc(-1 * var(--border-width));
    padding: var(--border-width);
    border-radius: inherit;
    background: repeating-conic-gradient(
      from var(--menu-update-angle),
      var(--green-7) 0deg,
      var(--green-8) 45deg,
      var(--green-9) 90deg,
      var(--green-8) 135deg,
      var(--green-7) 180deg
    );
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    pointer-events: none;
    animation: update-border-turn 2s linear both;
  }
  @keyframes update-border-turn {
    from {
      --menu-update-angle: 0deg;
      opacity: 0;
    }
    20%,
    80% {
      opacity: 1;
    }
    to {
      --menu-update-angle: 360deg;
      opacity: 0;
    }
  }
  @keyframes refresh-spin {
    to {
      transform: rotate(360deg);
    }
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
    background: var(--panel);
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
    border-block-start: var(--border-width) solid var(--grey-7);
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
  .notice {
    display: flex;
    padding-block: 0.875rem;
    gap: 0.75rem;
    border-block-end: var(--border-width) solid var(--grey-7);

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
  details {
    margin-block-start: 0.5rem;
    font-size: var(--text-sm);
  }
  summary {
    padding-block: 0.375rem;
    color: var(--accent);
    cursor: pointer;
  }
  ul {
    display: grid;
    margin-block-start: 0.375rem;
    padding-inline-start: 1.25rem;
    gap: 0.375rem;
    list-style: disc;
    overflow-wrap: anywhere;
  }
  .notice-icon {
    --size-icon: 1.25rem;
    flex: none;
    color: var(--accent);
  }
  .notice[data-kind="error"] .notice-icon,
  .error {
    color: var(--red-3);
  }
  .notice[data-kind="success"] .notice-icon {
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
    .refresh.animating .row-icon,
    .update-border {
      animation: none;
    }
    .sheet,
    dialog[open] .sheet {
      translate: none;
    }
  }
</style>
