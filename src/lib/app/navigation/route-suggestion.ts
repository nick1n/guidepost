import { routes } from "$app/manifest";
import { resolve } from "$app/paths";

function isSingleTypo(input: string, target: string) {
  if (Math.abs(input.length - target.length) > 1) return false;
  let index = 0;
  while (index < input.length && input[index] === target[index]) index++;
  if (input.length === target.length) {
    return (
      input.slice(index + 1) === target.slice(index + 1) ||
      (input[index] === target[index + 1] && input[index + 1] === target[index] && input.slice(index + 2) === target.slice(index + 2))
    );
  }
  if (input.length > target.length) return input.slice(index + 1) === target.slice(index);
  return input.slice(index) === target.slice(index + 1);
}

/** Suggest the first nearby page in manifest order, within the same parent path and deployed base. */
export function suggestPage(url: Pick<URL, "href" | "pathname" | "search" | "hash">) {
  const base = new URL(resolve("/"), url.href).pathname.replace(/\/$/, "");
  const { pathname } = url;
  if (base && !pathname.startsWith(`${base}/`)) return;
  const path = pathname.slice(base.length).replace(/\/+$/, "");
  const destinations = routes
    .filter(({ page, id }) => page && !id.includes("["))
    .map(({ id }) => {
      const path = id.replace(/\/\([^/]+\)/g, "") || "/";
      const separator = path.lastIndexOf("/");
      return { id, path, parent: path.slice(0, separator), name: path.slice(separator + 1) };
    })
    .filter(({ path }) => path !== "/test" && !path.startsWith("/test/"));
  if (destinations.some((destination) => destination.path === path)) return;
  const normalized = path.toLowerCase();
  const separator = normalized.lastIndexOf("/");
  const parent = normalized.slice(0, separator);
  const name = normalized.slice(separator + 1);
  const match = destinations.find((destination) => destination.parent === parent && isSingleTypo(name, destination.name));
  if (!match) return;
  const { id, path: destination } = match;
  return { id, path: destination, href: `${resolve(id)}${url.search}${url.hash}` };
}
