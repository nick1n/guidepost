import type { HuntValues } from "./preference-store.ts";

const decks = {
  ccg: { aspectRatio: 1122 / 1797, doubleSided: [73], ext: "png" },
  fen: { aspectRatio: 1059 / 1500, doubleSided: [], ext: "png" },
  kekasi: { aspectRatio: 958 / 1504, doubleSided: [11, 73], ext: "jpg" },
};

export function huntImages(card: number, options: HuntValues) {
  const { option, bravadoBeta, devilSatan, gregalopeCE } = options;
  const deck = decks[option];
  let suffix = "";
  if (card === 38 && gregalopeCE && option === "ccg") suffix = "-ce";
  else if (card === 78 && bravadoBeta) suffix = "-beta";
  else if (card === 85 && devilSatan) suffix = "-devil";
  const path = `kdm/hunts/${option}/${option}`;
  return {
    aspectRatio: deck.aspectRatio,
    front: `${path}-${card}${suffix}.${deck.ext}`,
    back: `${path}-back.${deck.ext}`,
    reverse: deck.doubleSided.some((value) => value === card) ? `${path}-${card}-back.${deck.ext}` : undefined,
  };
}

export function selectDigit(card: number, place: number, digit: number) {
  const tens = Math.floor(card / 10) % 10;
  const ones = card % 10;
  return (place === 10 ? digit * 10 + ones : tens * 10 + digit) || 100;
}
