import { createContext } from "svelte";

type GearDrag = {
  slots: (string | null)[];
  slot: number;
  item: string;
};

type GearSelection = GearDrag & {
  isSelected: () => boolean;
  clear: () => void;
};

export const [getGearDrag, setGearDrag] = createContext<{ current: GearDrag | null; selection: GearSelection | null }>();

const trinketStart = 10;
const trinketRowSize = 3;
const slotLimit = trinketStart + 3 * trinketRowSize;

export function trinketSpace(slots: (string | null)[]) {
  const empty = slots.findIndex((item, index) => index >= trinketStart && index < slotLimit && item === null);
  if (empty !== -1) return empty;
  return slots.length < slotLimit ? slots.length : -1;
}

export function canDropGear(source: GearDrag | null, slots: (string | null)[], target: number) {
  const newRow = target === slots.length && (target === trinketStart + trinketRowSize || target === trinketStart + 2 * trinketRowSize);
  return Boolean(
    source &&
    source.slot > 0 &&
    source.slots[source.slot] === source.item &&
    source.item &&
    target > 0 &&
    (target < slots.length || newRow) &&
    (source.slots === slots || slots[target] === null || newRow),
  );
}

export function dropGear(source: GearDrag | null, slots: (string | null)[], target: number) {
  if (!source || !canDropGear(source, slots, target)) return false;
  if (target === slots.length) slots.push(...Array<null>(trinketRowSize).fill(null));
  const displaced = slots[target];
  slots[target] = source.item;
  source.slots[source.slot] = displaced;
  return true;
}
