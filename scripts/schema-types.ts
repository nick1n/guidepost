import { resolve } from "node:path";
import type { Plugin } from "vite";
import { catalogPath, generateCoreEditions, generateTypes, schemaPath } from "./generate-types.mts";

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
        if (path !== schemaPath && path !== catalogPath) return;
        schemaChanged ||= path === schemaPath;
        clearTimeout(timer);
        timer = setTimeout(() => {
          const regenerateTypes = schemaChanged;
          schemaChanged = false;
          pending = pending
            .then(async () => {
              if (regenerateTypes) {
                if (await generateTypes()) server.config.logger.info("[schema-types] Regenerated catalog types and core editions");
              } else if (await generateCoreEditions()) server.config.logger.info("[schema-types] Regenerated core editions");
            })
            .catch((error) => {
              server.config.logger.error(`[schema-types] Generation failed: ${error instanceof Error ? error.message : String(error)}`);
            });
        }, 75);
      }

      server.watcher.add([schemaPath, catalogPath]);
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
