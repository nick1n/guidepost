import { readFile } from "node:fs/promises";
import { Schema } from "effect";

const metadata = Schema.Struct({ pid: Schema.optionalKey(Schema.Unknown), acquiredAt: Schema.optionalKey(Schema.Unknown) });
const pid = Schema.Int.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));

/** Diagnose an existing lock without deciding whether its recorded process still owns it. */
export async function formatLockConflict(path: string, holder: string) {
  let recorded = "Recorded PID and acquisition time are unavailable.";
  try {
    const saved = Schema.decodeUnknownSync(metadata)(JSON.parse(await readFile(path, "utf8")));
    const processId = Schema.is(pid)(saved.pid) ? String(saved.pid) : "unavailable";
    const acquiredAt =
      Schema.is(Schema.String)(saved.acquiredAt) && Number.isFinite(Date.parse(saved.acquiredAt)) ? saved.acquiredAt : "unavailable";
    recorded = `Recorded PID: ${processId}; acquired at: ${acquiredAt}.`;
  } catch {
    // A competing process may still be writing metadata, or the lock may be unreadable.
  }
  return [
    `Existing ${holder} lock: ${path}.`,
    recorded,
    "Check whether the recorded process and command are still active, using the acquisition time to identify the holder; PIDs can be reused.",
    "If active, wait for it to finish. Only after confirming this lock is abandoned, delete only this lock file and retry.",
    "Keep timing and checkpoint files so request spacing and saved progress are preserved.",
  ].join(" ");
}
