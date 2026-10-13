# Kingdom Death news shop links

Run from the project root with Node.js 22.18 or newer and installed dependencies:

```powershell
pnpm scrape:news          # Use cached pages
pnpm scrape:news --fetch  # Refresh the index and all articles
```

The entry point is `scripts/news/scrape-shop-links.mts`. Default runs make no requests; missing cached pages report how to rerun with
`--fetch`. `--offline` explicitly selects this default and cannot accompany `--fetch`.
Successfully exported articles, including those with no retained links, are skipped unless `--refresh-posts` reprocesses saved pages.

The scraper reads article bodies, including newsletters and Kickstarter content hosted on the news site. It excludes navigation and
never requests Kickstarter, product pages, images, or tracking redirects. Fetch requests run sequentially, at least two seconds apart;
use `pnpm scrape:news --fetch --delay 5` to slow them further.

Results checkpoint after each post:

- `scripts/news/shop-links.csv`: post date, title, URL, item name, and shop URL.
- `scripts/news/shop-links.json`: the same rows plus coverage, including empty and failed posts.

Only direct `shop.kingdomdeath.com/products` URLs remain. Non-product URLs and any URL containing `collections` (case-insensitive) are
excluded, including `/collections/.../products/...`. Each run also filters existing exports and updates retained link counts.

Each exact shop-URL/item-name pair appears once, under its earliest post. Comparisons preserve query strings, fragments, and name case.
Different names for one URL remain separate. Rows sort oldest first; newly discovered older posts can replace retained occurrences.
Posts reduced to zero rows remain processed.

Names come from release text, link labels, or image descriptions, falling back to unverified names derived from URLs.
No `nameSource` field is exported. Dates use `YYYY-MM-DD` without UTC conversion; source timestamps break same-day ties.

Keep the JSON checkpoint with the CSV. Legacy Python exports are supported; damaged JSON or a lone CSV stops the script without replacement.
Pages cache in `.cache/kingdom-death-news`; `--fetch` bypasses saved pages. `--output` and `--cache` select other directories.
Use a new output directory to rebuild. Do not run concurrent copies against one output directory.

Exit code 0 and `complete: true` mean every indexed post was read, not that the index includes every historical announcement.
Partial runs exit 1 and record failures. HTTP 401, 403, and 429 stop fetching without automatic retries.

Run offline parser, export, cache, and pacing checks:

```powershell
node --test test/scripts/scrape-news-checks.mts
```
