import { catalogTemp } from "./paths.mts";
import { createHash } from "node:crypto";
import { access, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { Edition, Item, Mapping, Product } from "./types.mts";

export async function loadMappings(root: string, path?: string): Promise<Record<string, Mapping>> {
  const text = await readFile(path ?? join(catalogTemp(root), "shopify-products/kdm-shop-mappings.json"), "utf8").catch(
    (error: unknown) => {
      if (!path && error instanceof Error && "code" in error && error.code === "ENOENT") return "{}";
      throw error;
    },
  );
  return JSON.parse(text);
}

const queues = new Map<string, Promise<void>>();

export class ShopError extends Error {
  readonly status: number;
  readonly url: string;
  readonly cached: boolean;
  constructor(status: number, url: string, cached = false) {
    super(`Shop HTTP ${status}: ${url}.${cached ? " Cached response." : " No automatic retry was sent."}`);
    this.name = "ShopError";
    this.status = status;
    this.url = url;
    this.cached = cached;
  }
}

export function shopLinkUrl(value: string, base = "https://shop.kingdomdeath.com") {
  let url = new URL(value, base);
  if (url.hostname !== "shop.kingdomdeath.com" || !["https:", "http:"].includes(url.protocol))
    throw new Error("Expected a Kingdom Death shop URL");
  // A few newsletter hrefs concatenate two shop addresses or contain spaces
  // before the handle. Repair those path typos without following query URLs.
  if (url.pathname.startsWith("/products/")) {
    const embedded = url.pathname.match(/https?:\/\/shop\.kingdomdeath\.com\/products\/[^/]+$/i);
    if (embedded) {
      const repaired = new URL(embedded[0]);
      repaired.search = url.search;
      repaired.hash = url.hash;
      url = repaired;
    }
  }
  url.pathname = url.pathname.replace(/^(?:\/products\/+){2,}/i, "/products/").replace(/(\/products\/)(?:%20)+/i, "$1");
  url.protocol = "https:";
  return url;
}

// Shared handles apply to every edition; external links remain URLs.
export function catalogListing(item: Item, edition?: Edition) {
  const handle = item.handle ?? edition?.handle;
  return handle ? "https://shop.kingdomdeath.com/products/" + handle : (edition?.url ?? item.url);
}

export function productUrl(value: string) {
  const url = shopLinkUrl(value);
  const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:collections\/[^/]+\/)?products\/([^/]+)\/?$/i);
  if (!match) throw new Error("Expected a shop product listing");
  return "https://shop.kingdomdeath.com/products/" + match[1]!.replace(/\.(?:json|js)$/i, "");
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid shop product JSON");
  return value as Record<string, unknown>;
}

function amount(value: unknown, format: "json" | "ajax") {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+(?:\.\d{1,2})?$/.test(String(value)))
    throw new Error("Invalid shop price: " + String(value));
  const cents = format === "ajax" ? Number(value) : Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid shop price: " + String(value));
  return cents;
}

export function shopProduct(value: unknown, format: "json" | "ajax" = "json"): Product {
  const response = record(value);
  const product = record(response.product ?? response);
  if (
    typeof product.id !== "number" ||
    typeof product.title !== "string" ||
    typeof product.handle !== "string" ||
    !Array.isArray(product.variants)
  )
    throw new Error("Invalid shop product JSON");
  const description = product.body_html ?? product.description ?? "";
  if (typeof description !== "string") throw new Error("Invalid shop product description");
  const variants = product.variants.map((value) => {
    const variant = record(value);
    if (typeof variant.id !== "number" || typeof variant.title !== "string" || typeof variant.requires_shipping !== "boolean")
      throw new Error("Invalid shop product variant");
    return {
      ...variant,
      id: variant.id,
      title: variant.title,
      sku: typeof variant.sku === "string" ? variant.sku : "",
      requires_shipping: variant.requires_shipping,
      price: amount(variant.price, format),
      compare_at_price:
        variant.compare_at_price === null || variant.compare_at_price === undefined || variant.compare_at_price === ""
          ? null
          : amount(variant.compare_at_price, format),
    };
  });
  return { ...product, id: product.id, title: product.title, handle: product.handle, description, variants };
}

const cacheFile = (cache: string, url: string) => join(cache, createHash("sha256").update(url).digest("hex") + ".json");

export class ShopClient {
  private lastRequest = 0;
  readonly requests: { url: string; startedAt: string; status?: number }[] = [];
  private options: { cache?: string; delay?: number; refresh?: boolean; signal?: AbortSignal; offline?: boolean; maxAgeMs?: number };
  constructor(
    options: { cache?: string; delay?: number; refresh?: boolean; signal?: AbortSignal; offline?: boolean; maxAgeMs?: number } = {},
  ) {
    this.options = options;
    if (options.delay !== undefined && (!Number.isFinite(options.delay) || options.delay < 35))
      throw new Error("Shop requests require at least 35 seconds between starts");
  }

  async get(url: string): Promise<{ url: string; checkedAt: string; data: unknown }> {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "shop.kingdomdeath.com")
      throw new Error("ShopClient only reads the HTTPS Kingdom Death shop");
    const cache = resolve(this.options.cache ?? ".cache/kdm-shop");
    const path = cacheFile(cache, url);
    const cached = async () => {
      if (this.options.refresh) return;
      try {
        const result = JSON.parse(await readFile(path, "utf8"));
        if (this.options.offline || Date.now() - Date.parse(result.checkedAt) <= (this.options.maxAgeMs ?? 24 * 60 * 60 * 1_000)) {
          if (result.status && !Object.hasOwn(result, "data")) throw new ShopError(result.status, url, true);
          return result;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    };
    const existing = await cached();
    if (existing) return existing;
    if (this.options.offline) throw new Error("No cached shop response: " + url);
    const task = (queues.get(cache) ?? Promise.resolve()).then(async () => {
      const existing = await cached();
      if (existing) return existing;
      this.options.signal?.throwIfAborted();
      await mkdir(cache, { recursive: true });
      const lockPath = join(cache, "request.lock");
      const lock = await open(lockPath, "wx").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "EEXIST") throw new Error("Another shop updater holds " + lockPath + "; wait for it to finish before retrying.");
        throw error;
      });
      try {
        await lock.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }) + "\n");
        const statePath = join(cache, "last-request.json");
        try {
          const state = JSON.parse(await readFile(statePath, "utf8"));
          this.lastRequest = Math.max(this.lastRequest, Number(state.startedAt) || 0);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await sleep(Math.max(0, this.lastRequest + (this.options.delay ?? 35) * 1_000 - Date.now()), undefined, {
          signal: this.options.signal,
        });
        this.lastRequest = Date.now();
        await writeFile(statePath, JSON.stringify({ startedAt: this.lastRequest }) + "\n");
        const request: { url: string; startedAt: string; status?: number } = { url, startedAt: new Date(this.lastRequest).toISOString() };
        this.requests.push(request);
        const response = await fetch(url, {
          headers: { "User-Agent": "Guidepost-Catalog-Updater/1.0", Accept: "application/json" },
          redirect: "error",
          signal: AbortSignal.any([AbortSignal.timeout(40_000), ...(this.options.signal ? [this.options.signal] : [])]),
        });
        request.status = response.status;
        if (!response.ok) {
          await writeFile(path, JSON.stringify({ url, checkedAt: new Date().toISOString(), status: response.status }) + "\n");
          throw new ShopError(response.status, url);
        }
        const result = { url, checkedAt: new Date().toISOString(), data: await response.json() };
        await writeFile(path, JSON.stringify(result, null, 2) + "\n");
        return result;
      } finally {
        await lock.close();
        await unlink(lockPath);
      }
    });
    const pending = task.then(
      () => {},
      () => {},
    );
    queues.set(cache, pending);
    void pending.then(() => {
      if (queues.get(cache) === pending) queues.delete(cache);
    });
    return task;
  }

  async product(url: string) {
    const listing = productUrl(url);
    let format: "json" | "ajax" = "ajax";
    if (this.options.offline && !this.options.refresh) {
      try {
        await access(cacheFile(resolve(this.options.cache ?? ".cache/kdm-shop"), listing + ".js"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        format = "json";
      }
    }
    const response = await this.get(listing + (format === "json" ? ".json" : ".js"));
    return { ...response, data: shopProduct(response.data, format) };
  }
}
