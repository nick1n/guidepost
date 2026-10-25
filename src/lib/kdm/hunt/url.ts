import type { HuntOption } from "./preference-store.ts";
import { formatHash, readHash } from "#lib/app/navigation/hash.ts";

export type HuntFace = "front" | "back" | "reverse";
export type HuntView = { event: number; art: HuntOption | undefined; show: HuntFace };

export function readHuntHash(hash: string): HuntView {
  if (!hash.startsWith("#/")) return { event: 1, art: undefined, show: "back" };
  const segments = readHash(hash) ?? [];
  const [event = "", art, show] = segments;
  return {
    event: /^\d{1,2}$/.test(event) ? Number(event) : 1,
    art: art === "fen" || art === "kekasi" ? art : "ccg",
    show: show === "front" || show === "reverse" ? show : "back",
  };
}

export function formatHuntHash(state: HuntView) {
  const art = state.art ?? "ccg";
  const segments = [String(state.event)];
  if (art !== "ccg" || state.show !== "back") segments.push(art);
  if (state.show !== "back") segments.push(state.show);
  return formatHash(segments);
}

export const huntHash = { read: readHuntHash, format: formatHuntHash };
