import { KD_ICONS, type KdIconName } from "#lib/constants.ts";
import { parseInline, type InlineSegment } from "#lib/inline-markdown.ts";
import { parseMarkdown } from "#lib/markdown.ts";

export const cardSize = 672;

// Raster ribbons use this order. Keep the former Head and Body atlas slots reserved.
const ribbonLabels = {
  Watcher: "The Watcher",
  "Injury Head": "Injury Head",
  "Injury Body": "Injury Body",
  Strain: "Strain",
  BL: "Black Lion",
  DBK: "Dung Beetle Knight",
  DK: "Dragon King",
  FK: "Flower Knight",
  GRM: "Gorm",
  Homebrew: "Homebrew",
  LG: "Lion God",
  LK: "Lion Knight",
  LT: "Lonely Tree",
  MH: "Manhunter",
  PNIX: "Phoenix",
  RK: "Rose Knight",
  SA: "Screaming Antelope",
  SK: "Storm Knight",
  SM: "Slenderman",
  SPID: "Spidicules (green)",
  SPURK: "Spidicules (orange)",
  SS: "Sunstalker",
  Tyrant: "The Tyrant",
  WL: "White Lion",
  "SM plum": "Slenderman (plum)",
  "GRM bronze": "Gorm (bronze)",
  "Tyrant amber": "The Tyrant (amber)",
  "Black Knight": "Black Knight",
  "The King": "The King",
  "Luck wanderer": "Wanderer Luck",
  "Parasite Queen": "Parasite Queen",
  Pariah: "Pariah",
  "Red Witches": "Red Witches",
  "Hollow Heart": "Red Witches (Hollow Heart)",
  "Screaming God": "Screaming God",
  "Screaming Nukealope": "Screaming Nukealope",
  Aeneas: "Wanderer Aeneas",
  "Aeneas antelope": "Wanderer Aeneas (Screaming Antelope)",
  "Candy and Cola": "Wanderer Candy & Cola",
  "Death Drifter": "Wanderer Death Drifter",
  Goth: "Wanderer Goth",
  Preacher: "Wanderer Preacher",
  "Smog Singers": "Smog Singers",
  "Morgan the Savior": "Morgan the Savior",
  "Snow the Savior": "Snow the Savior",
  "Injury Arms": "Injury Arms",
  "Injury Legs": "Injury Legs",
  "Injury Waist": "Injury Waist",
  "Knowledge 0": "Knowledge (0)",
  "Knowledge 1": "Knowledge (1)",
  "Knowledge 2": "Knowledge (2)",
  "Knowledge 3": "Knowledge (3)",
  "Knowledge 4": "Knowledge (4)",
  "Knowledge 5": "Knowledge (5)",
  "Knowledge 6": "Knowledge (6)",
  "Knowledge unranked": "Knowledge (-)",
  None: "None",
};
type Ribbon = keyof typeof ribbonLabels;
const injuryIcons: Partial<Record<Ribbon, KdIconName>> = {
  "Injury Head": "hit-head",
  "Injury Body": "hit-body",
  "Injury Arms": "hit-arms",
  "Injury Legs": "hit-legs",
  "Injury Waist": "hit-waist",
};
const ribbons = Object.keys(ribbonLabels) as Ribbon[];
export const ribbonOptions = ribbons
  .map((value) => ({ value, label: ribbonLabels[value] }))
  .sort((a, b) => a.label.localeCompare(b.label, "en"));
export const backgrounds = [
  "Paper",
  "White",
  "Black",
  "Disorder (Dark)",
  "Disorder (Light)",
  "Injury (Dark)",
  "Injury (Light)",
  "Custom",
] as const;
export const bodyTypefaces = ["Template", "Amplitude", "Nimbus", "Arial"] as const;
type Background = (typeof backgrounds)[number];
type BodyTypeface = (typeof bodyTypefaces)[number];

type CardTypeStyle = { headerTop: string; headerBottom: string; background: Background; ribbon: Ribbon };
const fightingArtStyle = { headerTop: "#f76b5d", headerBottom: "#9a302d", background: "Paper", ribbon: "Watcher" } as const;
export const cardTypes = {
  "Fighting art": fightingArtStyle,
  "Secret fighting art": fightingArtStyle,
  Ability: { headerTop: "#24acde", headerBottom: "#2365b8", background: "Paper", ribbon: "Watcher" },
  Impairment: { headerTop: "#93bc58", headerBottom: "#3b4855", background: "White", ribbon: "Watcher" },
  Strain: { ...fightingArtStyle, background: "White", ribbon: "Strain" },
  Disorder: { headerTop: "#272727", headerBottom: "#2c2e3b", background: "Disorder (Dark)", ribbon: "Watcher" },
  "Severe injury": { headerTop: "#e74201", headerBottom: "#573845", background: "Injury (Dark)", ribbon: "Injury Head" },
  Custom: { headerTop: "#695984", headerBottom: "#302940", background: "Paper", ribbon: "None" },
} satisfies Record<string, CardTypeStyle>;

export const bodyTypography = {
  bodySize: { label: "Body text size", min: 16, max: 42, step: 0.125 },
  lineHeight: { label: "Line height", min: 18, max: 64, step: 0.25 },
  bodyOffset: { label: "Vertical offset", min: -120, max: 120, step: 0.25 },
  horizontalOffset: { label: "Horizontal offset", min: -24, max: 24, step: 0.25 },
  letterSpacing: { label: "Letter spacing", min: -3, max: 3, step: 0.0625 },
  paragraphGap: { label: "Paragraph gap", min: 0, max: 64, step: 0.25 },
};
type TypographyField = keyof typeof bodyTypography;
export const bodySizeSteps = [
  { label: "Small", offset: -6 },
  { label: "Default", offset: 0 },
  { label: "Large", offset: 6 },
  { label: "Extra large", offset: 12 },
] as const;
type BodySizeStep = (typeof bodySizeSteps)[number]["label"];

export type CardType = keyof typeof cardTypes;
export type Card = CardTypeStyle &
  Partial<Record<TypographyField, number>> & {
    type: CardType;
    title: string;
    subtitle: string;
    content: string;
    bodyColor: string;
    typeface: BodyTypeface;
    bodySizeStep: BodySizeStep;
    alignment: "balanced" | "pretty" | "center" | "left";
    edgeRules: boolean;
    textOutline: boolean;
    footer: string;
  };

export const cardDefaults = {
  bodyColor: "#e8eded",
  typeface: "Template",
  bodySizeStep: "Default",
  alignment: "balanced",
  edgeRules: false,
  textOutline: false,
} satisfies Partial<Card>;

const headerHeight = 209;
const baseFooterHeight = 130;
const baseFooterTop = cardSize - baseFooterHeight;
const footerLineHeight = 43;
const ribbonWidth = 102;
const ribbonHeight = 202;
const ribbonStrip = 3405;
const strainWatermark = ribbonStrip + 8 * ribbonHeight;
const dividerMargin = 72;
const dividerThickness = 2;
const bodyPadding = 60;
const bodyVerticalPadding = 12;
const leftTextMargin = 68;
const bodyOutlineScale = 0.16;
const headingFont = '"Card Silverado Medium", "Times New Roman", serif';
const footerFont = { font: `37px ${headingFont}`, spacing: "0px" };
const footerTextWidth = cardSize - 2 * dividerMargin;
const bodyFonts = {
  Amplitude: '"Card Amplitude", Arial, sans-serif',
  Nimbus: '"Card Nimbus", Arial, sans-serif',
  Arial: "Arial, sans-serif",
};
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

type Run = { text: string; font: string; spacing: string };
type MeasuredRun = Run & { width: number };
type Word = { runs: Run[]; width: number; space?: MeasuredRun };
type BodyRow =
  | { kind: "line"; runs: MeasuredRun[]; width: number; inkLeft: number; inkRight: number; inkTop: number; inkBottom: number }
  | { kind: "gap" | "rule" | "edge" };
type BodyBlock = { kind: "paragraph"; lines: InlineSegment[][] } | { kind: "rule" };

function setFont(ctx: CanvasRenderingContext2D, { font, spacing }: Pick<Run, "font" | "spacing">) {
  ctx.font = font;
  ctx.letterSpacing = spacing;
}

function runWidth(ctx: CanvasRenderingContext2D, run: Run) {
  setFont(ctx, run);
  return ctx.measureText(run.text).width;
}

function inlineIconScale(name: KdIconName) {
  if (name === "deck" || name.startsWith("deck-")) return 0.8;
  return name === "story" ? 1.25 : 1;
}

function measureWords(ctx: CanvasRenderingContext2D, segments: InlineSegment[], size: number, style: BodyStyle) {
  const { typeface, letterSpacing } = style;
  const words: Word[] = [];
  let word: Word | undefined;
  for (const segment of segments) {
    const icon = segment.kind === "icon";
    const weight = segment.kind === "strong" ? 700 : 400;
    const italic = segment.kind === "em" ? "italic " : "";
    const font = `${italic}${weight} ${size}px ${bodyFonts[typeface]}`;
    // The source templates use wider, heavier emphasis than the browser's synthetic bold face.
    const spacing = `${letterSpacing + (segment.kind === "strong" ? size / 36 : 0)}px`;
    const parts = icon ? [KD_ICONS[segment.value]] : segment.value.split(/(\s+)/).filter(Boolean);
    for (const text of parts) {
      if (!icon && /^\s+$/.test(text)) {
        word = undefined;
        continue;
      }

      // Only whitespace opens a new word, so markup boundaries cannot strand punctuation.
      if (!word) {
        const gap = { text: " ", font, spacing };
        const space = words.length ? { ...gap, width: runWidth(ctx, gap) } : undefined;
        word = { runs: [], width: 0, space };
        words.push(word);
      }
      const run: Run = icon
        ? { text, font: `${size * inlineIconScale(segment.value)}px "KD Icons"`, spacing: "0px" }
        : { text, font, spacing };
      word.runs.push(run);
      word.width += runWidth(ctx, run);
    }
  }
  return words.flatMap((word) => (word.width > style.width ? splitWord(ctx, word, style.width) : word));
}

function splitWord(ctx: CanvasRenderingContext2D, word: Pick<Word, "runs" | "space">, widthLimit: number) {
  const chunks: Word[] = [];
  let chunk: Word = { runs: [], width: 0, space: word.space };
  for (const run of word.runs) {
    setFont(ctx, run);
    let text = "";
    for (const { segment } of graphemes.segment(run.text)) {
      if ((text || chunk.runs.length) && chunk.width + ctx.measureText(text + segment).width > widthLimit) {
        if (text) {
          chunk.runs.push({ ...run, text });
          chunk.width += ctx.measureText(text).width;
        }
        chunks.push(chunk);
        chunk = { runs: [], width: 0 };
        text = "";
      }
      text += segment;
    }
    chunk.runs.push({ ...run, text });
    chunk.width += ctx.measureText(text).width;
  }
  return [...chunks, chunk];
}

function chooseLineEnds(
  count: number,
  { width, alignment }: Pick<BodyStyle, "width" | "alignment">,
  widthOf: (start: number, end: number) => number,
) {
  const fitLine = (start: number) => {
    let end = start + 1;
    while (end < count && widthOf(start, end + 1) <= width) end++;
    return end;
  };
  if (fitLine(0) === count) return [count];

  if (alignment === "center") {
    const ends: number[] = [];
    let end = 0;
    while (end < count) {
      end = fitLine(end);
      ends.push(end);
    }
    return ends;
  }

  // Record how far a line can reach and the minimum number of lines for each suffix.
  const limits = new Uint32Array(count);
  const lineCounts = new Uint32Array(count + 1);
  for (let start = count - 1; start >= 0; start--) {
    const end = fitLine(start);
    limits[start] = end;
    lineCounts[start] = 1 + lineCounts[end];
  }

  const lineCount = lineCounts[0];
  const breaks = Array.from({ length: lineCount }, () => new Uint32Array(count));
  const pretty = alignment === "pretty";
  const proportions = breaks.map((_, line) => {
    if (alignment !== "balanced" || lineCount === 2) return 1;
    // Open gently toward the middle, then taper more at the foot of the paragraph.
    const progress = line / (lineCount - 1);
    return 1 + 0.64 * progress * (1 - progress) - 0.13 * progress;
  });
  const totalWidth = widthOf(0, count);
  const widthScale = totalWidth / proportions.reduce((sum, proportion) => sum + proportion, 0);
  const shortLineThreshold = Math.min(width / 2, (totalWidth / lineCount) * 0.75);

  // Pick the breaks with the smallest total squared deviation from the target widths.
  let nextCosts = new Float64Array(count + 1).fill(Infinity);
  nextCosts[count] = 0;
  for (let line = lineCount - 1; line >= 0; line--) {
    const remaining = lineCount - line;
    const prettyLastLine = pretty && remaining === 1;
    let target = widthScale * proportions[line];
    if (pretty) target = prettyLastLine ? shortLineThreshold : width;
    const costs = new Float64Array(count + 1).fill(Infinity);
    for (let start = line; start <= count - remaining; start++) {
      if (lineCounts[start] > remaining) continue;
      for (let end = start + 1; end <= limits[start]; end++) {
        const gap = target - widthOf(start, end);
        // Pretty favors full lines and penalizes very short endings without requiring the last line to fill the measure.
        const cost = (prettyLastLine ? 3 * Math.max(0, gap) : gap) ** 2 + nextCosts[end];
        if (cost < costs[start]) {
          costs[start] = cost;
          breaks[line][start] = end;
        }
      }
    }
    nextCosts = costs;
  }

  const ends: number[] = [];
  let start = 0;
  for (const line of breaks) {
    start = line[start];
    ends.push(start);
  }
  return ends;
}

function wrapBodyLine(ctx: CanvasRenderingContext2D, segments: InlineSegment[], size: number, style: BodyStyle): BodyRow[] {
  const words = measureWords(ctx, segments, size, style);
  if (!words.length) return [];

  const totals = [0];
  for (const word of words) totals.push(totals[totals.length - 1] + word.width + (word.space?.width ?? 0));
  const widthOf = (start: number, end: number) => totals[end] - totals[start] - (words[start].space?.width ?? 0);

  const rows: BodyRow[] = [];
  let start = 0;
  for (const end of chooseLineEnds(words.length, style, widthOf)) {
    const runs: Run[] = [];
    for (let index = start; index < end; index++) {
      const { runs: parts, space } = words[index];
      for (const run of index > start && space ? [space, ...parts] : parts) {
        const previous = runs.at(-1);
        if (previous && previous.font === run.font && previous.spacing === run.spacing) {
          previous.text += run.text;
        } else {
          runs.push({ ...run });
        }
      }
    }
    const measuredRuns: MeasuredRun[] = [];
    let width = 0;
    let inkLeft = 0;
    let inkRight = 0;
    let inkTop = Infinity;
    let inkBottom = -Infinity;
    for (const run of runs) {
      setFont(ctx, run);
      const metrics = ctx.measureText(run.text);
      inkLeft = Math.min(inkLeft, width - metrics.actualBoundingBoxLeft);
      inkRight = Math.max(inkRight, width + metrics.actualBoundingBoxRight);
      inkTop = Math.min(inkTop, -metrics.actualBoundingBoxAscent);
      inkBottom = Math.max(inkBottom, metrics.actualBoundingBoxDescent);
      width += metrics.width;
      measuredRuns.push({ ...run, width: metrics.width });
    }
    rows.push({ kind: "line", runs: measuredRuns, width, inkLeft, inkRight, inkTop, inkBottom });
    start = end;
  }
  return rows;
}

function layoutBody(ctx: CanvasRenderingContext2D, blocks: BodyBlock[], size: number, style: BodyStyle) {
  // Keep the outer dividers as layout anchors even when they are hidden.
  const rows: BodyRow[] = [{ kind: "edge" }];
  for (const [index, block] of blocks.entries()) {
    if (block.kind === "rule") {
      rows.push({ kind: "rule" });
    } else {
      if (blocks[index - 1]?.kind === "paragraph") rows.push({ kind: "gap" });
      for (const line of block.lines) rows.push(...wrapBodyLine(ctx, line, size, style));
    }
  }
  rows.push({ kind: "edge" });

  const heights = {
    line: style.lineHeight * (size / style.size),
    gap: style.paragraphGap * (size / style.size),
    rule: size,
    edge: Math.round(size * 0.62),
  };
  // Fit from the center of the top divider to the center of the bottom divider.
  const height = rows.reduce((total, row) => total + heights[row.kind], 0) - heights.edge;
  return { rows, heights, height, size };
}

type Header = { layer: number; sourceHeight: number; watermark?: number; divider: string };
const fightingArtHeader = { layer: 1394, sourceHeight: 209, watermark: 2448, divider: "#000" };
const headers: Record<CardType, Header> = {
  "Fighting art": fightingArtHeader,
  "Secret fighting art": fightingArtHeader,
  Strain: fightingArtHeader,
  Ability: { layer: 1603, sourceHeight: 207, watermark: 2657, divider: "#232323" },
  Disorder: { layer: 1812, sourceHeight: 206, divider: "#b3b3b3" },
  Impairment: { layer: 2021, sourceHeight: 207, watermark: 2862, divider: "#232323" },
  "Severe injury": { layer: 2230, sourceHeight: 207, watermark: 3071, divider: "#b3b3b3" },
  Custom: { layer: 1394, sourceHeight: 209, divider: "#161419" },
};

function drawPointedRibbon(ctx: CanvasRenderingContext2D, color: string) {
  const ribbon = new Path2D("M107 -1H162V170L134.5 197L107 170Z");
  ctx.fillStyle = color;
  ctx.fill(ribbon);
  ctx.strokeStyle = "#a9b7bb";
  ctx.lineWidth = 1.5;
  ctx.stroke(ribbon);
}

function fillGlyphInterior({ data, width, height }: ImageData) {
  // Trace the exterior up to the glyph's half-opacity contour, preserving the outer antialiasing.
  const exterior = new Uint8Array(width * height);
  const pending = [0];
  exterior[0] = 1;
  const visit = (pixel: number) => {
    if (exterior[pixel]) return;
    exterior[pixel] = 1;
    if (data[pixel * 4 + 3] < 128) pending.push(pixel);
  };
  while (pending.length) {
    const pixel = pending.pop()!;
    const x = pixel % width;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < exterior.length - width) visit(pixel + width);
  }

  // Composite the white foreground over black only in the enclosed areas.
  for (let pixel = 0; pixel < exterior.length; pixel++) {
    if (exterior[pixel]) continue;
    const offset = pixel * 4;
    const alpha = data[offset + 3];
    data[offset] = alpha;
    data[offset + 1] = alpha;
    data[offset + 2] = alpha;
    data[offset + 3] = 255;
  }
}

type RibbonGlyphLayer = { canvas: HTMLCanvasElement; left: number; top: number };
const backedRibbonGlyphs = new WeakMap<CanvasRenderingContext2D, Map<string, RibbonGlyphLayer>>();

function drawRibbonGlyph(ctx: CanvasRenderingContext2D, glyph: string, backing?: "black") {
  const layers = backing ? backedRibbonGlyphs.get(ctx) : undefined;
  const cached = layers?.get(glyph);
  if (cached) {
    ctx.drawImage(cached.canvas, cached.left, cached.top);
    return;
  }

  ctx.letterSpacing = "0px";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const {
    actualBoundingBoxAscent: ascent,
    actualBoundingBoxDescent: descent,
    actualBoundingBoxLeft,
    actualBoundingBoxRight,
  } = ctx.measureText(glyph);
  const x = 134.5;
  const y = 132 + (ascent - descent) / 2;
  if (!backing) {
    ctx.fillText(glyph, x, y);
    return;
  }

  const left = Math.floor(x - actualBoundingBoxLeft) - 2;
  const top = Math.floor(y - ascent) - 2;
  const canvas = ctx.canvas.ownerDocument.createElement("canvas");
  canvas.width = Math.ceil(x + actualBoundingBoxRight) + 2 - left;
  canvas.height = Math.ceil(y + descent) + 2 - top;
  const layer = canvas.getContext("2d");
  if (!layer) {
    ctx.fillText(glyph, x, y);
    return;
  }

  layer.font = ctx.font;
  layer.textAlign = ctx.textAlign;
  layer.textBaseline = ctx.textBaseline;
  layer.fillStyle = "#fff";
  layer.fillText(glyph, x - left, y - top);
  const pixels = layer.getImageData(0, 0, canvas.width, canvas.height);
  fillGlyphInterior(pixels);
  layer.putImageData(pixels, 0, 0);
  const backedGlyph = { canvas, left, top };
  if (layers) layers.set(glyph, backedGlyph);
  else backedRibbonGlyphs.set(ctx, new Map([[glyph, backedGlyph]]));
  ctx.drawImage(canvas, left, top);
}

function drawKnowledgeRibbon(ctx: CanvasRenderingContext2D, rank: string) {
  ctx.save();
  drawPointedRibbon(ctx, "#283c43");
  ctx.fillStyle = "#fff";
  ctx.fill(new Path2D("M123.5 113H145.5L156.5 132L145.5 151H123.5L112.5 132Z"));
  ctx.fillStyle = "#141a1d";
  ctx.font = "bold 25px Arial, sans-serif";
  drawRibbonGlyph(ctx, rank === "unranked" ? "-" : rank);
  ctx.restore();
}

function drawInjuryRibbon(ctx: CanvasRenderingContext2D, icon: KdIconName) {
  ctx.save();
  drawPointedRibbon(ctx, "#641c1e");
  ctx.font = '40px "KD Icons"';
  ctx.fillStyle = "#fff";
  drawRibbonGlyph(ctx, KD_ICONS[icon], "black");
  ctx.restore();
}

const titleOutline = { stroke: "rgba(0, 0, 0, 0.72)", width: 1.6, shadow: "rgba(0, 0, 0, 0.85)", blur: 4.1, offset: 1 };
const subtitleOutline = { stroke: "rgba(0, 0, 0, 0.71)", width: 1.5, shadow: "rgba(0, 0, 0, 0.6)", blur: 2, offset: 0.7 };

function withTypographicApostrophes(text: string) {
  // Silverado's straight apostrophe has wide side bearings.
  return text.replace(/([\p{L}\p{M}\p{N}])'/gu, "$1’");
}

function drawHeaderText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, outline: typeof titleOutline) {
  const maxWidth = ctx.textAlign === "center" ? cardSize - 2 * bodyPadding : cardSize - x - 38;
  ctx.save();
  ctx.strokeStyle = outline.stroke;
  ctx.lineWidth = outline.width;
  ctx.lineJoin = "round";
  ctx.shadowColor = outline.shadow;
  ctx.shadowBlur = outline.blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = outline.offset;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.restore();
  ctx.fillText(text, x, y, maxWidth);
}

function drawHeader(ctx: CanvasRenderingContext2D, card: Card, atlas: CanvasImageSource, header: Header) {
  const { headerTop: top, headerBottom: bottom } = cardTypes[card.type];
  if (card.type !== "Custom" && card.headerTop === top && card.headerBottom === bottom) {
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, cardSize, headerHeight);
    if (card.type === "Severe injury") {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, headerHeight - 2, cardSize, 2);
    }
    ctx.drawImage(atlas, 0, header.layer, cardSize, header.sourceHeight, 0, 0, cardSize, headerHeight);
  } else {
    const gradient = ctx.createLinearGradient(0, 25, 0, headerHeight - 4);
    gradient.addColorStop(0, card.headerTop);
    gradient.addColorStop(1, card.headerBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cardSize, headerHeight);
    if (header.watermark !== undefined) {
      ctx.drawImage(atlas, 0, header.watermark, cardSize, header.sourceHeight - 4, 0, 0, cardSize, headerHeight - 4);
    }
    ctx.fillStyle = header.divider;
    ctx.fillRect(0, headerHeight - 4, cardSize, 4);
  }

  const headerArtHeight = headerHeight - 3;
  if (card.type === "Strain" || card.ribbon === "Strain") {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(atlas, 0, strainWatermark, cardSize, 206, 0, 0, cardSize, headerArtHeight);
    ctx.restore();
  }

  const hasRibbon = card.ribbon !== "None";
  const injuryIcon = injuryIcons[card.ribbon];
  if (injuryIcon) {
    drawInjuryRibbon(ctx, injuryIcon);
  } else if (card.ribbon.startsWith("Knowledge ")) {
    drawKnowledgeRibbon(ctx, card.ribbon.slice("Knowledge ".length));
  } else if (hasRibbon) {
    const slot = ribbons.indexOf(card.ribbon);
    const sourceX = (slot % 6) * ribbonWidth;
    const sourceY = ribbonStrip + Math.floor(slot / 6) * ribbonHeight;
    const ribbonLeft = 95;
    const strain = card.ribbon === "Strain";
    const height = strain ? headerArtHeight : ribbonHeight;
    const offset = strain ? 24 : 0;
    const sourceOffset = (offset / height) * ribbonHeight;
    if (offset) {
      // Trim the pale extraction fringe while keeping the original fabric and emblem.
      ctx.save();
      ctx.clip(
        new Path2D(
          "M106 0H173V159Q173 162 169 165L157.5 175Q153 178.5 151 183Q149 188.5 144 192Q151 198 152 206H126Q126.5 198.5 134 192Q129.5 188.5 127.5 183Q125 177.5 121.5 174.5L109 164Q106 161.5 106 159Z",
        ),
      );
      // Mirror the top fabric to keep the lowered ribbon attached to the card edge.
      ctx.save();
      ctx.translate(0, offset);
      ctx.scale(1, -1);
      ctx.drawImage(atlas, sourceX, sourceY, ribbonWidth, sourceOffset, ribbonLeft, 0, ribbonWidth, offset);
      ctx.restore();
    }
    ctx.drawImage(atlas, sourceX, sourceY, ribbonWidth, ribbonHeight - sourceOffset, ribbonLeft, offset, ribbonWidth, height - offset);
    if (offset) {
      // The first atlas row is translucent. Cover the join with the opaque rows immediately below it.
      ctx.drawImage(atlas, sourceX, sourceY + 1, ribbonWidth, 2, ribbonLeft, offset - 1, ribbonWidth, 2);
      ctx.restore();
    }
  }

  const centered = !hasRibbon && card.alignment !== "left";
  const left = hasRibbon ? 181 : leftTextMargin;
  const x = centered ? cardSize / 2 : left;
  ctx.fillStyle = "#fff";
  ctx.textAlign = centered ? "center" : "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "0px";
  ctx.font = `52px ${headingFont}`;
  drawHeaderText(ctx, withTypographicApostrophes(card.title), x, 138, titleOutline);
  ctx.letterSpacing = "-1px";
  ctx.font = `24px ${bodyFonts.Amplitude}`;
  drawHeaderText(ctx, card.subtitle, hasRibbon ? x + 1 : x, 171, subtitleOutline);
  ctx.letterSpacing = "0px";
}

function isDark(hex: string) {
  const [red, green, blue] = (hex.slice(1).match(/../g) ?? []).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 < 0.179;
}

// The skull's center is 201 px below the top of the disorder artwork.
const disorderArtwork = { top: 463, height: 466, center: 201 };
const injuryArtwork = { top: 929, height: 465, center: 232.5 };
const bodyArtwork: Partial<Record<Background, typeof disorderArtwork & { invert: boolean }>> = {
  "Disorder (Dark)": { ...disorderArtwork, invert: false },
  "Disorder (Light)": { ...disorderArtwork, invert: true },
  "Injury (Dark)": { ...injuryArtwork, invert: false },
  "Injury (Light)": { ...injuryArtwork, invert: true },
};

function drawBodyBackground(ctx: CanvasRenderingContext2D, card: Card, atlas: CanvasImageSource, bottom: number) {
  const artwork = bodyArtwork[card.background];
  const height = bottom - headerHeight;
  const dark = card.background === "Black" || artwork?.invert === false || (card.background === "Custom" && isDark(card.bodyColor));
  ctx.fillStyle = dark || artwork ? "#000" : "#e8eded";
  if (card.background === "White") ctx.fillStyle = "#fdfdfd";
  if (card.background === "Custom") ctx.fillStyle = card.bodyColor;
  ctx.fillRect(0, headerHeight, cardSize, height);
  if (card.background === "Paper") {
    ctx.drawImage(atlas, 0, 0, cardSize, height, 0, headerHeight, cardSize, height);
  } else if (artwork) {
    // Use the original artwork scale, cropping or extending below as the footer changes.
    const frameHeight = baseFooterTop - headerHeight;
    const scale = Math.max(1, frameHeight / (2 * Math.min(artwork.center, artwork.height - artwork.center)));
    const sourceHeight = frameHeight / scale;
    const sourceWidth = cardSize / scale;
    const sourceLeft = (cardSize - sourceWidth) / 2;
    const sourceTop = artwork.center - sourceHeight / 2;
    const visibleHeight = Math.min(height, frameHeight);
    ctx.drawImage(atlas, sourceLeft, artwork.top + sourceTop, sourceWidth, visibleHeight / scale, 0, headerHeight, cardSize, visibleHeight);
    if (bottom > baseFooterTop) {
      const tail = sourceTop + sourceHeight;
      ctx.drawImage(
        atlas,
        sourceLeft,
        artwork.top + tail,
        sourceWidth,
        artwork.height - tail,
        0,
        baseFooterTop,
        cardSize,
        bottom - baseFooterTop,
      );
    }
    if (artwork.invert) {
      ctx.save();
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, headerHeight, cardSize, height);
      ctx.restore();
    }
  }
  return dark;
}

type BodyStyle = {
  alignment: Card["alignment"];
  typeface: keyof typeof bodyFonts;
  size: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphGap: number;
  width: number;
  left: number;
};

function fitBody(ctx: CanvasRenderingContext2D, card: Card, availableHeight: number, horizontalOffset: number) {
  const blocks = parseMarkdown(card.content).map<BodyBlock>((block) =>
    block.kind === "rule" ? block : { kind: "paragraph", lines: block.text.split("\n").map(parseInline) },
  );
  const disorder = card.type === "Disorder";
  const typeface = card.typeface === "Template" ? (disorder ? "Nimbus" : "Amplitude") : card.typeface;
  const baseSize = typographyOverride(card, "bodySize") ?? (disorder ? 33 : 30);
  const lineHeight = typographyOverride(card, "lineHeight");
  const paragraphGap = typographyOverride(card, "paragraphGap");
  const minimumSize = bodyTypography.bodySize.min;
  const baseStyle = {
    alignment: card.alignment,
    typeface,
    letterSpacing: typographyOverride(card, "letterSpacing") ?? (typeface === "Amplitude" ? -1 : 0),
  };
  const styleAtStep = (index: number): BodyStyle => {
    const size = Math.max(minimumSize, baseSize + bodySizeSteps[index].offset);
    // Leave room for glyph overhang and for the outline beyond the measured text advance.
    const inset = bodyPadding + Math.ceil(size / 8 + (card.textOutline ? (size * bodyOutlineScale) / 2 : 0));
    const left = Math.max(inset, leftTextMargin + horizontalOffset);
    const width = card.alignment === "left" ? cardSize - inset - left : cardSize - 2 * (inset + Math.abs(horizontalOffset));
    return {
      ...baseStyle,
      size,
      lineHeight: lineHeight ?? Math.round(size * (disorder ? 1.15 : 1.1)),
      paragraphGap: paragraphGap ?? Math.round(size * 0.95),
      width,
      left,
    };
  };

  const requestedStep = card.bodySizeStep ?? cardDefaults.bodySizeStep;
  let stepIndex = bodySizeSteps.findIndex(({ label }) => label === requestedStep);
  let style = styleAtStep(stepIndex);
  let layout = layoutBody(ctx, blocks, style.size, style);
  while (layout.height > availableHeight && stepIndex > 0) {
    stepIndex--;
    style = styleAtStep(stepIndex);
    layout = layoutBody(ctx, blocks, style.size, style);
  }
  // Keep the finer fitting range once the smallest preset is selected.
  while (layout.height > availableHeight && layout.size > minimumSize) {
    layout = layoutBody(ctx, blocks, Math.max(minimumSize, layout.size - 1), style);
  }
  return { layout, bodySizeStep: bodySizeSteps[stepIndex].label, left: style.left };
}

function positionBodyRows({ rows, heights }: ReturnType<typeof layoutBody>, top: number) {
  const centers: number[] = [];
  let previousDivider = -1;
  let inkTop = Infinity;
  let inkBottom = -Infinity;
  for (const [index, row] of rows.entries()) {
    const height = heights[row.kind];
    const center = top + height / 2;
    top += height;
    centers.push(center);

    if (row.kind === "line") {
      inkTop = Math.min(inkTop, center + row.inkTop);
      inkBottom = Math.max(inkBottom, center + row.inkBottom);
    } else if (row.kind === "rule" || row.kind === "edge") {
      const divider = Math.round(center) + dividerThickness / 2;
      centers[index] = divider;
      // Center the visible text between dividers, whose reserved heights can differ.
      if (previousDivider >= 0 && inkTop !== Infinity) {
        const offset = (centers[previousDivider] + divider - inkTop - inkBottom) / 2;
        for (let line = previousDivider + 1; line < index; line++) centers[line] += offset;
      }
      previousDivider = index;
      inkTop = Infinity;
      inkBottom = -Infinity;
    }
  }
  return centers;
}

function drawBody(ctx: CanvasRenderingContext2D, card: Card, atlas: CanvasImageSource, bottom: number, backgroundBottom: number) {
  const dark = drawBodyBackground(ctx, card, atlas, backgroundBottom);
  const availableHeight = bottom - headerHeight - 2 * bodyVerticalPadding;
  const horizontalOffset = typographyOverride(card, "horizontalOffset") ?? -1;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const { layout, bodySizeStep, left: textLeft } = fitBody(ctx, card, availableHeight, horizontalOffset);

  const { rows, heights, height } = layout;
  const fits = height <= availableHeight;
  const inset = Math.min(height, availableHeight);
  const offset = typographyOverride(card, "bodyOffset") ?? (card.type === "Severe injury" ? 2 : 0);
  const slack = (availableHeight - inset) / 2;
  const top = (headerHeight + bottom - inset - heights.edge) / 2 + Math.max(-slack, Math.min(slack, offset));
  const centers = positionBodyRows(layout, top);
  ctx.beginPath();
  ctx.rect(bodyPadding, headerHeight, cardSize - 2 * bodyPadding, bottom - headerHeight);
  ctx.clip();
  ctx.strokeStyle = dark ? "#000" : "#fff";
  ctx.lineWidth = layout.size * bodyOutlineScale;
  ctx.lineJoin = "round";
  const inkMargin = bodyPadding + (card.textOutline ? ctx.lineWidth / 2 : 0);

  // Draw all outlines before any fills so adjacent runs cannot cover each other with their strokes.
  const textPasses = card.textOutline ? [ctx.strokeText, ctx.fillText] : [ctx.fillText];
  for (const [index, row] of rows.entries()) {
    const middle = centers[index];
    if (row.kind === "line") {
      const preferredLeft = card.alignment === "left" ? textLeft : (cardSize - row.width) / 2 + horizontalOffset;
      const left = Math.max(inkMargin - row.inkLeft, Math.min(cardSize - inkMargin - row.inkRight, preferredLeft));
      ctx.fillStyle = dark ? "#fff" : "#000";
      for (const drawText of textPasses) {
        let x = left;
        for (const run of row.runs) {
          setFont(ctx, run);
          drawText.call(ctx, run.text, x, middle);
          x += run.width;
        }
      }
    } else if (row.kind === "rule" || (row.kind === "edge" && card.edgeRules)) {
      ctx.fillStyle = dark ? "#f5f0fa48" : "#131b2010";
      ctx.fillRect(dividerMargin, middle - dividerThickness / 2, cardSize - 2 * dividerMargin, dividerThickness);
    }
  }

  ctx.restore();
  return { fits, bodySizeStep };
}

function typographyOverride(card: Card, field: TypographyField) {
  const value = card[field];
  if (value === undefined || !Number.isFinite(value)) return;
  const { min, max } = bodyTypography[field];
  return Math.max(min, Math.min(max, value));
}

function wrapFooterLine(ctx: CanvasRenderingContext2D, text: string, alignment: Card["alignment"]) {
  const words = withTypographicApostrophes(text.trim()).match(/\s*\S+/g);
  if (!words) return [""];

  ctx.save();
  setFont(ctx, footerFont);
  const parts = words.flatMap((word) => {
    const text = word.trimStart();
    if (ctx.measureText(text).width <= footerTextWidth) return [word];
    const space = word.slice(0, word.length - text.length);
    const chunks = splitWord(ctx, { runs: [{ ...footerFont, text }] }, footerTextWidth);
    return chunks.map(({ runs }, index) => (index === 0 ? space : "") + runs.map(({ text }) => text).join(""));
  });
  const lineOf = (start: number, end: number) => parts.slice(start, end).join("").trimStart();
  const ends = chooseLineEnds(
    parts.length,
    { width: footerTextWidth, alignment },
    (start, end) => ctx.measureText(lineOf(start, end)).width,
  );
  ctx.restore();
  return ends.map((end, index) => lineOf(ends[index - 1] ?? 0, end));
}

function drawFooter(ctx: CanvasRenderingContext2D, atlas: CanvasImageSource, lines: string[], top: number, alignment: Card["alignment"]) {
  const sourceTop = 3275;
  const rimHeight = 3;
  const height = cardSize - top;
  // Keep the translucent rim and the bottom artwork at their original scale.
  ctx.fillStyle = "#e8eded";
  ctx.fillRect(0, top, cardSize, height);
  ctx.drawImage(atlas, 0, sourceTop, cardSize, rimHeight, 0, top, cardSize, rimHeight);
  const addedHeight = baseFooterTop - top;
  if (addedHeight > 0) {
    ctx.drawImage(atlas, 0, sourceTop + rimHeight + 1, cardSize, 1, 0, top + rimHeight, cardSize, addedHeight);
  }
  const solidHeight = baseFooterHeight - rimHeight;
  ctx.drawImage(atlas, 0, sourceTop + rimHeight, cardSize, solidHeight, 0, baseFooterTop + rimHeight, cardSize, solidHeight);
  ctx.fillStyle = "#fff";
  setFont(ctx, footerFont);
  ctx.textAlign = alignment === "left" ? "left" : "center";
  ctx.textBaseline = "middle";
  const x = alignment === "left" ? dividerMargin : cardSize / 2;
  for (const [index, line] of lines.entries()) {
    ctx.fillText(line, x, top + 45 + index * footerLineHeight, footerTextWidth);
  }
}

export function drawCard(ctx: CanvasRenderingContext2D, card: Card, atlas: CanvasImageSource) {
  ctx.clearRect(0, 0, cardSize, cardSize);
  const footer = card.footer.trim();
  const footerLines = footer ? footer.split(/\r\n?|\n/).flatMap((line) => wrapFooterLine(ctx, line, card.alignment)) : [];
  const footerTop = baseFooterTop - Math.max(0, footerLines.length - 1) * footerLineHeight;
  const footerFits = footerTop >= headerHeight + 2 * bodyVerticalPadding;
  const hasFooter = footerFits && footerLines.length > 0;
  drawHeader(ctx, card, atlas, headers[card.type]);
  // A blank footer extends the background while retaining the base text area.
  const bodyBottom = hasFooter ? footerTop : baseFooterTop;
  const body = drawBody(ctx, card, atlas, bodyBottom, hasFooter ? bodyBottom : cardSize);
  if (hasFooter) drawFooter(ctx, atlas, footerLines, footerTop, card.alignment);
  return { ...body, footerOverflow: !footerFits };
}

export function cardFilename(title: string) {
  const name = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return `${name || "reference-card"}.png`;
}
