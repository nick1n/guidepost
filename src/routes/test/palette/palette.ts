import themeCss from "../../../app.css?raw";

type Color = { lightness: number; chroma: number; hue: number };
type Reference = Color & { name: string; hex: string };

const referenceValues = [
  ["cost-bg", "#1c4970"],
  ["border", "#335571"],
  ["bg-bottom", "#3c84d4"],
  ["bg-top", "#64b3f2"],
  ["pattern", "#13acfd"],
  ["alert", "#5ecefc"],
  ["shadow", "#2e5a6d"],
  ["banner", "#66c4e8"],
  ["beta", "#61c3fd"],
] as const;

const greenReferenceValues = [
  ["cost-bg", "#336428"],
  ["border", "#44683c"],
  ["bg-bottom", "#418a38"],
  ["bg-top", "#5a9f46"],
] as const;

const redReferenceValues = [
  ["bg-bottom", "#992f2c"],
  ["bg-top", "#f76b5d"],
  ["back", "#6d3828"],
  ["sfa-back", "#601714"],
  ["sfa-fore", "#d14941"],
  ["fa-fore", "#ff411b"],
] as const;

// Taper the dark-end steps toward the 20% lightness floor.
export const lightnessLevels = [95, 87, 79, 71, 63, 55, 45, 36, 29, 24, 20];

const chromaLevels = {
  blue: [0.02, 0.06, 0.11, 0.16, 0.16, 0.14, 0.11, 0.08, 0.05, 0.03, 0.02],
  green: [0.03, 0.07, 0.12, 0.17, 0.21, 0.2, 0.12, 0.09, 0.06, 0.04, 0.03],
  red: [0.02, 0.05, 0.09, 0.13, 0.17, 0.2, 0.16, 0.12, 0.08, 0.05, 0.03],
  // Fit the six red references at a shared 30° hue, preserving the lightness steps.
  // red: [0.02, 0.05, 0.09, 0.175, 0.23, 0.173, 0.142, 0.079, 0.105, 0.06],
};

type ColorFamily = keyof typeof chromaLevels;
type Family = ColorFamily | "grey";

function linearRgb({ lightness: L, chroma: C, hue }: Color) {
  const a = C * Math.cos((hue * Math.PI) / 180);
  const b = C * Math.sin((hue * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function fromHex(hex: string): Color {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const axisB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    chroma: Math.hypot(a, axisB),
    hue: normalizeHue((Math.atan2(axisB, a) * 180) / Math.PI),
  };
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

export const blueReferences = referenceValues.map(([name, hex]) => ({ name, hex, ...fromHex(hex) }));
export const greenReferences = greenReferenceValues.map(([name, hex]) => ({ name, hex, ...fromHex(hex) }));
export const redReferences = redReferenceValues.map(([name, hex]) => ({ name, hex, ...fromHex(hex) }));

// Blue 270° gives red 30°, minimizing the six red references' combined squared OKLab distance.
export const defaultBlueHue = 256;

function luminance(rgb: number[]) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function themeColor(token: string) {
  const definition = themeCss.match(new RegExp("--" + token + ":\\s*oklch\\(([^)]+)\\)"))?.[1];
  if (!definition) throw new Error("Missing OKLCH theme color: " + token);
  const [L, C, H] = definition.trim().split(/\s+/);
  const color = {
    lightness: Number.parseFloat(L) / (L.endsWith("%") ? 100 : 1),
    chroma: Number.parseFloat(C),
    hue: Number.parseFloat(H),
  };
  return { ...color, css: "var(--" + token + ")", luminance: luminance(linearRgb(color)) };
}

// Read the same theme declarations as the rendered samples so contrast stays in sync.
const textColors = { light: themeColor("grey-0"), dark: themeColor("grey-10") };

function contrast(left: number, right: number) {
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function makeShade(family: ColorFamily, level: number, hue: number) {
  const lightness = lightnessLevels[level] / 100;
  let low = 0;
  let high = chromaLevels[family][level];
  // Reduce only chroma to fit sRGB, preserving the requested hue and lightness.
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const chroma = (low + high) / 2;
    if (linearRgb({ lightness, chroma, hue }).every((value) => value >= 0 && value <= 1)) low = chroma;
    else high = chroma;
  }
  const precision = family === "red" ? 1000 : 100;
  const chroma = Math.floor((low + 1e-9) * precision) / precision;
  return describeShade(family, level, { lightness, chroma, hue });
}

function describeShade(family: Family, level: number, { lightness, chroma, hue }: Color) {
  const rgb = linearRgb({ lightness, chroma, hue });
  const hex =
    "#" +
    rgb
      .map((value) => {
        const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
        return Math.round(Math.max(0, Math.min(1, encoded)) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("");
  const shadeLuminance = luminance(rgb);
  const lightContrast = contrast(shadeLuminance, textColors.light.luminance);
  const darkContrast = contrast(shadeLuminance, textColors.dark.luminance);
  return {
    family,
    level,
    lightness,
    chroma,
    hue,
    hex,
    css: "oklch(" + Math.round(lightness * 100) + "% " + chroma + " " + hue + ")",
    lightContrast,
    darkContrast,
    text: lightContrast > darkContrast ? textColors.light.css : textColors.dark.css,
  };
}

export type Shade = ReturnType<typeof describeShade>;

function makeRow(family: ColorFamily, hue: number) {
  return {
    family,
    name: family[0].toUpperCase() + family.slice(1),
    hue: normalizeHue(hue),
    shades: lightnessLevels.map((_, index) => makeShade(family, index, normalizeHue(hue))),
  };
}

export function makePalette(blueHue: number) {
  return {
    id: "triadic",
    name: "Triadic",
    rows: [
      makeRow("blue", blueHue),
      makeRow("green", blueHue - 120),
      makeRow("red", blueHue - 240),
      {
        family: "grey" as const,
        name: "Grey",
        hue: 0,
        shades: Array.from({ length: lightnessLevels.length }, (_, level) => describeShade("grey", level, themeColor("grey-" + level))),
      },
    ],
  };
}

export type Palette = ReturnType<typeof makePalette>;

function distance(left: Color, right: Color) {
  const a = (color: Color) => color.chroma * Math.cos((color.hue * Math.PI) / 180);
  const b = (color: Color) => color.chroma * Math.sin((color.hue * Math.PI) / 180);
  return Math.sqrt((left.lightness - right.lightness) ** 2 + (a(left) - a(right)) ** 2 + (b(left) - b(right)) ** 2);
}

export function matchReferences(shades: Shade[], references: Reference[] = blueReferences) {
  return references.map((reference) => ({
    reference,
    nearest: shades
      .map((shade) => ({
        shade,
        lightnessDifference: (shade.lightness - reference.lightness) * 100,
        difference: distance(reference, shade) * 100,
      }))
      .sort((left, right) => left.difference - right.difference)
      .slice(0, 2),
  }));
}

export function exportCss(palette: Palette) {
  const families: Family[] = ["red", "green", "blue", "grey"];
  const rows = palette.rows.toSorted((left, right) => families.indexOf(left.family) - families.indexOf(right.family));
  const references = { red: redReferences, green: greenReferences, blue: blueReferences, grey: [] };
  const matches = rows.flatMap((row) => matchReferences(row.shades, references[row.family]));
  return (
    ":root {\n" +
    rows
      .map((row) =>
        row.shades
          .map((shade) => {
            const references = matches.filter((match) => match.nearest[0].shade === shade).map((match) => match.reference.name);
            const comment = shade.hex + (references.length ? "; closest to: " + references.join(", ") : "");
            return "  --" + row.family + "-" + shade.level + ": " + shade.css + "; /* " + comment + " */";
          })
          .join("\n"),
      )
      .join("\n\n") +
    families
      .filter((family) => references[family].length)
      .map(
        (family) =>
          "\n\n  /* Exact reference colors for roles that need the original " +
          family +
          ". */\n" +
          references[family].map((reference) => "  --" + family + "-" + reference.name + ": " + reference.hex + ";").join("\n"),
      )
      .join("") +
    "\n}"
  );
}
