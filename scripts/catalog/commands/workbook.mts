import { Command } from "effect/cli";
import { runCommand, workflow } from "../cli.mts";
import { writeWorkbookMap } from "../workbook.mts";

runCommand(
  Command.make("catalog:workbook", {}, () =>
    workflow(async (signal) => {
      const map = await writeWorkbookMap(process.cwd(), { signal });
      console.log(`Mapped ${map.rows.length} workbook rows to catalog edition IDs.`);
    }),
  ),
);
