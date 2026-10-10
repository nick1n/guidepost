// Cache optional pages and data after use; keep the modern icon font in the app shell.
export function isDeferredAsset(path: string) {
  return (
    path.startsWith("collection/") ||
    path.startsWith("kdm-catalog/") ||
    path.startsWith("font-test/") ||
    path.startsWith("gesture-test/") ||
    path === "fonts/kd-icons-v1.woff"
  );
}
