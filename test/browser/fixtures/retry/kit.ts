type Attempt = { href: string; options: object };

let settle: { resolve: () => void; reject: (cause: Error) => void } | undefined;
export const attempts: Attempt[] = [];
export const notices: string[] = [];

const requestedPath = new URLSearchParams(window.location.search).get("missing");
export const routes = [{ id: "/kdm/collection", page: true, endpoint: false }];
export const page = {
  url: new URL(requestedPath ?? "/retry-route/", window.location.origin),
  status: requestedPath ? 404 : 500,
  error: { message: "Fixture page failed to load." },
};

export function resolve(path: string) {
  return path;
}

// Only the SvelteKit dependency is controlled. The real navigate adapter, action runner,
// error component, and Svelte lifecycle execute unchanged.
export function goto(href: string, options: object) {
  attempts.push({ href, options });
  return new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
}

export function finish(outcome: "success" | "failure") {
  const current = settle;
  if (!current) throw new Error("No pending navigation");
  settle = undefined;
  if (outcome === "success") current.resolve();
  else current.reject(new Error("Fixture navigation failed"));
}
