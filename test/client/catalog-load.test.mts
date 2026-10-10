import { expect, it, vi } from "vitest";
import { load } from "../../src/routes/kdm/collection/+page.ts";

vi.mock("$app/paths", () => ({ asset: (path: string) => `/test-base/${path}` }));

function event(fetch: typeof globalThis.fetch) {
  return { fetch } as Parameters<typeof load>[0];
}

it("loads the catalog through the deployment's asset path", async () => {
  const catalog = { content: {}, "included-only": {}, accessories: {}, bundles: {}, homebrew: {} };
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(catalog));
  expect(await load(event(fetch))).toEqual({ catalog });
  expect(fetch).toHaveBeenCalledWith("/test-base/kdm-catalog/data.json");
});

it.each([
  ["HTTP failure", () => Promise.resolve(new Response("Missing", { status: 404 }))],
  ["network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
  ["invalid JSON", () => Promise.resolve(new Response("not JSON"))],
] as const)("reports a reloadable catalog error after %s", async (_, response) => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(response);
  await expect(load(event(fetch))).rejects.toMatchObject({
    status: 503,
    body: { message: "The catalog could not be loaded. Please try again." },
  });
});
