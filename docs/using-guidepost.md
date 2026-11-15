# Using Guidepost

### Collection

Open `/kdm/collection/` to search products, view editions, and track ownership and wishes. Entries save locally. Included rows show content coverage; product ownership is recorded separately. Stale tabs block editing and offer refresh. Offline use requires a cached catalog.

See the [collection architecture](kdm-architecture.md) for persistence and ownership rules, and the [proposed design](kdm-campaign-design.md) for future campaign and synchronization plans.

Collection links keep browsing state in the hash, for example `/kdm/collection/#/accessories?q=dice` or
`/kdm/collection/#/content?tag=monster&tag=pinup`. Categories are `content`, `accessories`, `bundles`, and `homebrew`;
`q` searches and repeated `tag` parameters require every selected tag. The default content view needs no hash.
Item links such as `/kdm/collection/#/content/woe-white-speaker` show one item, overriding search and tags.
Changing search, tags, category, or ownership filters returns to category browsing.
Controls replace the current history entry, and Back/Forward restores linked views.
Ownership and wishlist filters stay local and are not included in links.

The catalog loads in the browser and is reused on return visits within the app. Catalog and saved-collection failures have separate retry controls.

Choose **Totals currency** in Settings to convert the collection value into USD, EUR, GBP, CAD, AUD, or JPY. Individual products keep
their listed currency. Conversions use Frankfurter's ECB reference rates, cached on this device for 24 hours and refreshed when the
collection is opened or brought back into view. The rate date appears beneath the currency setting. Offline use keeps the last saved
rates; without saved rates, EUR/USD conversion uses the built-in estimate of EUR 1 = USD 1.13. Other currencies need a saved rate,
otherwise amounts stay in their original currencies. Converted totals are estimates and exclude exchange fees.

Use **Import workbook** or **Export workbook** in the collection menu to transfer KDM Collection Sheets or Guidepost exports.
Imports preview changes and ask you to resolve ambiguous editions. Original sheets merge checked products, wishes, and copy numbers;
blank and unchecked cells leave saved values unchanged. Exports preserve the original three-tab layout and retain collection data for reimport.
Files are processed in your browser without uploads.

### Hunt links

Share a hunt card using `/kdm/hunt/#/event/art/face`, for example `/kdm/hunt/#/1/fen/front`.

- Events: `0` through `99` (`0` is event 100).
- Artwork: `ccg`, `fen`, or `kekasi`.
- Face: `front`, `back`, or `reverse` for cards with a second side.

Links default to event 1, CCG artwork, and the back face, so `#/1` is enough. Opening a link leaves saved artwork preferences unchanged.
Card controls update the URL without adding browser history entries.
