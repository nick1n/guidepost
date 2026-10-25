import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { huntImages, selectDigit } from "#lib/kdm/hunt/cards.ts";
import type { HuntOption } from "#lib/kdm/hunt/preference-store.ts";

const sets: readonly HuntOption[] = ["fen", "kekasi", "ccg"];

it("maps every tens and ones roll to its card, including 00 as card 0", () => {
  for (let tens = 0; tens <= 9; tens++) {
    for (let ones = 0; ones <= 9; ones++) {
      const afterTens = selectDigit(47, 10, tens);
      const afterOnes = selectDigit(47, 1, ones);
      const expected = tens * 10 + ones;
      expect(selectDigit(afterTens, 1, ones)).toBe(expected);
      expect(selectDigit(afterOnes, 10, tens)).toBe(expected);
    }
  }

  expect(selectDigit(0, 10, 0)).toBe(0);
  expect(selectDigit(0, 1, 0)).toBe(0);
});

it("provides an existing shared back and a positive aspect ratio for each deck", () => {
  for (const option of sets) {
    const images = huntImages(1, { option, bravadoBeta: false, devilSatan: false, gregalopeCE: false });
    expect(existsSync(resolve("static", images.back)), `${option} shared back`).toBe(true);
    expect(images.aspectRatio).toBeGreaterThan(0);
  }
});

it("uses source assets for each optional card variant in every setting combination", () => {
  for (const option of sets) {
    for (const bravadoBeta of [false, true]) {
      for (const devilSatan of [false, true]) {
        for (const gregalopeCE of [false, true]) {
          const settings = { option, bravadoBeta, devilSatan, gregalopeCE };

          for (let card = 0; card < 100; card++) {
            const images = huntImages(card, settings);
            expect(existsSync(resolve("static", images.front)), `${option} card ${card} with ${JSON.stringify(settings)}`).toBe(true);
          }

          const extension = option === "kekasi" ? "jpg" : "png";
          expect(huntImages(78, settings).front).toBe(`kdm/hunts/${option}/${option}-78${bravadoBeta ? "-beta" : ""}.${extension}`);
          expect(huntImages(85, settings).front).toBe(`kdm/hunts/${option}/${option}-85${devilSatan ? "-devil" : ""}.${extension}`);
          expect(huntImages(38, settings).front).toBe(
            `kdm/hunts/${option}/${option}-38${option === "ccg" && gregalopeCE ? "-ce" : ""}.${extension}`,
          );
        }
      }
    }
  }
});

it("declares and resolves only the cards with double-sided backs", () => {
  const doubleSided: Record<HuntOption, readonly number[]> = { fen: [], kekasi: [11, 73], ccg: [73] };

  for (const option of sets) {
    for (let card = 0; card < 100; card++) {
      const { reverse } = huntImages(card, { option, bravadoBeta: false, devilSatan: false, gregalopeCE: false });
      if (doubleSided[option].includes(card)) {
        expect(reverse).toBeDefined();
        expect(existsSync(resolve("static", reverse!)), `${option} card ${card} reverse`).toBe(true);
      } else {
        expect(reverse).toBeUndefined();
      }
    }
  }
});
