import { readFile } from "node:fs/promises";

export async function readOptional(path: string) {
  return readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
}
