import type { BaseItem } from "#lib/types/gen/kdm-gameplay.d.ts";

export function gameplayIconClass(icon: BaseItem["icon"]) {
  if (!icon) return;
  return typeof icon === "string" ? `i-${icon}` : `i-game-icons:${icon["game-icons"]}`;
}
