import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import UnoCSS from "@unocss/svelte-scoped/vite";
import { createLogger, createServer } from "vite";
import { expect, it, vi } from "vitest";

it("checks the complete HTML head across writes and end, while ignoring error and non-HTML responses", async () => {
  const directory = await mkdtemp(join(tmpdir(), "guidepost-unocss-stream-"));
  const config = join(directory, "uno.config.mjs");
  await writeFile(config, "export default { presets: [] };\n");
  const logger = createLogger("silent");
  logger.error = vi.fn();
  const link = '<link rel="stylesheet" data-title="unocss-svelte-scoped global styles" />';
  function respond(req: IncomingMessage, res: ServerResponse) {
    res.setHeader("Content-Type", req.url === "/text" ? "text/plain" : "text/html; charset=utf-8");
    if (req.url === "/error") res.statusCode = 500;
    if (req.url === "/end" || req.url === "/end-missing") {
      res.end(`<html><head>${req.url === "/end" ? link : ""}</head><body></body></html>`);
      return;
    }
    if (req.url !== "/missing") {
      res.write("<html><head>");
    } else {
      res.write("<html><he");
      res.write(Buffer.from("ad>"));
    }
    if (req.url === "/split") {
      res.write(Buffer.from(link.slice(0, 40)));
      res.end(`${link.slice(40)}</head><body></body></html>`);
    } else {
      // A marker in the body must not mask a missing stylesheet in the head.
      res.end(`</head><body>${link}</body></html>`);
    }
  }
  const server = await createServer({
    root: directory,
    configFile: false,
    customLogger: logger,
    server: { middlewareMode: true, ws: false },
    plugins: [
      UnoCSS({ configOrPath: config, onlyGlobal: true }),
      {
        name: "sveltekit:stream-fixture",
        configureServer(server) {
          server.middlewares.use(respond);
        },
      },
    ],
  });
  const http = createHttpServer(server.middlewares);
  try {
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    if (!address || typeof address === "string") throw new Error("Expected a listening port");
    let warnings = 0;
    for (const path of ["/split", "/end", "/error", "/text", "/missing", "/end-missing"]) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
      const html = await response.text();
      expect(html).toContain("</html>");
      if (path === "/missing" || path === "/end-missing") warnings++;
      expect(logger.error, path).toHaveBeenCalledTimes(warnings);
    }
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("You must place"), { timestamp: true });
  } finally {
    await new Promise<void>((resolve, reject) => http.close((error) => (error ? reject(error) : resolve())));
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});
