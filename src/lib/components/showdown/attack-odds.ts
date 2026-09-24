import type { attackStats } from "./data";

type RollProfile = Pick<ReturnType<typeof attackStats>, "speed" | "acc" | "wound" | "crit">;

function spread(speed: number, chance: number) {
  const none = (1 - chance) ** speed;
  const one = speed * chance * (1 - chance) ** (speed - 1);
  return { none, one, many: speed === 1 ? 0 : Math.max(0, 1 - none - one) };
}

export function attackOdds({ speed, acc, wound, crit }: RollProfile) {
  const hitPerDie = (11 - acc) / 10;
  const woundGivenHit = (11 - wound) / 10;
  const critGivenHit = crit === null ? 0 : (11 - crit) / 10;
  const woundPerDie = hitPerDie * woundGivenHit;
  const critPerDie = hitPerDie * critGivenHit;
  const hits = spread(speed, hitPerDie);
  const wounds = spread(speed, woundPerDie);
  const crits = spread(speed, critPerDie);

  return {
    hitPerDie,
    woundGivenHit,
    critGivenHit,
    hits,
    wounds,
    crits,
    anyHit: 1 - hits.none,
    anyWound: 1 - wounds.none,
    anyCrit: 1 - crits.none,
    expectedHits: speed * hitPerDie,
    expectedWounds: speed * woundPerDie,
    expectedCrits: speed * critPerDie,
  };
}
