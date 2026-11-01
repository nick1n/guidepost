import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Flag } from "effect/cli";
import { optionalString, runCommand, workflow } from "../cli.mts";
import { catalogData } from "../paths.mts";
import { applyReview, reviewPath } from "../review/apply.mts";
import type { Review } from "../review/schema.mts";
import { captureInputs, digest } from "../inputs.mts";
import { tagSchema } from "../tags.mts";
import { planUpdate } from "../update.mts";
import { validateCatalog } from "../validate.mts";
import { publishFiles } from "../publication.mts";
import { itemDifferences } from "../review/details.mts";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(
    Command.make(
      "catalog:tags",
      {
        catalog: Flag.String("catalog").pipe(Flag.withDefault("static/kdm/catalog")),
        review: optionalString("review"),
        apply: Flag.Boolean("apply").pipe(Flag.withDefault(false)),
        schema: Flag.Boolean("schema").pipe(Flag.withDefault(false)),
      },
      (values) =>
        workflow(async (signal) => {
          const root = values.catalog;
          if (values.schema) {
            const path = join(catalogData(root), "tags.schema.json");
            const text = await readFile(path, "utf8");
            const existing = JSON.parse(text);
            const schema = tagSchema(existing.$defs.tag.enum);
            schema.$defs = { ...schema.$defs, ...existing.$defs };
            await publishFiles([{ path, json: schema }], {
              signal,
              baselines: [{ path, text, message: "Tag schema changed; rerun catalog:tags-schema." }],
            });
            console.log("Refreshed tag vocabulary schema.");
            return;
          }
          const { catalog: capturedCatalog, mappings, master, sources, baselines } = await captureInputs(root);
          const plan = planUpdate(capturedCatalog, [], mappings, [], master.tags);
          const { catalog, excluded, releaseGaps: _, sources: _sources, changes, ...summary } = plan;
          const validation = await validateCatalog(catalog, sources.schema.path);
          const review = {
            preparedAt: new Date().toISOString(),
            date: "tags-only" as const,
            baselineHash: sources.catalog.hash,
            schemaHash: sources.schema.hash,
            tagsHash: digest(master.text),
            tagSchemaHash: digest(master.schemaText),
            mappingsHash: sources.mappings.hash,
            ...summary,
            changes: changes.map(({ category, itemId, before, after }) => ({
              category,
              itemId,
              differences: itemDifferences(before, after),
              after,
            })),
            excluded: excluded.length,
            validation,
          } satisfies Review;
          const path = values.review ?? reviewPath(root);
          await publishFiles([{ path, json: review }], { signal, baselines });
          console.log(`${plan.changes.length} tag changes, 0 shop requests. Review: ${path}`);
          if (values.apply) console.log(await applyReview(review, root, "", { signal }));
        }),
    ).pipe(Command.withDescription("Prepare reviewed tag changes without news or shop requests.")),
  );
}
