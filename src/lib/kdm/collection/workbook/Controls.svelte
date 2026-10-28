<script lang="ts">
  import { onDestroy } from "svelte";
  import { Effect, Fiber, Result } from "effect";
  import { getCollection } from "../state/collection.svelte.ts";
  import { getCollectionActions } from "../state/collection-actions.ts";
  import { TransferError } from "../state/collection-transfer.ts";
  import type { CollectionError } from "../state/collection-errors.ts";
  import { parseCollectionKey, type CollectionPatch, type EntryState } from "#lib/types/collection.ts";
  import { reviewEditions } from "#lib/catalog-view.ts";
  import type { WorkbookRow } from "#lib/types/workbook.ts";
  import type { Draft } from "./file.ts";
  import Select from "#lib/components/Select.svelte";

  let { showButtons, reviewing, onreview, onclose }: { showButtons: boolean; reviewing: boolean; onreview: Noop; onclose: Noop } = $props();
  const collection = getCollection();
  const actions = getCollectionActions();
  const id = $props.id();
  let input: HTMLInputElement;
  let busy = $state(false);
  let error = $state("");
  let errorInReview = $state(false);
  let status = $state("");
  let exporting = $state(false);
  let downloaded = $state(false);
  const importStatus = $derived.by(() => {
    if (busy && !exporting) return status;
    if (status.startsWith("Imported ")) return status;
    return drafts.length ? "Review selected workbook" : "";
  });
  const exportStatus = $derived.by(() => {
    if (exporting) return "Creating workbook…";
    return downloaded ? "Workbook downloaded." : "";
  });
  let drafts = $state.raw<Draft[]>([]);
  let selected = $state<Record<string, string>>({});
  let adapter = $state.raw<typeof import("./file.ts")>();
  const rows = $derived(adapter?.resolveDrafts(drafts, selected));
  let validated = $state.raw<{ rows: WorkbookRow[]; patch: CollectionPatch }>();
  const patch = $derived(validated?.rows === rows ? validated?.patch : undefined);
  const count = $derived(Object.keys(patch ?? {}).length);
  const choices = $derived(drafts.filter((draft) => draft.options.length));
  let current = Effect.void;
  let active: Fiber.Fiber<unknown, unknown> | undefined;

  const loadAdapter = Effect.tryPromise({
    try: () => import("./file.ts"),
    catch: () =>
      new TransferError({ operation: "import", reason: "invalid-data", message: "Workbook tools could not be loaded. Please try again." }),
  });

  onDestroy(() => {
    if (active) Effect.runFork(Fiber.interrupt(active));
  });

  function run(effect: Effect.Effect<unknown, TransferError | CollectionError>, success: string | false = false) {
    busy = true;
    error = "";
    active = actions.run(
      collection.forSession(effect).pipe(
        Effect.tapError((failure) =>
          Effect.sync(() => {
            error = failure.message;
            errorInReview = !exporting;
          }),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            busy = false;
            exporting = false;
          }),
        ),
      ),
      { success },
    );
  }

  function clearReview() {
    drafts = [];
    selected = {};
    validated = undefined;
  }

  function cancel() {
    clearReview();
    error = "";
    status = "";
    onclose();
  }

  function chooseFile() {
    input.value = "";
    input.click();
  }

  function importFile() {
    if (drafts.length) onreview();
    else chooseFile();
  }

  function onchange() {
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy) return;
    clearReview();
    status = "Reading workbook…";
    onreview();
    current = collection.forSession(Effect.void);
    run(
      Effect.gen(function* () {
        adapter = yield* collection.forSession(loadAdapter);
        const result = yield* collection.forSession(adapter.readWorkbook(file));
        yield* current;
        drafts = result;
        status = result.length
          ? "Review the workbook before importing."
          : "No collection values were found. Blank and unchecked cells are left unchanged.";
        if (!result.some((draft) => draft.options.length)) yield* validatePreview();
      }),
    );
  }

  const validatePreview = Effect.fn("WorkbookControls.preview")(function* () {
    yield* current;
    validated = undefined;
    const resolved = rows;
    if (!adapter || !resolved) return;
    const result = yield* collection.previewWorkbook(resolved, adapter.mapping);
    yield* current;
    validated = { rows: resolved, patch: result };
  });

  function selectEdition(draftId: string, selection: string) {
    selected[draftId] = selection;
    run(validatePreview());
  }

  function optionLabel(draft: Draft, editionId: string) {
    const source = adapter?.mapping.rows.find((source) => source.sheet === draft.row.sheet && source.row === draft.row.row);
    const target = [source?.primary, ...Object.values(source?.releaseEditions ?? {}).flat()].find(
      (target) => target?.editionId === editionId,
    );
    const item = target && collection.catalog.byId.get(target.contentId);
    const label = item?.editions?.find((edition) => edition.id === editionId)?.label ?? editionId;
    return label;
  }

  function entryLabel(key: string) {
    const parsed = parseCollectionKey(key);
    if (Result.isFailure(parsed)) return key;
    const [contentId, editionId] = parsed.success;
    const item = collection.catalog.byId.get(contentId);
    const edition = item && reviewEditions(item).find((edition) => edition.id === editionId);
    return `${item?.name ?? contentId} (${edition?.label ?? editionId})`;
  }

  function changes(entry: EntryState) {
    const fields = [];
    if (entry.owned !== undefined) fields.push(entry.owned ? "owned" : "not owned");
    if (entry.wished !== undefined) fields.push(entry.wished ? "wanted" : "not wanted");
    if (entry.missing !== undefined) fields.push(entry.missing ? "missing" : "present");
    if (entry.copyNumber !== undefined) fields.push(`copy number ${entry.copyNumber}`);
    return fields.join(", ");
  }

  function confirmImport() {
    if (!validated || validated.rows !== rows || !adapter || !count || busy) return;
    const imported = validated.rows;
    const mapping = adapter.mapping;
    collection.flushPendingEdits();
    run(
      Effect.gen(function* () {
        yield* current;
        yield* collection.importWorkbook(imported, mapping);
        status = `Imported ${count} editions.`;
        clearReview();
        onclose();
      }),
      `Imported ${count} editions from the workbook.`,
    );
  }

  function exportFile() {
    if (busy) return;
    const session = collection.forSession(Effect.void);
    downloaded = false;
    // The existing button subtitle reserves the space for progress and completion feedback.
    exporting = true;
    collection.flushPendingEdits();
    run(
      Effect.gen(function* () {
        const tools = yield* collection.forSession(loadAdapter);
        const exported = yield* collection.exportWorkbook();
        const bytes = yield* collection.forSession(tools.writeWorkbook(exported, collection.catalog.entries));
        yield* session;
        yield* tools.downloadWorkbook(bytes);
        downloaded = true;
      }),
      "Collection workbook downloaded.",
    );
  }
</script>

<input bind:this={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" {onchange} hidden />
{#if showButtons}
  <div class="group">
    <button
      type="button"
      onclick={importFile}
      disabled={busy || !collection.canWrite}
      aria-busy={busy && !exporting}
      aria-describedby={importStatus ? `${id}-import-status` : undefined}
    >
      <span class="icon i-material-symbols:upload-file-outline" aria-hidden="true"></span>
      <span class="copy progress">
        <strong>Import workbook</strong>
        <small class={["placeholder", importStatus && "concealed"]}>Merge a collection .xlsx file</small>
        {#if importStatus}<small class="feedback" aria-hidden="true">{importStatus}</small>{/if}
      </span>
    </button>
    <button
      type="button"
      onclick={exportFile}
      disabled={busy || !collection.canWrite}
      aria-busy={exporting}
      aria-describedby={exportStatus ? `${id}-export-status` : undefined}
    >
      <span class="icon i-material-symbols:download" aria-hidden="true"></span>
      <span class="copy progress">
        <strong>Export workbook</strong>
        <small class={["placeholder", exportStatus && "concealed"]}>Download your collection as .xlsx</small>
        {#if exportStatus}<small class="feedback" aria-hidden="true">{exportStatus}</small>{/if}
      </span>
    </button>
  </div>
  <span id={`${id}-import-status`} class="visually-hidden" role="status">{importStatus}</span>
  <span id={`${id}-export-status`} class="visually-hidden" role="status">{exportStatus}</span>
  {#if !collection.canWrite}<p>Load or refresh your collection to use workbook transfers.</p>{/if}
  {#if error && !errorInReview}<p class="error" role="alert">{error}</p>{/if}
{/if}
{#if reviewing}
  <section aria-label="Review workbook import">
    <p role="status">{error && errorInReview ? "" : status}</p>
    {#if error && errorInReview}<p class="error" role="alert">{error}</p>{/if}
    {#if drafts.length}
      <p>Import merges the listed fields. Other collection entries stay unchanged.</p>
      {#if choices.length}<p>Select an edition for each ambiguous release.</p>{/if}
      {#each choices as draft (draft.id)}
        <label for={`${id}-${encodeURIComponent(draft.id)}`}>
          {draft.row.name}, {draft.row.wished ? "wanted" : draft.row.owned ? "owned" : "copy number"}
          {#if draft.hint}<small>Workbook value: {draft.hint}</small>{/if}
        </label>
        <Select
          id={`${id}-${encodeURIComponent(draft.id)}`}
          value={selected[draft.id] ?? ""}
          onchange={(event) => selectEdition(draft.id, event.currentTarget.value)}
          disabled={busy}
        >
          <option value="">Select an edition</option>
          {#each draft.options as option (JSON.stringify(option))}
            <option value={JSON.stringify(option)}>{option.label ?? optionLabel(draft, option.editionId)}</option>
          {/each}
        </Select>
      {/each}
      {#if patch}
        <details>
          <summary>{count} editions to import</summary>
          <ul>
            {#each Object.entries(patch) as [key, entry] (key)}
              <li>{entryLabel(key)}: {changes(entry)}</li>
            {/each}
          </ul>
        </details>
      {/if}
    {/if}
    <div class="actions">
      <button type="button" onclick={cancel} disabled={busy}>Cancel</button>
      {#if drafts.length}
        <button type="button" onclick={confirmImport} disabled={busy || !rows || !count || !collection.canWrite}
          >Import {count || "selected"} editions</button
        >
      {:else}
        <button type="button" onclick={chooseFile} disabled={busy || !collection.canWrite}>Choose workbook</button>
      {/if}
    </div>
  </section>
{/if}

<style>
  .group {
    margin-block-end: 1rem;
    overflow: hidden;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  button {
    display: flex;
    align-items: center;
    inline-size: 100%;
    min-block-size: 4rem;
    padding: 0.875rem;
    gap: 0.75rem;
    text-align: start;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
    &:enabled:hover {
      background: var(--card);
    }
  }
  .group button + button {
    border-block-start: var(--border-width) solid var(--grey-7);
  }
  .icon {
    --size-icon: 1.5rem;
    flex: none;
    color: var(--accent);
  }
  .copy {
    display: grid;
    gap: 0.25rem;
  }
  .copy > small {
    line-height: var(--line-height-snug);
  }
  .progress {
    position: relative;
  }
  .placeholder {
    &.concealed {
      visibility: hidden;
    }
  }
  .feedback {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
  }
  strong {
    font-weight: var(--font-bold);
    font-size: var(--text-md);
  }
  small,
  p {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
  p:empty {
    display: none;
  }
  p {
    margin-block-end: 0.75rem;
  }
  .error {
    color: var(--destructive);
  }
  section {
    display: grid;
    gap: 0.75rem;
    margin-block-end: 1rem;
  }
  section p {
    margin: 0;
  }
  label {
    font-size: var(--text-sm);
  }
  label small {
    display: block;
  }
  ul {
    padding-inline-start: 1.25rem;
    overflow-wrap: anywhere;
  }
  li {
    margin-block: 0.5rem;
    font-size: var(--text-sm);
  }
  .actions {
    display: flex;
    gap: 0.75rem;
  }
  .actions button {
    justify-content: center;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    border: var(--border-width) solid var(--grey-7);
    border-radius: var(--radius-control);
    background: var(--card);
    text-align: center;
  }
</style>
