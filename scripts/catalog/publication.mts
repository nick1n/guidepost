import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { format, resolveConfig } from "prettier";

type PublicationFile = { path: string } & ({ json: unknown } | { bytes: Uint8Array });
type Baseline = { path: string; text: string | undefined; message: string };
type CleanupFailure = { path: string; cause: unknown };

export class PublicationError extends Error {
  readonly published: readonly string[];
  readonly pending: readonly string[];
  readonly cleanupFailures: readonly CleanupFailure[];

  constructor(cause: unknown, published: readonly string[], pending: readonly string[], cleanupFailures: readonly CleanupFailure[]) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    const progress = published.length
      ? `Published files: ${published.join(", ")}. Pending files: ${pending.join(", ") || "none"}.`
      : "No files were published.";
    super(`${reason} ${progress}${cleanupFailures.length ? " Some temporary files could not be removed." : ""}`, { cause });
    this.name = "PublicationError";
    this.published = published;
    this.pending = pending;
    this.cleanupFailures = cleanupFailures;
  }
}

/**
 * Stage every output before checking input baselines. Outputs publish in caller order.
 * Each rename replaces one file; multiple files are not transactional. Baseline checks
 * cannot prevent an external editor writing between a check and rename. Failures report
 * completed replacements rather than rolling back over possible intervening edits.
 */
export async function publishFiles(
  files: readonly PublicationFile[],
  options: { baselines?: readonly Baseline[]; signal?: AbortSignal } = {},
) {
  const outputs = files.map((file) => ({ ...file, path: resolve(file.path) }));
  const paths = outputs.map(({ path }) => path);
  if (new Set(paths).size !== paths.length) throw new Error("Publication repeats an output path.");
  const baselines = (options.baselines ?? []).map(({ path, text, message }) => ({
    path: resolve(path),
    expected: text === undefined ? undefined : Buffer.from(text),
    message,
  }));
  const staged: { path: string; temporary: string; bytes: Uint8Array }[] = [];
  const published: string[] = [];
  let failure: { cause: unknown } | undefined;
  const cleanupFailures: CleanupFailure[] = [];

  async function checkBaselines() {
    for (const baseline of baselines) {
      const current = await readFile(baseline.path).catch((cause: NodeJS.ErrnoException) => {
        if (cause.code === "ENOENT") return undefined;
        throw cause;
      });
      if (current === undefined ? baseline.expected !== undefined : baseline.expected === undefined || !current.equals(baseline.expected))
        throw new Error(baseline.message);
    }
    options.signal?.throwIfAborted();
  }

  try {
    options.signal?.throwIfAborted();
    for (const file of outputs) {
      const bytes =
        "json" in file
          ? Buffer.from(await format(JSON.stringify(file.json), { ...(await resolveConfig(file.path)), parser: "json" }))
          : Buffer.from(file.bytes);
      options.signal?.throwIfAborted();
      await mkdir(dirname(file.path), { recursive: true });
      const temporary = `${file.path}.${randomUUID()}.tmp`;
      const handle = await open(temporary, "wx");
      staged.push({ path: file.path, temporary, bytes });
      try {
        await handle.writeFile(bytes);
      } finally {
        await handle.close();
      }
    }
    // Also check guarded no-op publications, which still depend on their input snapshot.
    if (!staged.length) await checkBaselines();
    for (const file of staged) {
      await checkBaselines();
      await rename(file.temporary, file.path);
      published.push(file.path);
      // Later replacements must preserve both untouched inputs and our earlier outputs.
      for (const baseline of baselines) if (baseline.path === file.path) baseline.expected = Buffer.from(file.bytes);
      options.signal?.throwIfAborted();
    }
  } catch (cause) {
    failure = { cause };
  } finally {
    for (const file of staged.slice(published.length)) {
      try {
        await unlink(file.temporary);
      } catch (cause) {
        if (!(cause instanceof Error && "code" in cause && cause.code === "ENOENT")) cleanupFailures.push({ path: file.temporary, cause });
      }
    }
  }
  if (failure || cleanupFailures.length)
    throw new PublicationError(
      failure ? failure.cause : new Error("Publication temporary-file cleanup failed."),
      published,
      paths.slice(published.length),
      cleanupFailures,
    );
}
