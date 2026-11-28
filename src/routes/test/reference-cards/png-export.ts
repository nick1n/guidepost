import { unzlibSync, zlibSync } from "fflate";

const pngUrlPrefix = "data:image/png;base64,";
const idat = 0x49444154;
const chunkOverhead = 12;
const rgb = 2;
const rgba = 6;
const compression = { level: 9 } as const;

// PNG uses the same neighbor predictors for encoding and reconstructing scanlines.
const predictors = [
  () => 0,
  (left: number) => left,
  (_left: number, above: number) => above,
  (left: number, above: number) => (left + above) >> 1,
  (left: number, above: number, diagonal: number) => {
    const leftDistance = Math.abs(above - diagonal);
    const aboveDistance = Math.abs(left - diagonal);
    const diagonalDistance = Math.abs(left + above - 2 * diagonal);
    if (leftDistance <= aboveDistance && leftDistance <= diagonalDistance) return left;
    return aboveDistance <= diagonalDistance ? above : diagonal;
  },
];

function opaqueScanlines(scanlines: Uint8Array, width: number, height: number, channels: number) {
  const stride = width * channels;
  if (!width || !height || scanlines.length !== (stride + 1) * height) return;
  const rows = new Uint8Array((width * 3 + 1) * height);
  let above = new Uint8Array(stride);
  let row = new Uint8Array(stride);
  let source = 0;
  let target = 0;
  for (let y = 0; y < height; y++) {
    const predict = predictors[scanlines[source++]];
    if (!predict) return;
    target++; // Filter type 0, raw RGB samples.
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0;
      const diagonal = x >= channels ? above[x - channels] : 0;
      row[x] = scanlines[source++] + predict(left, above[x], diagonal);
      if (channels === 4 && x % 4 === 3) {
        if (row[x] !== 255) return;
      } else {
        rows[target++] = row[x];
      }
    }
    [above, row] = [row, above];
  }
  return rows;
}

function adaptiveFilters(raw: Uint8Array, width: number) {
  const stride = width * 3 + 1;
  const result = new Uint8Array(raw.length);
  const candidate = new Uint8Array(stride);
  for (let offset = 0; offset < raw.length; offset += stride) {
    let bestScore = Infinity;
    for (const [type, predict] of predictors.entries()) {
      let score = 0;
      candidate[0] = type;
      for (let x = 1; x < stride; x++) {
        const i = offset + x;
        const left = x > 3 ? raw[i - 3] : 0;
        const above = offset ? raw[i - stride] : 0;
        const diagonal = offset && x > 3 ? raw[i - stride - 3] : 0;
        const difference = (raw[i] - predict(left, above, diagonal)) & 255;
        candidate[x] = difference;
        score += Math.min(difference, 256 - difference);
      }
      if (score < bestScore) {
        result.set(candidate, offset);
        bestScore = score;
      }
    }
  }
  return result;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) * 0xedb88320);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function optimizePngUrl(url: string) {
  if (!url.startsWith(pngUrlPrefix)) return url;

  try {
    const png = Uint8Array.from(atob(url.slice(pngUrlPrefix.length)), (character) => character.charCodeAt(0));
    const view = new DataView(png.buffer);
    if (
      view.getUint32(0) !== 0x89504e47 ||
      view.getUint32(4) !== 0x0d0a1a0a ||
      view.getUint32(8) !== 13 ||
      view.getUint32(12) !== 0x49484452
    ) {
      return url;
    }
    const colorType = png[25];
    let canRefilter = png[24] === 8 && (colorType === rgb || colorType === rgba) && png.subarray(26, 29).every((value) => value === 0);
    const chunks: Uint8Array[] = [];
    let first = 0;
    let last = 0;
    let payloadSize = 0;

    for (let offset = 8; offset + chunkOverhead <= png.length;) {
      const size = view.getUint32(offset);
      const end = offset + size + chunkOverhead;
      if (end > png.length) return url;
      const type = view.getUint32(offset + 4);
      if (type === idat) {
        if (!first) first = offset;
        if (last && last !== offset) return url;
        last = end;
        chunks.push(png.subarray(offset + 8, end - 4));
        payloadSize += size;
      }
      // APNG frames can use different dimensions. RGBA sBIT metadata also describes the alpha channel.
      if (type === 0x6163544c || (type === 0x73424954 && colorType === rgba)) canRefilter = false;
      offset = end;
    }
    if (!chunks.length) return url;

    // PNG stores one zlib stream across its IDAT chunks.
    const payload = new Uint8Array(payloadSize);
    let offset = 0;
    for (const chunk of chunks) {
      payload.set(chunk, offset);
      offset += chunk.length;
    }
    const scanlines = unzlibSync(payload);
    let compressed = zlibSync(scanlines, compression);
    let outputColorType = colorType;
    if (canRefilter) {
      const width = view.getUint32(16);
      const height = view.getUint32(20);
      const raw = opaqueScanlines(scanlines, width, height, colorType === rgba ? 4 : 3);
      if (raw) {
        // Unfiltered rows can win on flat backgrounds. Adaptive filters help with textured artwork.
        for (const rows of [raw, adaptiveFilters(raw, width)]) {
          const candidate = zlibSync(rows, compression);
          if (candidate.length < compressed.length) {
            compressed = candidate;
            outputColorType = rgb;
          }
        }
      }
    }
    const chunkSize = compressed.length + chunkOverhead;
    if (chunkSize >= last - first) return url;

    const result = new Uint8Array(png.length - (last - first) + chunkSize);
    const resultView = new DataView(result.buffer);
    result.set(png.subarray(0, first));
    if (outputColorType !== colorType) {
      result[25] = outputColorType;
      resultView.setUint32(29, crc32(result.subarray(12, 29)));
    }
    resultView.setUint32(first, compressed.length);
    resultView.setUint32(first + 4, idat);
    result.set(compressed, first + 8);
    resultView.setUint32(first + 8 + compressed.length, crc32(result.subarray(first + 4, first + 8 + compressed.length)));
    result.set(png.subarray(last), first + chunkSize);

    let binary = "";
    for (let start = 0; start < result.length; start += 8192) {
      binary += String.fromCharCode(...result.subarray(start, start + 8192));
    }
    return pngUrlPrefix + btoa(binary);
  } catch {
    return url;
  }
}
