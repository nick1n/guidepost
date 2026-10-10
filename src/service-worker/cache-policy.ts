// Cache optional pages and data after use; keep the modern icon font in the app shell.
export function isDeferredAsset(path: string) {
  return (
    path.startsWith("kdm/collection/") ||
    path.startsWith("kdm-catalog/") ||
    path.startsWith("test/font/") ||
    path.startsWith("test/gesture/") ||
    path === "fonts/kd-icons-v1.woff"
  );
}
