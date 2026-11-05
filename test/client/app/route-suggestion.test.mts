import { beforeEach, describe, expect, it, vi } from "vitest";
import { suggestPage } from "#lib/app/navigation/route-suggestion.ts";

const { root } = vi.hoisted(() => ({ root: vi.fn(() => "/") }));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => (path === "/" ? root() : `${root().replace(/\/$/, "")}${path.replace(/\/\([^/]+\)/g, "")}`),
}));
beforeEach(() => root.mockReturnValue("/"));

function url(path: string) {
  return new URL(path, "https://guidepost.test");
}

vi.mock("$app/manifest", () => ({
  routes: [
    { id: "/kdm/collection", page: true },
    { id: "/kdm/showdown1", page: true },
    { id: "/kdm/showdown2", page: true },
    { id: "/test/palette", page: true },
    { id: "/kdm/campaign", page: true },
    { id: "/kdm/report", page: false },
    { id: "/kdm/[item]", page: true },
    { id: "/(tools)/kdm/hunt", page: true },
    { id: "/(internal)/test/gesture", page: true },
  ],
}));

describe("page suggestions", () => {
  it.each([
    ["/kdm/collections/#/content?q=dragon", "/kdm/collection#/content?q=dragon"],
    ["/kdm/hunts/#/1/fen/front", "/kdm/hunt#/1/fen/front"],
    ["/kdm/hunts/?mode=cards#/99/kekasi/reverse", "/kdm/hunt?mode=cards#/99/kekasi/reverse"],
    ["/kdm/campaigns/?tag=a&tag=b&q=a%20b#future%2Fstate", "/kdm/campaign?tag=a&tag=b&q=a%20b#future%2Fstate"],
  ])("preserves query strings and hashes for %s", (path, href) => {
    expect(suggestPage(url(path))?.href).toBe(href);
  });

  it("uses the first matching route in manifest order", () => {
    expect(suggestPage(url("/kdm/SHOWDOWN1"))?.path).toBe("/kdm/showdown1");
    expect(suggestPage(url("/kdm/SHOWDOWN4"))?.path).toBe("/kdm/showdown1");
    expect(suggestPage(url("/kdm/showdown4"))?.path).toBe("/kdm/showdown1");
  });

  it.each(["/kdm/Collection", "/KDM/collection", "/KDM/COLLECTION"])("suggests the canonical path for case-only typos: %s", (path) => {
    expect(suggestPage(url(path))?.path).toBe("/kdm/collection");
  });

  it.each(["collections", "collecion", "collecton", "collectiom", "collectoin"])("recognizes a single typo: %s", (name) => {
    expect(suggestPage(url(`/kdm/${name}`))?.path).toBe("/kdm/collection");
  });

  it("handles a deployed base and trailing slash", () => {
    root.mockReturnValue("/guidepost/");
    expect(suggestPage(url("/guidepost/kdm/collections/"))?.path).toBe("/kdm/collection");
    expect(suggestPage(url("/guidepost/kdm/Collection/"))?.path).toBe("/kdm/collection");
    expect(suggestPage(url("/other/kdm/collections/"))).toBeUndefined();
    expect(suggestPage(url("/guidepost/kdm/hunts/?q=one#/1/fen/front"))?.href).toBe("/guidepost/kdm/hunt?q=one#/1/fen/front");
  });

  it("resolves a relative app root during server rendering", () => {
    root.mockReturnValue("../..");
    expect(suggestPage(url("/guidepost/kdm/collections/"))?.path).toBe("/kdm/collection");
    const input = url("/guidepost/kdm/hunts/?q=one#/1/fen/front");
    expect(new URL(suggestPage(input)!.href, input).href).toBe("https://guidepost.test/guidepost/kdm/hunt?q=one#/1/fen/front");
  });

  it.each(["/kdm/collection", "/unknown", "/other/collection", "/kdm/collect", "/test/palett"])(
    "does not suggest for existing, unrelated, or internal paths: %s",
    (path) => expect(suggestPage(url(path))).toBeUndefined(),
  );

  it("uses newly supplied static pages without a separate registry", () => {
    expect(suggestPage(url("/kdm/campaigns"))?.path).toBe("/kdm/campaign");
  });

  it("excludes endpoints and dynamic pages", () => {
    expect(suggestPage(url("/kdm/reports"))).toBeUndefined();
    expect(suggestPage(url("/kdm/items"))).toBeUndefined();
  });

  it("removes route groups from display paths while retaining the resolvable ID", () => {
    expect(suggestPage(url("/kdm/hunts"))).toEqual({
      id: "/(tools)/kdm/hunt",
      path: "/kdm/hunt",
      href: "/kdm/hunt",
    });
    expect(suggestPage(url("/test/gestur"))).toBeUndefined();
  });
});
