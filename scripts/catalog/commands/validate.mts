import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Argument, Command } from "effect/cli";
import { runCommand, workflow } from "../cli.mts";
import { validateCatalog } from "../validate.mts";
import { loadTags, checkTags } from "../tags.mts";
import { loadMappings } from "../shop.mts";

runCommand(
  Command.make(
    "catalog:validate",
    { path: Argument.String("path").pipe(Argument.withDefault("static/kdm/catalog/data.json")) },
    ({ path }) =>
      workflow(async () => {
        const catalog = JSON.parse(await readFile(path, "utf8"));
        const master = await loadTags(dirname(path));
        const mappings = await loadMappings(dirname(path));
        checkTags(catalog, master.tags, mappings);
        console.log(JSON.stringify(await validateCatalog(catalog, join(dirname(path), "data.schema.json")), null, 2));
      }),
  ),
);
