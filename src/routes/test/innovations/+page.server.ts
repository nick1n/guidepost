import core from "#static/kdm/data/core.json";
import { gameplayIconClass } from "#lib/kdm/gameplay-icon.ts";
import type { KingdomDeathMonsterSchema } from "#lib/types/gen/kdm-gameplay.d.ts";
import type { PageServerLoad } from "./$types";

const innovations = core.innovation as NonNullable<KingdomDeathMonsterSchema["innovation"]>;

function rollLabel(roll: number | number[] | undefined) {
  if (!Array.isArray(roll)) return roll?.toString() ?? "";
  return roll.length === 1 ? `${roll[0]}+` : roll.join("-");
}

export const load = (() => ({
  cards: Object.entries(innovations)
    .slice(-6)
    .map(([id, card]) => ({
      id,
      name: card.name,
      source: card.source,
      keywords: card.keywords?.map((keyword) => keyword.replaceAll("-", " ")).join(", "),
      description: card.description,
      highlight: card.highlight,
      artwork: gameplayIconClass(card.icon),
      artworkRotation: typeof card.icon === "object" ? card.icon.rotate : undefined,
      actions: Object.entries(card.action ?? {}).map(([actionId, action]) => ({
        headingId: `${id}-${actionId}`,
        name: action.name ?? card.name,
        description: action.description,
        endeavors: action.cost.reduce((total, cost) => {
          if (cost === "endeavor") return total + 1;
          if (typeof cost === "object" && cost.token === "endeavor") return total + (cost.x ?? 1);
          return total;
        }, 0),
        prompts: action.prompts?.map(({ r, q }, position) => ({ position, label: rollLabel(r), text: q ?? "" })),
      })),
    })),
})) satisfies PageServerLoad;
