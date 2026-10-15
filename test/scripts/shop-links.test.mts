import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { checkShopLinks } from "#scripts/check-shop-links.mts";

// Every checkShopLinks call injects a fake check function, so no URL is requested over the network.
// offline: false exercises request scheduling; logged HTTP statuses and URLs come from these mocks.

async function fixture(run: (catalog: string, checkpoint: string, report: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "guidepost-links-"));
  const catalog = join(directory, "static/kdm/catalog/data.json");
  const reports = join(directory, "temp/kdm-catalog/reports");
  await mkdir(join(directory, "static/kdm/catalog"), { recursive: true });
  await mkdir(reports, { recursive: true });
  await writeFile(
    catalog,
    JSON.stringify({
      shopUpdated: "2025-01-01",
      content: Object.fromEntries(
        [
          ["a", "https://shop.kingdomdeath.com/products/a"],
          ["b", "https://example.com/a"],
          ["c", "https://example.com/b"],
          ["d", "https://shop.kingdomdeath.com/products/b"],
        ].map(([id, url]) => [id, { name: id, tags: [], url }]),
      ),
      "included-only": {},
      bundles: {},
      accessories: {},
      homebrew: {},
    }),
  );
  try {
    await run(catalog, join(reports, "shop-links-checkpoint.json"), join(reports, "shop-links.json"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

it("paces each host, keeps stock dates, and refreshes completed fetch runs", async () => {
  await fixture(async (catalog, checkpoint, report) => {
    let time = Date.parse("2026-01-01T00:00:00Z");
    const requests: { host: string; time: number }[] = [];
    const dependencies = {
      now: () => time,
      wait: async (delay: number) => {
        time += delay;
      },
      check: async (url: URL) => {
        requests.push({ host: url.hostname, time });
        return { status: 200, ok: true };
      },
    };
    await checkShopLinks(
      new AbortController().signal,
      { catalog, cache: join(dirname(catalog), "shop-cache"), offline: false },
      dependencies,
    );
    expect(requests.map(({ time: instant }) => instant - requests[0].time)).toEqual([0, 0, 1000, 35000]);
    expect(JSON.parse(await readFile(catalog, "utf8")).shopUpdated).toBe("2025-01-01");
    expect(JSON.parse(await readFile(checkpoint, "utf8")).complete).toBe(true);
    expect(JSON.parse(await readFile(report, "utf8")).listings.every((row: { checkedAt?: string }) => row.checkedAt)).toBe(true);
    await checkShopLinks(
      new AbortController().signal,
      { catalog },
      {
        check: async () => {
          throw new Error("network offline");
        },
      },
    );
    await checkShopLinks(
      new AbortController().signal,
      { catalog, cache: join(dirname(catalog), "shop-cache"), offline: false },
      dependencies,
    );
    expect(requests).toHaveLength(8);
  });
});

it("retains checkpoints on cancellation and resumes recent requests with shop pacing", async () => {
  await fixture(async (catalog, checkpoint) => {
    let time = Date.parse("2026-01-01T00:00:00Z");
    const controller = new AbortController();
    let calls = 0;
    const baseline = await readFile(catalog, "utf8");
    await expect(
      checkShopLinks(
        controller.signal,
        { catalog, cache: join(dirname(catalog), "shop-cache"), offline: false },
        {
          now: () => time,
          wait: async (delay) => {
            time += delay;
          },
          check: async () => {
            calls++;
            if (calls === 2) {
              controller.abort();
              throw new Error("interrupted");
            }
            return { status: 200, ok: true };
          },
        },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(2);
    expect(await readFile(catalog, "utf8")).toBe(baseline);
    const interrupted = JSON.parse(await readFile(checkpoint, "utf8"));
    expect(Object.keys(interrupted.results)).toHaveLength(1);
    expect(interrupted.starts).toEqual({ "example.com": time });
    const requests: number[] = [];
    await checkShopLinks(
      new AbortController().signal,
      { catalog, cache: join(dirname(catalog), "shop-cache"), offline: false },
      {
        now: () => time,
        wait: async (delay) => {
          time += delay;
        },
        check: async () => {
          requests.push(time);
          return { status: 200, ok: true };
        },
      },
    );
    expect(requests).toHaveLength(3);
    expect(requests[2] - Date.parse("2026-01-01T00:00:00Z")).toBe(35000);
  });
});

it("expires stale checkpoint rows and preserves checkpoints on publication conflicts", async () => {
  await fixture(async (catalog, checkpoint) => {
    const time = Date.parse("2026-01-02T00:00:00Z");
    await writeFile(
      checkpoint,
      JSON.stringify({
        complete: false,
        results: {
          "https://shop.kingdomdeath.com/products/a": { checkedAt: "2026-01-01T00:00:00Z", status: 200, ok: true },
        },
      }),
    );
    let calls = 0;
    await expect(
      checkShopLinks(
        new AbortController().signal,
        { catalog, cache: join(dirname(catalog), "shop-cache"), offline: false },
        {
          now: () => time,
          wait: async () => {},
          check: async () => {
            calls++;
            await writeFile(catalog, "{}");
            return { status: 404, ok: false };
          },
        },
      ),
    ).rejects.toThrow("Catalog changed during link checks");
    expect(calls).toBe(4);
    expect(await readFile(catalog, "utf8")).toBe("{}");
    const saved = JSON.parse(await readFile(checkpoint, "utf8"));
    expect(saved.complete).toBe(false);
    expect(Object.keys(saved.results)).toHaveLength(4);
  });
});

it("paces resumed requests after cancellation during an unfinished HEAD", async () => {
  await fixture(async (catalog, checkpoint) => {
    let time = Date.parse("2026-01-01T00:00:00Z");
    const start = time;
    const controller = new AbortController();
    await expect(
      checkShopLinks(
        controller.signal,
        { catalog, cache: join(dirname(catalog), "shop-cache"), offline: false },
        {
          now: () => time,
          check: async () => {
            controller.abort();
            throw new Error("interrupted");
          },
        },
      ),
    ).rejects.toThrow();
    const saved = JSON.parse(await readFile(checkpoint, "utf8"));
    expect(saved.results).toEqual({});
    expect(saved.starts["shop.kingdomdeath.com"]).toBeUndefined();
    expect(JSON.parse(await readFile(join(dirname(catalog), "shop-cache/last-request.json"), "utf8"))).toEqual({ startedAt: start });
    const requests: number[] = [];
    await checkShopLinks(
      new AbortController().signal,
      { catalog, cache: join(dirname(catalog), "shop-cache"), offline: false },
      {
        now: () => time,
        wait: async (delay) => {
          time += delay;
        },
        check: async () => {
          requests.push(time);
          return { status: 200, ok: true };
        },
      },
    );
    expect(requests[0] - start).toBe(35000);
  });
});

it("rejects a simultaneous checker before requests or checkpoint writes and releases its lock", async () => {
  await fixture(async (catalog, checkpoint) => {
    let entered!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const controller = new AbortController();
    const first = checkShopLinks(
      controller.signal,
      { catalog, cache: join(dirname(catalog), "shop-cache"), offline: false },
      {
        check: async () => {
          entered();
          await pending;
          controller.abort();
          throw new Error("interrupted");
        },
      },
    );
    await ready;
    const before = await readFile(checkpoint, "utf8");
    const lockPath = join(dirname(checkpoint), "shop-links.lock");
    const lockBefore = await readFile(lockPath, "utf8");
    const metadata = JSON.parse(lockBefore);
    expect(metadata.pid).toBe(process.pid);
    expect(Number.isFinite(Date.parse(metadata.acquiredAt))).toBe(true);
    let requests = 0;
    await expect(
      checkShopLinks(
        new AbortController().signal,
        { catalog, offline: false },
        {
          check: async () => {
            requests++;
            return { status: 200, ok: true };
          },
        },
      ),
    ).rejects.toThrow("Recorded PID: " + process.pid);
    expect(requests).toBe(0);
    expect(await readFile(lockPath, "utf8")).toBe(lockBefore);
    expect(await readFile(checkpoint, "utf8")).toBe(before);
    release();
    await expect(first).rejects.toThrow();
    await expect(readFile(join(dirname(checkpoint), "shop-links.lock"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

it("a product updater lock stops link checking without recording a missing listing", async () => {
  await fixture(async (catalog, checkpoint) => {
    const cache = join(dirname(catalog), "shop-cache");
    await mkdir(cache, { recursive: true });
    await writeFile(join(cache, "request.lock"), "another updater");
    const baseline = await readFile(catalog, "utf8");
    let requests = 0;
    await expect(
      checkShopLinks(
        new AbortController().signal,
        { catalog, cache, offline: false },
        {
          check: async () => {
            requests++;
            return { status: 200, ok: true };
          },
        },
      ),
    ).rejects.toThrow("Existing shop request lock");
    expect(requests).toBe(0);
    expect(await readFile(catalog, "utf8")).toBe(baseline);
    expect(JSON.parse(await readFile(checkpoint, "utf8")).results).toEqual({});
    await expect(readFile(join(dirname(checkpoint), "shop-links.lock"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

it.each(["legacy-start", "completion"])("shared request timing ignores %s checkpoint evidence", async (source) => {
  await fixture(async (catalog, checkpoint) => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    let time = start + 10_000;
    const cache = join(dirname(catalog), "shop-cache");
    await mkdir(cache, { recursive: true });
    await writeFile(join(cache, "last-request.json"), JSON.stringify({ startedAt: start }));
    await writeFile(
      checkpoint,
      JSON.stringify({
        complete: false,
        starts: { "shop.kingdomdeath.com": source === "legacy-start" ? start + 1_000_000 : start - 100_000 },
        results:
          source === "completion"
            ? {
                "https://shop.kingdomdeath.com/products/a": { checkedAt: new Date(time).toISOString(), status: 200, ok: true },
              }
            : {},
      }),
    );
    const shopRequests: number[] = [];
    await checkShopLinks(
      new AbortController().signal,
      { catalog, cache, offline: false },
      {
        now: () => time,
        wait: async (delay) => {
          time += delay;
        },
        check: async (url) => {
          if (url.hostname === "shop.kingdomdeath.com") shopRequests.push(time);
          return { status: 200, ok: true };
        },
      },
    );
    expect(shopRequests[0] - start).toBe(35_000);
    expect(JSON.parse(await readFile(checkpoint, "utf8")).starts).toEqual({
      "example.com": source === "completion" ? start + 11_000 : start + 36_000,
    });
  });
});
