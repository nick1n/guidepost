<script lang="ts">
  import { page } from "$app/state";
  import { createHashRoute } from "#lib/app/navigation/hash-route.svelte.ts";
  import { huntHash } from "./url.ts";
  import { getHuntPreferences } from "#lib/kdm/hunt/preferences.svelte.ts";
  import Select from "#lib/components/Select.svelte";

  const preferences = getHuntPreferences();
  const route = createHashRoute(huntHash);
  const inHunt = $derived(page.route.id === "/kdm/hunt");
  const option = $derived(inHunt ? (route.value.art ?? preferences.option) : preferences.option);
  const id = $props.id();

  function onchange(event: Event & { currentTarget: HTMLSelectElement }) {
    const art = event.currentTarget.value;
    if (art !== "ccg" && art !== "fen" && art !== "kekasi") return;
    preferences.setOption(art);
    if (inHunt) route.replace({ ...route.value, art });
  }
</script>

<section aria-labelledby={`${id}-heading`}>
  <h3 id={`${id}-heading`}>Hunt events</h3>
  <label for={`${id}-option`}>Card images by</label>
  <Select id={`${id}-option`} value={option} {onchange}>
    <option value="ccg">Custom Content Group</option>
    <option value="fen">Fen</option>
    <option value="kekasi">Kekasi</option>
  </Select>
  <fieldset>
    <legend>Expansion cards</legend>
    <label for={`${id}-devil-satan`}>
      <input
        id={`${id}-devil-satan`}
        type="checkbox"
        checked={preferences.devilSatan}
        onchange={(event) => preferences.setDevilSatan(event.currentTarget.checked)}
      />
      Devil Satan
    </label>
    <label for={`${id}-bravado-beta`}>
      <input
        id={`${id}-bravado-beta`}
        type="checkbox"
        checked={preferences.bravadoBeta}
        onchange={(event) => preferences.setBravadoBeta(event.currentTarget.checked)}
      />
      Great Game Hunter - Bravado
    </label>
    <label for={`${id}-gregalope-ce`}>
      <input
        id={`${id}-gregalope-ce`}
        type="checkbox"
        checked={preferences.gregalopeCE}
        onchange={(event) => preferences.setGregalopeCE(event.currentTarget.checked)}
      />
      Gregalope CE (CCG only)
    </label>
  </fieldset>
</section>

<style>
  section {
    display: grid;
    margin-block: 1.25rem;
    padding-block-start: 1rem;
    gap: 0.75rem;
    border-block-start: var(--border-width) solid var(--grey-7);
  }
  h3 {
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    font-family: var(--font-display);
  }
  label,
  legend {
    font-size: var(--text-sm);
  }
  fieldset {
    display: grid;
    min-inline-size: 0;
    gap: 0.5rem;
  }
  legend {
    margin-block-end: 0.5rem;
    font-weight: var(--font-bold);
  }
  fieldset label {
    display: flex;
    align-items: center;
    min-block-size: 2.75rem;
    gap: 0.75rem;
    cursor: pointer;
  }
  input {
    inline-size: 1.125rem;
    block-size: 1.125rem;
    accent-color: var(--accent);
  }
</style>
