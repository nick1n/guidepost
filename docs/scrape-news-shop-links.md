# Kingdom Death news shop links

Run from the project root with Node.js 22.18 or newer, after installing the project's dependencies with `pnpm install`. No browser login is needed:

```powershell
pnpm scrape:news
```

The Node TypeScript entry point is `scripts/scrape-news-shop-links.mts`. You can also run it directly with `node scripts/scrape-news-shop-links.mts`.

Every run fetches a fresh index from <https://kingdomdeath.com/news> and compares post URLs with `news-shop-links.json` in the output directory. Successfully exported articles are skipped, including articles with zero retained links. Only new articles and previously failed articles are processed. Existing rows are preserved, except for the URL filtering described below. Changes to previously exported articles are not re-scraped.

It extracts links from article bodies, including newsletters and the Kickstarter content hosted on the news site. Website navigation is excluded. It never requests Kickstarter, product pages, images, or tracking redirects.

Requests run one at a time, with a two-second sleep between responses and subsequent requests. To slow it further:

```powershell
pnpm scrape:news --delay 5
```

Results are saved after each post:

- `exports/kingdom-death-news/news-shop-links.csv`: Post date, Post title, Post URL, Item name, Shop URL.
- `exports/kingdom-death-news/news-shop-links.json`: the same rows and a coverage report including posts with no retained shop links or failed requests.

Only direct `shop.kingdomdeath.com/products` URLs are retained. Shop-home, page, blog, and other non-product URLs are skipped. URLs containing `collections` anywhere, regardless of case, are also skipped, including product URLs nested under `/collections/.../products/...`. Each run applies these filters to the existing JSON and CSV exports and updates per-post link counts.

Each exact shop URL and item-name pair appears only once across the export, under its earliest post. Different names for the same URL remain separate. Query strings, fragments, and name capitalization are preserved when comparing pairs. Rows are ordered oldest first. An older article discovered on a later run can replace the retained occurrence. Per-post link counts reflect retained rows, and posts reduced to zero rows remain recorded as processed.

Item names come from release-list text, link labels, or image descriptions. When those are unavailable, the script derives a readable name from the URL. These fallback names are not verified product titles. No `nameSource` field is exported. Post dates use `YYYY-MM-DD`, preserving the source's calendar date without converting to UTC. Source timestamps from the index determine which post is earlier, including posts published on the same day.

The JSON export is the checkpoint, so keep it alongside the CSV. Existing Python-generated exports are supported automatically. If the JSON is damaged or only the CSV remains, the script stops without replacing the export.

Article pages are cached in `.cache/kingdom-death-news` to recover interrupted work. The index always bypasses that cache, and failed articles are fetched again. A run with no new or failed articles makes only one request, for the index. `--output` and `--cache` accept alternate directories. To rebuild from scratch, choose a new output directory. There is no `--refresh` flag. Do not run two copies against the same output directory.

A successful run exits with code 0 and sets `complete` to `true`. That means every post in the fetched index was read, not that the site contains every historical Kingdom Death announcement. Failures are recorded, and partial runs exit with code 1. HTTP 401, 403, and 429 responses stop the run without automatic retries.

Run the offline parser, export, cache, and request-delay checks with:

```powershell
node --test test/scrape-news-checks.mts
```

This replaces the Python scraper and the earlier Kickstarter browser-console scraper.
