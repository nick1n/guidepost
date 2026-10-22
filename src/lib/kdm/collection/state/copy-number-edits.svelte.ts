import { Effect } from "effect";
import { createContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { EditionSelection } from "#lib/catalog-view.ts";
import { collectionKey } from "#lib/types/collection.ts";
import type { Collection } from "./collection.svelte.ts";
import { copyNumberMessage, type createCollectionActions } from "./collection-actions.ts";

const saveDelay = 1000;
type Draft = { itemId: string; value: string; flush: () => void; cancel: () => void };
type NumberInput = Pick<HTMLInputElement, "value" | "valueAsNumber" | "validity">;

export class CopyNumberEdits {
  private readonly drafts = new SvelteMap<string, Draft>();
  private readonly collection: Collection;
  private readonly actions: ReturnType<typeof createCollectionActions>;

  constructor(collection: Collection, actions: ReturnType<typeof createCollectionActions>) {
    this.collection = collection;
    this.actions = actions;
  }

  value(itemId: string, editionId: string) {
    return this.drafts.get(collectionKey(itemId, editionId))?.value;
  }

  update(target: EditionSelection, input: NumberInput) {
    if (!this.collection.canWrite) return;
    const key = collectionKey(target.item.id, target.edition.id);
    this.drafts.get(key)?.cancel();
    const number = input.value === "" && !input.validity.badInput ? undefined : input.valueAsNumber;
    const save = this.collection.forSession(this.collection.setCopyNumber(key, number));
    const success = copyNumberMessage(target, number);
    let submitted = false;
    const draft: Draft = {
      itemId: target.item.id,
      value: input.value,
      cancel: () => {
        clearTimeout(timer);
        if (!submitted) unregister();
      },
      flush: () => {
        if (submitted) return;
        submitted = true;
        clearTimeout(timer);
        this.actions.run(
          save.pipe(
            Effect.ensuring(
              Effect.sync(() => {
                unregister();
                if (this.drafts.get(key) === draft) this.drafts.delete(key);
              }),
            ),
          ),
          { success },
        );
      },
    };
    const unregister = this.collection.registerPendingEdit(draft.flush);
    const timer = setTimeout(draft.flush, saveDelay);
    this.drafts.set(key, draft);
  }

  flush(itemId?: string, editionId?: string) {
    if (itemId !== undefined && editionId !== undefined) {
      this.drafts.get(collectionKey(itemId, editionId))?.flush();
      return;
    }
    for (const draft of this.drafts.values()) {
      if (itemId === undefined || draft.itemId === itemId) draft.flush();
    }
  }

  keydown(itemId: string, editionId: string, event: KeyboardEvent) {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    this.flush(itemId, editionId);
  }
}

export const [getCopyNumberEdits, setCopyNumberEdits] = createContext<CopyNumberEdits>();
