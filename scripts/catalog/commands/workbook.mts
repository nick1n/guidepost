import { Command } from "effect/cli";
import { optionalString, runCommand, workflow } from "../cli.mts";
import { writeWorkbookMap } from "../workbook/map.mts";

runCommand(
  Command.make("catalog:workbook", { imports: optionalString("imports") }, ({ imports }) =>
    workflow(async (signal) => {
      const map = await writeWorkbookMap(process.cwd(), { signal, imports });
      console.log(`Mapped ${map.rows.length} workbook rows to catalog edition IDs.`);
    }),
  ),
);
