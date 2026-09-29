import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Parser } from "htmlparser2";

const newsUrl = "https://kingdomdeath.com/news";
type Post = { date: string; title: string; postUrl: string };
type Entry = Post & { status: "read" | "unread"; linkCount?: number; error?: string };
type Link = Post & { itemName: string; shopUrl: string };
export type Report = {
  source: string;
  startedAt: string;
  finishedAt?: string;
  complete: boolean;
  discoveredPosts: number;
  discoveredPostUrls?: string[];
  posts: Entry[];
  links: Link[];
  errors: string[];
  requestsThisRun: number;
  skippedPostsThisRun: number;
  processedPostsThisRun: number;
  removedLinksThisRun: number;
};
type Anchor = { href: string; text: string[]; alt: string[]; line: (string | Anchor)[] };
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object in source data");
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected a string in source data");
  return value;
}

function post(value: unknown): Post {
  const data = record(value);
  const result = { date: string(data.date), title: string(data.title), postUrl: string(data.postUrl) };
  if (
    !result.title.trim() ||
    !Number.isFinite(Date.parse(result.date)) ||
    !/^https:\/\/kingdomdeath\.com\/news\/[\w-]+$/.test(result.postUrl)
  ) {
    throw new Error("Invalid post metadata");
  }
  return result;
}

export function pageData(html: string) {
  let active = false;
  let json = "";
  new Parser({
    onopentag(name, attrs) {
      if (name === "script" && attrs.id === "__NEXT_DATA__") active = true;
    },
    onclosetag(name) {
      if (name === "script") active = false;
    },
    ontext(text) {
      if (active) json += text;
    },
  }).end(html);
  if (!json) throw new Error("Missing __NEXT_DATA__; page may be blocked or site structure changed");
  return record(record(record(record(JSON.parse(json)).props).pageProps).data);
}

export function keepUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.hostname === "shop.kingdomdeath.com" &&
      /^\/products(?:\/|$)/.test(url.pathname) &&
      !/collections/i.test(value)
    );
  } catch {
    return false;
  }
}

function usefulLabel(text: string) {
  return (
    text.length > 0 &&
    text.length <= 180 &&
    !/^(?:read more|learn more|shop(?: now)?|buy(?: now)?|click here|here|keys|finally|made to order miniature|view(?: more)?|image|https?:\/\/\S+)[.!]?$/i.test(
      text,
    )
  );
}

function deriveName(anchor: Anchor, url: URL): [string, number] {
  const label = clean(anchor.text.join(""));
  if (usefulLabel(label)) return [label, 3];
  if (/^(?:read|learn) more[.!]?$/i.test(label) && anchor.line.filter((part) => typeof part !== "string").length === 1) {
    const context = clean(anchor.line.filter((part) => typeof part === "string").join("")).replace(
      /^[\s\-:|\u2013\u2014]+|[\s\-:|\u2013\u2014]+$/g,
      "",
    );
    if (usefulLabel(context) && context.split(" ").length <= 15 && !/[.!?](?:\s|$)/.test(context)) {
      return [context, 4];
    }
  }
  const alt = clean(anchor.alt.join(" "));
  if (usefulLabel(alt)) return [alt, 2];
  const slug = url.pathname.replace(/\/$/, "").split("/").at(-1) ?? "";
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Preserve malformed percent escapes from the source URL as readable text.
  }
  return [decoded.replaceAll("-", " ") || "Kingdom Death shop", 1];
}

export function extractLinks(body: string, metadata: Post): Link[] {
  const breaks = new Set(["br", "p", "div", "li", "td", "tr", "h1", "h2", "h3", "h4", "hr"]);
  const anchors: Anchor[] = [];
  let line: (string | Anchor)[] = [];
  let anchor: Anchor | undefined;
  let ignored = 0;
  new Parser({
    onopentag(tag, attrs) {
      if (["script", "style", "head"].includes(tag)) ignored++;
      if (ignored) return;
      if (breaks.has(tag) && line.length) line = [];
      if (tag === "a") {
        anchor = { href: attrs.href ?? "", text: [], alt: [], line };
        anchors.push(anchor);
        line.push(anchor);
      }
      if (tag === "img" && anchor && attrs.alt) anchor.alt.push(attrs.alt);
    },
    onclosetag(tag) {
      if (["script", "style", "head"].includes(tag)) ignored = Math.max(0, ignored - 1);
      if (ignored) return;
      if (tag === "a") anchor = undefined;
      if (breaks.has(tag) && line.length) line = [];
    },
    ontext(text) {
      if (!ignored) (anchor ? anchor.text : line).push(text);
    },
  }).end(body);
  const found = new Map<string, { row: Link; score: number }>();
  for (const anchor of anchors) {
    let url: URL;
    try {
      url = new URL(anchor.href.trim(), metadata.postUrl);
    } catch {
      continue;
    }
    if (!keepUrl(url.href)) continue;
    const [itemName, score] = deriveName(anchor, url);
    if (!found.has(url.href) || score > found.get(url.href)!.score) {
      found.set(url.href, { row: { ...metadata, itemName, shopUrl: url.href }, score });
    }
  }
  return [...found.values()].map(({ row }) => row);
}

export function newReport(): Report {
  return {
    source: newsUrl,
    startedAt: new Date().toISOString(),
    complete: false,
    discoveredPosts: 0,
    posts: [],
    links: [],
    errors: [],
    requestsThisRun: 0,
    skippedPostsThisRun: 0,
    processedPostsThisRun: 0,
    removedLinksThisRun: 0,
  };
}

export async function loadReport(output: string): Promise<Report> {
  let text: string;
  try {
    text = await readFile(join(output, "news-shop-links.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    // A CSV alone cannot identify successfully processed posts with zero links.
    try {
      await readFile(join(output, "news-shop-links.csv"));
    } catch (csvError) {
      if ((csvError as NodeJS.ErrnoException).code === "ENOENT") return newReport();
      throw csvError;
    }
    throw new Error("CSV exists without its JSON checkpoint. Restore the JSON or choose a new --output directory.");
  }
  const data = record(JSON.parse(text));
  if (data.source !== newsUrl || !Array.isArray(data.posts) || !Array.isArray(data.links)) throw new Error("Invalid existing export");
  const report = newReport();
  report.posts = data.posts.map((value) => {
    const entry = record(value);
    if (entry.status !== "read" && entry.status !== "unread") throw new Error("Invalid post status in export");
    return { ...post(entry), status: entry.status, ...(typeof entry.error === "string" ? { error: entry.error } : {}) };
  });
  if (new Set(report.posts.map((entry) => entry.postUrl)).size !== report.posts.length) throw new Error("Duplicate posts in export");
  report.links = data.links.map((value) => {
    const link = record(value);
    const metadata = post(link);
    if (!report.posts.some((entry) => entry.postUrl === metadata.postUrl && entry.status === "read")) {
      throw new Error("Export contains a link without a successfully processed post");
    }
    return { ...metadata, itemName: string(link.itemName), shopUrl: string(link.shopUrl) };
  });
  normalizeReport(report);
  return report;
}

export function normalizeReport(report: Report, publicationDates = new Map<string, string>()) {
  const previousCount = report.links.length;
  const seen = new Set<string>();
  // Compare source timestamps before shortening dates, regardless of discovery order.
  const timestamp = (link: Link) => Date.parse(publicationDates.get(link.postUrl) ?? link.date);
  report.links = report.links
    .filter((link) => keepUrl(link.shopUrl))
    .sort((a, b) => timestamp(a) - timestamp(b) || a.postUrl.localeCompare(b.postUrl))
    .filter((link) => {
      const key = JSON.stringify([link.shopUrl, link.itemName]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ date, title, postUrl, itemName, shopUrl }) => ({ date: date.slice(0, 10), title, postUrl, itemName, shopUrl }));
  report.removedLinksThisRun += previousCount - report.links.length;
  for (const entry of report.posts) {
    entry.date = entry.date.slice(0, 10);
    if (entry.status === "read") entry.linkCount = report.links.filter((link) => link.postUrl === entry.postUrl).length;
  }
}

export function csv(report: Report) {
  const quote = (text: string) => `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  const rows = [
    ["Post date", "Post title", "Post URL", "Item name", "Shop URL"],
    ...report.links.map((link) => [link.date, link.title, link.postUrl, link.itemName, link.shopUrl]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n") + "\r\n";
}

export async function saveReport(report: Report, output: string) {
  await mkdir(output, { recursive: true });
  for (const [name, text] of [
    ["news-shop-links.json", JSON.stringify(report, null, 2) + "\n"],
    ["news-shop-links.csv", csv(report)],
  ] as const) {
    const target = join(output, name);
    await writeFile(target + ".tmp", text, "utf8");
    await rename(target + ".tmp", target);
  }
}

class HttpError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status}: ${url}`);
    this.status = status;
  }
}

export class Downloader {
  requests = 0;
  private finished = 0;
  constructor(options: { cache: string; delay: number; signal?: AbortSignal }) {
    this.options = options;
  }
  private options: { cache: string; delay: number; signal?: AbortSignal };

  async get(url: string, cached = true) {
    const path = join(this.options.cache, createHash("sha256").update(url).digest("hex") + ".html");
    if (cached) {
      try {
        return await readFile(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await sleep(Math.max(0, this.options.delay * 1_000 - (performance.now() - this.finished)), undefined, { signal: this.options.signal });
    this.requests++;
    try {
      const signals = [AbortSignal.timeout(40_000), ...(this.options.signal ? [this.options.signal] : [])];
      const response = await fetch(url, {
        headers: { "User-Agent": "Guidepost-News-Link-Exporter/2.0", Accept: "text/html" },
        signal: AbortSignal.any(signals),
        redirect: "error",
      });
      if (!response.ok) throw new HttpError(response.status, url);
      const html = await response.text();
      pageData(html);
      await mkdir(this.options.cache, { recursive: true });
      await writeFile(path, html, "utf8");
      return html;
    } finally {
      this.finished = performance.now();
    }
  }
}

export async function updateReport(
  report: Report,
  index: Record<string, unknown>,
  getArticle: (url: string, cached: boolean) => Promise<string>,
  checkpoint: () => Promise<void>,
) {
  if (!Array.isArray(index.stories) || !index.stories.length) throw new Error("News index has no stories");
  const posts = index.stories.map((value) => {
    const story = record(value);
    return post({ date: story.date, title: clean(string(story.title)), postUrl: `${newsUrl}/${string(story.slug)}` });
  });
  if (new Set(posts.map((entry) => entry.postUrl)).size !== posts.length) throw new Error("News index has duplicate slugs");
  report.discoveredPosts = posts.length;
  report.discoveredPostUrls = posts.map((entry) => entry.postUrl);
  const publicationDates = new Map(posts.map((entry) => [entry.postUrl, entry.date]));
  const persist = async () => {
    normalizeReport(report, publicationDates);
    await checkpoint();
  };
  normalizeReport(report, publicationDates);
  for (const metadata of posts) {
    const position = report.posts.findIndex((entry) => entry.postUrl === metadata.postUrl);
    if (position !== -1 && report.posts[position]!.status === "read") {
      report.skippedPostsThisRun++;
      continue;
    }
    report.processedPostsThisRun++;
    let entry: Entry;
    try {
      const article = record(pageData(await getArticle(metadata.postUrl, position === -1)).article);
      const body = string(article.body);
      if (!body.trim() || article.bottomLink) throw new Error("Missing article body or unsupported bottomLink");
      const links = extractLinks(body, metadata);
      report.links.push(...links);
      entry = { ...metadata, status: "read", linkCount: links.length };
    } catch (error) {
      entry = { ...metadata, status: "unread", error: message(error) };
      if (position === -1) report.posts.push(entry);
      else report.posts[position] = entry;
      await persist();
      if (
        (error instanceof HttpError && [401, 403, 429].includes(error.status)) ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error;
      }
      continue;
    }
    if (position === -1) report.posts.push(entry);
    else report.posts[position] = entry;
    await persist();
  }
  report.complete = posts.every((metadata) => report.posts.some((entry) => entry.postUrl === metadata.postUrl && entry.status === "read"));
}

async function main() {
  const { values } = parseArgs({
    options: {
      output: { type: "string", default: "exports/kingdom-death-news" },
      cache: { type: "string", default: ".cache/kingdom-death-news" },
      delay: { type: "string", default: "2" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log("node scripts/scrape-news-shop-links.mts [--delay 2] [--output directory] [--cache directory]");
    return;
  }
  const delay = Number(values.delay);
  if (!Number.isFinite(delay) || delay < 2) throw new Error("--delay must be a finite number of at least 2 seconds");
  // Validate before writing anything, so a damaged checkpoint cannot erase earlier results.
  const report = await loadReport(values.output);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  const downloader = new Downloader({ cache: values.cache, delay, signal: controller.signal });
  const checkpoint = async () => {
    report.requestsThisRun = downloader.requests;
    await saveReport(report, values.output);
  };
  try {
    await checkpoint();
    const index = pageData(await downloader.get(newsUrl, false));
    await updateReport(
      report,
      index,
      (url, cached) => {
        console.log(`Reading ${url}`);
        return downloader.get(url, cached);
      },
      checkpoint,
    );
  } catch (error) {
    report.complete = false;
    report.errors.push(message(error));
    console.error(message(error));
  } finally {
    process.removeListener("SIGINT", stop);
    report.finishedAt = new Date().toISOString();
    await checkpoint();
  }
  console.log(
    `${report.complete ? "Complete" : "PARTIAL"}: ${report.links.length} links, ${report.skippedPostsThisRun} posts skipped, ${report.processedPostsThisRun} processed, ${report.removedLinksThisRun} links removed, ${report.requestsThisRun} requests.`,
  );
  if (!report.complete) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => {
    console.error(message(error));
    process.exitCode = 1;
  });
}
