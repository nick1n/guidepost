import { errorMessage } from "#lib/helpers.ts";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { catalogPath, gameplaySchemaPath, generateCoreEditions, generateTypes, schemaPath } from "./generate-types.mts";

export function schemaTypes(): Plugin {
  let cleanup = () => {};

  return {
    name: "schema-types",
    apply: "serve",
    configureServer(server) {
      let pending = Promise.resolve();
      let timer: ReturnType<typeof setTimeout>;
      let schemaChanged = false;

      function onSchemaChange(file: string) {
        const path = resolve(file);
        if (path !== schemaPath && path !== gameplaySchemaPath && path !== catalogPath) return;
        schemaChanged ||= path !== catalogPath;
        clearTimeout(timer);
        timer = setTimeout(() => {
          const regenerateTypes = schemaChanged;
          schemaChanged = false;
          pending = pending
            .then(async () => {
              if (regenerateTypes) {
                if (await generateTypes()) server.config.logger.info("[schema-types] Regenerated schema outputs");
              } else if (await generateCoreEditions()) server.config.logger.info("[schema-types] Regenerated core editions");
            })
            .catch((error) => {
              server.config.logger.error(`[schema-types] Generation failed: ${errorMessage(error)}`);
            });
        }, 75);
      }

      server.watcher.add([schemaPath, gameplaySchemaPath, catalogPath]);
      server.watcher.on("change", onSchemaChange);
      server.watcher.on("add", onSchemaChange);
      cleanup = () => {
        clearTimeout(timer);
        server.watcher.off("change", onSchemaChange);
        server.watcher.off("add", onSchemaChange);
      };
    },
    closeBundle() {
      cleanup();
    },
  };
}
