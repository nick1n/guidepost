/** Only #/ fragments are page parameters; ordinary anchors are left to the browser. */
export function readHash(hash: string) {
  if (!hash.startsWith("#/")) return undefined;
  try {
    return hash.slice(2).split("/").map(decodeURIComponent);
  } catch {
    return undefined;
  }
}

export function formatHash(segments: readonly (string | number)[]) {
  return `#/${segments.map((value) => encodeURIComponent(String(value))).join("/")}`;
}
