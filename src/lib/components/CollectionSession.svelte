<script lang="ts">
  import { collection } from "#lib/state/collection.svelte.ts";
  import { db } from "#lib/state/instant.ts";
  import { InstantStore, LocalGuestStore } from "#lib/state/stores.ts";

  const auth = db.useAuth();
  const states = db.useQuery(() =>
    auth.user && !auth.user.isGuest ? { contentStates: { $: { where: { userId: auth.user.id } } } } : null,
  );
  let guestSignInStarted = false;
  let localGuestStore: LocalGuestStore | undefined;
  let instantStore: InstantStore | undefined;

  // Required side effect: guest authentication is an external InstantDB operation that begins only after auth has resolved.
  $effect(() => {
    if (!auth.isLoading && !auth.user && !auth.error && !guestSignInStarted) {
      guestSignInStarted = true;
      db.auth.signInAsGuest().catch(() => {
        guestSignInStarted = false;
      });
    }
  });

  // Required side effect: selects the active store and copies InstantDB query results into its adapter whenever auth or remote data changes.
  $effect(() => {
    const user = auth.user;
    if (!user) return;
    collection.setUser(user.id);

    if (user.isGuest) {
      localGuestStore ??= new LocalGuestStore(user.id);
      void collection.setStore(localGuestStore);
      return;
    }

    instantStore ??= new InstantStore(user.id);
    void collection.setStore(instantStore, localGuestStore);
    if (states.data?.contentStates) instantStore.setRows(states.data.contentStates);
    collection.refresh();
  });
</script>
