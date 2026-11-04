import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const directory = new URL("./", import.meta.url);
const root = fileURLToPath(directory);
const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.mts"))
  .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"))
  .sort();
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
    const file = files.find((file) => resolve(root, file) === resolve(root, arg) || resolve(root, file) === resolve(arg));
    if (!file) throw new Error(`Unknown browser test: ${arg}. Use --list to see available files.`);
    if (!selected.includes(file)) selected.push(file);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const suite = selected.length ? selected : files;
const started = performance.now();
const elapsed = () => `${((performance.now() - started) / 1000).toFixed(1)}s`;
let passed = 0;

for (const file of suite) {
  console.log(`\nRunning ${file}`);
  const child = spawn(process.execPath, [fileURLToPath(new URL(file, directory))], {
    stdio: "inherit",
    env: { ...process.env, ...(url ? { BROWSER_TEST_URL: url } : {}) },
    windowsHide: true,
  });
  const code = await new Promise<number>((done) => {
    child.once("error", (error) => {
      console.error(error.message);
      done(1);
    });
    child.once("exit", (code) => done(code ?? 1));
  });
  if (code !== 0) {
    console.error(
      `\nBrowser tests failed: ${file} (exit ${code}). ${passed} passed, 1 failed, ${suite.length - passed - 1} not run (${elapsed()}).`,
    );
    process.exit(code);
  }
  passed++;
}

console.log(`\nBrowser tests passed: ${passed} file${passed === 1 ? "" : "s"} (${elapsed()}).`);
