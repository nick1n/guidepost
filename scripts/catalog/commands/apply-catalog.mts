import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Flag } from "effect/cli";
import { optionalString, runCommand, workflow } from "../cli.mts";
import { applyReview, reviewPath } from "../review/apply.mts";
import { parseReview } from "../review/schema.mts";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(
    Command.make(
      "catalog:apply",
      {
        catalog: Flag.String("catalog").pipe(Flag.withDefault("static/kdm/catalog")),
        news: Flag.String("news").pipe(Flag.withDefault("scripts/news")),
        review: optionalString("review"),
      },
      (values) =>
        workflow(async (signal) => {
          const path = values.review ?? reviewPath(values.catalog);
          const review = parseReview(await readFile(path, "utf8"));
          const result = await applyReview(review, values.catalog, join(values.news, "shop-links.json"), { signal });
          console.log(`Applied review: ${result.items} items, ${result.editions} editions validated.`);
        }),
    ).pipe(Command.withDescription("Apply the prepared catalog review using captured evidence. Makes no network requests.")),
  );
}
