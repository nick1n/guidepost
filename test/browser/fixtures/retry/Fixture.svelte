<script lang="ts">
  import { Effect, Layer } from "effect";
  import { createActions, setActions } from "#lib/app/actions.ts";
  import { Notifications } from "#lib/app/notifications/notifications.ts";
  import ErrorPage from "../../../../src/routes/+error.svelte";
  import { notices } from "./kit.ts";

  setActions(
    createActions(
      Layer.succeed(Notifications, {
        success: (message) => Effect.sync(() => void notices.push(message)),
        error: (message) => Effect.sync(() => void notices.push(message)),
      }),
    ),
  );
</script>

<ErrorPage />
