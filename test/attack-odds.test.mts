import { describe, expect, it } from "vitest";
import { attackOdds } from "../src/lib/components/showdown/attack-odds.ts";
import { attackStats, makeSheet } from "../src/lib/components/showdown/data.ts";

describe("attack odds", () => {
  it("uses the survivor's perfect hit range for the attack target", () => {
    const sheet = makeSheet();
    const monster = { toughness: 6, luck: 0, evasion: 0 };

    expect(attackStats(sheet, "Founding Stone", monster).phit).toBe(10);
    sheet.perfectHitRange = 2;
    expect(attackStats(sheet, "Founding Stone", monster).phit).toBe(9);
    sheet.perfectHitRange = 10;
    expect(attackStats(sheet, "Founding Stone", monster).phit).toBe(1);
    sheet.perfectHitRange = 0;
    expect(attackStats(sheet, "Founding Stone", monster).phit).toBeNull();
  });

  it("caps accuracy at the perfect hit target", () => {
    const sheet = makeSheet();
    const monster = { toughness: 6, luck: 0, evasion: 4 };

    sheet.perfectHitRange = 2;
    expect(attackStats(sheet, "Fist & Tooth", monster)).toMatchObject({ acc: 9, phit: 9 });
    expect(attackOdds(attackStats(sheet, "Fist & Tooth", monster)).hitPerDie).toBeCloseTo(0.2);

    sheet.perfectHitRange = 0;
    expect(attackStats(sheet, "Fist & Tooth", monster)).toMatchObject({ acc: 10, phit: null });
  });

  it("counts hits and wounds across every Speed die", () => {
    const attack = attackStats(makeSheet(), "Founding Stone", { toughness: 6, luck: 0, evasion: 0 });
    const odds = attackOdds(attack);

    expect(attack).toMatchObject({ speed: 2, acc: 7, wound: 5 });
    expect(odds.hitPerDie).toBeCloseTo(0.4);
    expect(odds.woundGivenHit).toBeCloseTo(0.6);
    expect(odds.anyHit).toBeCloseTo(0.64);
    expect(odds.anyWound).toBeCloseTo(0.4224);
    expect(odds.expectedHits).toBeCloseTo(0.8);
    expect(odds.expectedWounds).toBeCloseTo(0.48);
    expect(odds.hits.none).toBeCloseTo(0.36);
    expect(odds.hits.one).toBeCloseTo(0.48);
    expect(odds.hits.many).toBeCloseTo(0.16);
    expect(odds.wounds.none).toBeCloseTo(0.5776);
    expect(odds.wounds.one).toBeCloseTo(0.3648);
    expect(odds.wounds.many).toBeCloseTo(0.0576);
    expect(odds.critGivenHit).toBeCloseTo(0.1);
    expect(odds.anyCrit).toBeCloseTo(0.0784);
    expect(odds.expectedCrits).toBeCloseTo(0.08);
    expect(odds.crits.none).toBeCloseTo(0.9216);
    expect(odds.crits.one).toBeCloseTo(0.0768);
    expect(odds.crits.many).toBeCloseTo(0.0016);
  });

  it("uses the Crit target and reports no critical rolls when monster luck prevents them", () => {
    const sheet = makeSheet();
    const monster = { toughness: 6, luck: 0, evasion: 0 };
    const attack = attackStats(sheet, "Fist & Tooth", monster);
    const odds = attackOdds(attack);

    expect(attack.crit).toBe(9);
    expect(odds.critGivenHit).toBeCloseTo(0.2);
    expect(odds.anyCrit).toBeCloseTo(0.1164);

    const impossible = attackOdds(attackStats(sheet, "Fist & Tooth", { ...monster, luck: 2 }));
    expect(impossible.critGivenHit).toBe(0);
    expect(impossible.crits).toEqual({ none: 1, one: 0, many: 0 });
  });

  it("includes monster evasion and the automatic natural 10 hit", () => {
    const attack = attackStats(makeSheet(), "Fist & Tooth", { toughness: 6, luck: 0, evasion: 4 });
    const odds = attackOdds(attack);

    expect(attack.acc).toBe(10);
    expect(odds.hitPerDie).toBeCloseTo(0.1);
    expect(odds.anyHit).toBeCloseTo(0.19);
  });

  it("keeps the multiple-result band empty with one die", () => {
    const odds = attackOdds({ speed: 1, acc: 10, wound: 10, crit: 10 });

    expect(odds.hits.none).toBeCloseTo(0.9);
    expect(odds.hits.one).toBeCloseTo(0.1);
    expect(odds.hits.many).toBe(0);
    expect(odds.wounds.none).toBeCloseTo(0.99);
    expect(odds.wounds.one).toBeCloseTo(0.01);
    expect(odds.wounds.many).toBe(0);
    expect(odds.crits.none).toBeCloseTo(0.99);
    expect(odds.crits.one).toBeCloseTo(0.01);
    expect(odds.crits.many).toBe(0);
  });
});
