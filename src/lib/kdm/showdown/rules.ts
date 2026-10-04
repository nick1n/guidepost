import { tokenNet, type Sheet } from "./sheet";

export type AttackWeapon = "Founding Stone" | "Fist & Tooth";

type WeaponStats = { speed: number; accuracy: number; strength: number; luck: number; keywords: readonly string[] };

const weaponStats: Record<AttackWeapon, WeaponStats> = {
  "Founding Stone": { speed: 2, accuracy: 7, strength: 1, luck: 0, keywords: ["weapon", "melee", "stone"] },
  "Fist & Tooth": { speed: 2, accuracy: 8, strength: 0, luck: 1, keywords: ["weapon", "melee", "fist & tooth"] },
};

const clampTarget = (value: number) => Math.max(2, Math.min(10, value));

export function attackStats(sheet: Sheet, weapon: AttackWeapon, monster: { toughness: number; luck: number; evasion: number }) {
  const base = weaponStats[weapon];
  const modifier = (index: number) => (sheet.attributes[index] ?? 0) + (sheet.bonuses[index] ?? 0) + tokenNet(sheet.tokens[index]);
  const crit = 10 + monster.luck - base.luck - modifier(4);
  const phit = sheet.perfectHitRange <= 0 ? null : Math.max(1, 11 - Math.trunc(sheet.perfectHitRange));
  const accuracy = clampTarget(base.accuracy + monster.evasion - modifier(2) - Number(sheet.statuses.includes("status:blind-spot")));

  return {
    keywords: base.keywords,
    speed: Math.max(1, Math.trunc(base.speed + modifier(1))),
    phit,
    acc: phit === null ? accuracy : Math.min(accuracy, phit),
    wound: clampTarget(monster.toughness - base.strength - modifier(3)),
    crit: crit > 10 ? null : clampTarget(crit),
  };
}
