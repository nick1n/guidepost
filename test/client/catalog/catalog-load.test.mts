import { expect, it, vi } from "vitest";
import { load } from "../../../src/routes/kdm/collection/+page.ts";
import catalogJson from "#catalog/data.json";

vi.mock("$app/paths", () => ({ asset: (path: string) => `/test-base/${path}` }));

function event(fetch: typeof globalThis.fetch) {
  return { fetch, url: new URL("https://guidepost.test/test-base/kdm/collection/") } as Parameters<typeof load>[0];
}

it("loads the catalog through the deployment's asset path", async () => {
  const catalog = catalogJson;
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(catalog));
  expect(await load(event(fetch))).toEqual({ catalog });
  expect(fetch).toHaveBeenCalledOnce();
  const [url, options] = fetch.mock.calls[0];
  expect(String(url)).toBe("https://guidepost.test/test-base/kdm/catalog/data.json");
  expect(options).toMatchObject({ method: "GET", signal: expect.any(AbortSignal) });
});

it.each([
  ["HTTP failure", () => Promise.resolve(new Response("Missing", { status: 404 }))],
  ["network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
  ["invalid JSON", () => Promise.resolve(new Response("not JSON"))],
  ["missing categories", () => Promise.resolve(Response.json({ content: {} }))],
  ["invalid item", () => Promise.resolve(Response.json({ ...catalogJson, content: { model: { name: 123, tags: [] } } }))],
  [
    "invalid edition",
    () =>
      Promise.resolve(
        Response.json({
          ...catalogJson,
          content: {
            model: {
              name: "Model",
              tags: [],
              editions: [{ id: "resin", label: "Resin", format: "physical", prices: ["100"] }],
            },
          },
        }),
      ),
  ],
] as const)("reports a reloadable catalog error after %s", async (_, response) => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(response);
  await expect(load(event(fetch))).rejects.toMatchObject({
    status: 503,
    body: { message: "The catalog could not be loaded. Please try again." },
  });
});
