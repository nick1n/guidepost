import { resolve } from "node:path";
import type { Plugin } from "vite";
import { generateTypes, schemaPath } from "./generate-types.mjs";

export function schemaTypes(): Plugin {
  let cleanup = () => {};

  return {
    name: "schema-types",
    apply: "serve",
    configureServer(server) {
      let pending = Promise.resolve();
      let timer: ReturnType<typeof setTimeout>;

      function onSchemaChange(file: string) {
        if (resolve(file) !== schemaPath) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          pending = pending
            .then(async () => {
              if (await generateTypes()) server.config.logger.info("[schema-types] Regenerated catalog types");
            })
            .catch((error) => {
              server.config.logger.error(`[schema-types] Generation failed: ${error instanceof Error ? error.message : String(error)}`);
            });
        }, 75);
      }

      server.watcher.add(schemaPath);
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
