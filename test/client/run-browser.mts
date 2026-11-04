import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = new URL("./", import.meta.url);
const files = (await readdir(directory)).filter((file) => file.endsWith("-browser.mts") && file !== "run-browser.mts").sort();
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const selected: string[] = [];
let url: string | undefined;

try {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "--list") {
      console.log("Usage: pnpm test:browser [file ...] [--url http://localhost:5173]\n\nAvailable files:\n" + files.join("\n"));
      process.exit(0);
    }
    if (arg === "--url") {
      url = args[++index];
      if (!url) throw new Error("--url requires a local server URL.");
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
        throw new Error("--url requires a local HTTP server URL.");
      }
      continue;
    }
    const file = files.find((file) => resolve("test/client", file) === resolve(arg) || file === arg);
    if (!file) throw new Error(`Unknown browser test: ${arg}. Use --list to see available files.`);
    if (!selected.includes(file)) selected.push(file);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

for (const file of selected.length ? selected : files) {
  console.log(`\nRunning ${file}`);
  const child = spawn(process.execPath, [fileURLToPath(new URL(file, directory)), ...(url ? [url] : [])], {
    stdio: "inherit",
    windowsHide: true,
  });
  const code = await new Promise<number>((done) => {
    child.once("error", (error) => {
      console.error(error.message);
      done(1);
    });
    child.once("exit", (code) => done(code ?? 1));
  });
  if (code !== 0) process.exit(code);
}
