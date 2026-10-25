<script lang="ts">
  import "@unocss/reset/tailwind-v4.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { createHashNavigation, setHashNavigation } from "#lib/app/navigation/hash-route.svelte.ts";
  import { afterNavigate } from "$app/navigation";
  import { Effect, Fiber } from "effect";
  import { resetSavedData } from "#lib/app/delete-data.ts";
  import { Collection, setCollection } from "#lib/kdm/collection/state/collection.svelte.ts";
  import { createCollectionActions, setCollectionActions } from "#lib/kdm/collection/state/collection-actions.ts";
  import { CollectionSession } from "#lib/kdm/collection/state/collection-session.ts";
  import { Notifications } from "#lib/app/notifications/notifications.ts";
  import { SiteMenu, setSiteMenu } from "#lib/app/menu/site-menu.svelte.ts";
  import { DatePreferences, setDatePreferences } from "#lib/app/preferences/date-preferences.svelte.ts";
  import { GlassPreferences, setGlassPreferences } from "#lib/app/preferences/glass-preferences.svelte.ts";
  import { AppPreferences } from "#lib/app/preferences/preferences.svelte.ts";
  import { NotificationLog, setNotificationLog } from "#lib/app/notifications/notification-log.svelte.ts";
  import { ShowdownDisplay, setShowdownDisplay } from "#lib/kdm/showdown/display.svelte.ts";
  import { HuntPreferences, setHuntPreferences } from "#lib/kdm/hunt/preferences.svelte.ts";
  import { CopyNumberEdits, setCopyNumberEdits } from "#lib/kdm/collection/state/copy-number-edits.svelte.ts";
  import SiteMenuPanel from "#lib/app/menu/SiteMenu.svelte";

  let { children } = $props();
  const collection = setCollection(new Collection());
  const session = new CollectionSession(collection);
  let deleting = false;
  let stopStorage: Effect.Effect<void> = Effect.void;
  const resetData = Effect.fn("App.resetData")(() =>
    resetSavedData({
      prepare: Effect.sync(() => {
        deleting = true;
        collection.setUser(undefined);
      }),
      stop: stopStorage,
      reload: Effect.sync(() => location.reload()),
    }),
  );
  setSiteMenu(new SiteMenu());
  const log = setNotificationLog(new NotificationLog());
  const preferences = new AppPreferences(log.record);
  setDatePreferences(new DatePreferences(preferences));
  const glass = setGlassPreferences(new GlassPreferences(preferences));
  setShowdownDisplay(new ShowdownDisplay());
  const hunts = setHuntPreferences(new HuntPreferences(log.record));
  const collectionActions = setCollectionActions(createCollectionActions(Notifications.layerWith(log.record)));
  setHashNavigation(createHashNavigation(collectionActions.run));
  setCopyNumberEdits(new CopyNumberEdits(collection, collectionActions));

  function onbeforeunload(event: BeforeUnloadEvent) {
    if (deleting) return;
    if (!collection.hasPendingChanges && !hunts.hasPendingChanges && !preferences.hasPendingChanges) return;
    collection.flushPendingEdits();
    // IndexedDB work is asynchronous; allow the user to stay until all queued writes finish.
    event.preventDefault();
    event.returnValue = "";
  }

  function onvisibilitychange() {
    if (deleting) return;
    if (document.visibilityState === "hidden") collection.flushPendingEdits();
  }

  function onpagehide() {
    if (deleting) return;
    collection.flushPendingEdits();
  }

  afterNavigate(({ to }) => {
    navigator.serviceWorker?.controller?.postMessage({ type: "cache-page", path: to?.url.pathname });
  });

  // Database monitoring must follow loads and retries started anywhere in the app.
  $effect(() => {
    session.monitor(collection.canObserve);
  });

  // Shared CSS must update when either the system preference or the user's override changes.
  $effect(() => {
    document.documentElement.dataset.glass = String(glass.enabled);
    return () => delete document.documentElement.dataset.glass;
  });

  onMount(() => {
    const stopGlass = glass.start();
    const preferenceSession = Effect.runFork(preferences.run());
    const huntSession = Effect.runFork(hunts.run());
    const active = collectionActions.run(session.run("guest"), { success: false });
    stopStorage = Effect.all([Fiber.interrupt(preferenceSession), Fiber.interrupt(active), Fiber.interrupt(huntSession)], {
      concurrency: "unbounded",
      discard: true,
    });
    return () => {
      stopGlass();
      Effect.runFork(Fiber.interrupt(preferenceSession));
      Effect.runFork(Fiber.interrupt(active));
      Effect.runFork(Fiber.interrupt(huntSession));
    };
  });
</script>

<svelte:document {onvisibilitychange} />
<svelte:window {onbeforeunload} {onpagehide} />

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

{@render children()}
<SiteMenuPanel onreset={resetData} />
