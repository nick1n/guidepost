<script lang="ts">
  import "@unocss/reset/tailwind-v4.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { Effect, Fiber } from "effect";
  import { Collection, setCollection } from "#lib/kdm/collection/state/collection.svelte.ts";
  import { createCollectionActions, setCollectionActions } from "#lib/kdm/collection/state/collection-actions.ts";
  import { CollectionSession } from "#lib/kdm/collection/state/collection-session.ts";
  import { Notifications } from "#lib/app/notifications.ts";
  import { SiteMenu, setSiteMenu } from "#lib/app/site-menu.svelte.ts";
  import { DatePreferences, setDatePreferences } from "#lib/app/date-preferences.svelte.ts";
  import { NotificationLog, setNotificationLog } from "#lib/app/notification-log.svelte.ts";
  import { ShowdownDisplay, setShowdownDisplay } from "#lib/kdm/showdown/display.svelte.ts";
  import { CopyNumberEdits, setCopyNumberEdits } from "#lib/kdm/collection/state/copy-number-edits.svelte.ts";
  import SiteMenuPanel from "#lib/app/SiteMenu.svelte";

  let { children } = $props();
  const collection = setCollection(new Collection());
  const session = new CollectionSession(collection);
  setSiteMenu(new SiteMenu());
  const log = setNotificationLog(new NotificationLog());
  const dates = setDatePreferences(new DatePreferences(log.record));
  setShowdownDisplay(new ShowdownDisplay());
  const collectionActions = setCollectionActions(createCollectionActions(Notifications.layerWith(log.record)));
  setCopyNumberEdits(new CopyNumberEdits(collection, collectionActions));

  function onbeforeunload(event: BeforeUnloadEvent) {
    if (!collection.hasPendingChanges) return;
    collection.flushPendingEdits();
    // IndexedDB work is asynchronous; allow the user to stay until all queued writes finish.
    event.preventDefault();
    event.returnValue = "";
  }

  function onvisibilitychange() {
    if (document.visibilityState === "hidden") collection.flushPendingEdits();
  }

  function onpagehide() {
    collection.flushPendingEdits();
  }

  afterNavigate(({ to }) => {
    navigator.serviceWorker?.controller?.postMessage({ type: "cache-page", path: to?.url.pathname });
  });

  // Database monitoring must follow loads and retries started anywhere in the app.
  $effect(() => {
    session.monitor(collection.canObserve);
  });

  onMount(() => {
    dates.loadDateFormat();
    const active = collectionActions.run(session.run("guest"), { success: false });
    return () => {
      Effect.runFork(Fiber.interrupt(active));
    };
  });
</script>

<svelte:document {onvisibilitychange} />
<svelte:window {onbeforeunload} {onpagehide} />

<svelte:head>
  <title>Guidepost</title>
</svelte:head>

{@render children()}
<SiteMenuPanel />
