import type { EditionSelection } from "#lib/catalog-view.ts";
import { collectionKey } from "#lib/types/collection.ts";
type NamedEdition = { item: { name: string }; edition: { label: string } };

export function editionName({ item, edition }: NamedEdition) {
  return `${item.name} (${edition.label})`;
}

export function wishMessage(target: NamedEdition, wished: boolean) {
  return `${editionName(target)} ${wished ? "added to" : "removed from"} your wishlist.`;
}

export function includedMessage(target: NamedEdition, present: boolean, restoring = false) {
  return `${editionName(target)} ${present ? (restoring ? "restored" : "marked as present") : "marked as missing"}.`;
}

export function copyNumberMessage(target: NamedEdition, copyNumber: number | undefined) {
  return `${editionName(target)} copy number ${copyNumber === undefined ? "cleared" : `set to ${copyNumber}`}.`;
}

export function ownershipMessage(targets: readonly EditionSelection[], owned: boolean) {
  const unique = new Map(targets.map((target) => [collectionKey(target.item.id, target.edition.id), target]));
  const names = [...unique.values()].map(editionName);
  if (!names.length) return false;
  const status = owned ? "owned" : "not owned";
  return names.length > 3
    ? { message: `${names.length} editions marked as ${status}.`, details: names }
    : `${names.join("; ")} marked as ${status}.`;
}
