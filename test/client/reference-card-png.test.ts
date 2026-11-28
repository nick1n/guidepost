import { crc32, deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { optimizePngUrl } from "#routes/kdm/reference-card/png-export.ts";

const prefix = "data:image/png;base64,";
const signature = Buffer.from("89504e470d0a1a0a", "hex");

function chunk(type: string, data: Buffer) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length);
  bytes.write(type, 4, "ascii");
  data.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}

function constantScanlines(pixel: number[], filters: number[]) {
  const width = 64;
  return Buffer.concat(
    filters.map((filter, y) =>
      Buffer.from([
        filter,
        ...Array.from({ length: width }, (_, x) =>
          pixel.map((sample) => {
            if (filter === 0) return sample;
            if (filter === 1) return x === 0 ? sample : 0;
            if (filter === 2) return y === 0 ? sample : 0;
            if (filter === 3) return sample - Math.floor(((x > 0 ? sample : 0) + (y > 0 ? sample : 0)) / 2);
            return x === 0 && y === 0 ? sample : 0;
          }),
        ).flat(),
      ]),
    ),
  );
}

describe("lossless PNG export", () => {
  it("combines image data chunks without changing scanlines, header, or metadata", () => {
    const header = chunk("IHDR", Buffer.from("00000040000000400806000000", "hex"));
    const profile = chunk("sRGB", Buffer.from([0]));
    const end = chunk("IEND", Buffer.alloc(0));
    const scanlines = Buffer.alloc((64 * 4 + 1) * 64, 0);
    const deflated = deflateSync(scanlines, { level: 0 });
    const original = Buffer.concat([
      signature,
      header,
      profile,
      chunk("IDAT", deflated.subarray(0, 500)),
      chunk("IDAT", deflated.subarray(500)),
      end,
    ]);
    const output = Buffer.from(optimizePngUrl(prefix + original.toString("base64")).slice(prefix.length), "base64");

    expect(output.length).toBeLessThan(original.length);
    const imageData = signature.length + header.length + profile.length;
    expect(output.subarray(0, imageData)).toEqual(original.subarray(0, imageData));
    expect(output.toString("ascii", imageData + 4, imageData + 8)).toBe("IDAT");
    const dataEnd = imageData + 8 + output.readUInt32BE(imageData);
    expect(inflateSync(output.subarray(imageData + 8, dataEnd))).toEqual(scanlines);
    expect(output.readUInt32BE(dataEnd)).toBe(crc32(output.subarray(imageData + 4, dataEnd)));
    expect(output.subarray(dataEnd + 4)).toEqual(end);
  });

  it("removes an opaque alpha channel while preserving RGB samples and the color profile", () => {
    const profile = chunk("sRGB", Buffer.from([0]));
    const pixel = [33, 142, 211];
    const scanlines = constantScanlines(
      [...pixel, 255],
      Array.from({ length: 64 }, (_, y) => y % 5),
    );
    const original = Buffer.concat([
      signature,
      chunk("IHDR", Buffer.from("00000040000000400806000000", "hex")),
      profile,
      chunk("IDAT", deflateSync(scanlines, { level: 0 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    const output = Buffer.from(optimizePngUrl(prefix + original.toString("base64")).slice(prefix.length), "base64");

    expect(output.length).toBeLessThan(original.length);
    expect(output[25]).toBe(2);
    expect(output.readUInt32BE(29)).toBe(crc32(output.subarray(12, 29)));
    const imageData = 33 + profile.length;
    expect(output.subarray(33, imageData)).toEqual(profile);
    const dataEnd = imageData + 8 + output.readUInt32BE(imageData);
    const filtered = inflateSync(output.subarray(imageData + 8, dataEnd));
    const filters = Array.from({ length: 64 }, (_, y) => filtered[y * (64 * 3 + 1)]);
    expect(filtered).toEqual(constantScanlines(pixel, filters));
  });

  it("keeps a PNG whose image stream is already as small as the optimized stream", () => {
    const original = Buffer.concat([
      signature,
      chunk("IHDR", Buffer.from("00000001000000010806000000", "hex")),
      chunk("IDAT", Buffer.from("78da6300010000050001", "hex")),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    const url = prefix + original.toString("base64");
    expect(optimizePngUrl(url)).toBe(url);
  });
});
