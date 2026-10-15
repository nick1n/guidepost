import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { formatLockConflict } from "#scripts/catalog/locks.mts";

it.each([
  {
    name: "complete metadata",
    text: JSON.stringify({ pid: 1234, acquiredAt: "2026-10-15T12:34:56.000Z" }),
    expected: ["Recorded PID: 1234", "acquired at: 2026-10-15T12:34:56.000Z"],
  },
  { name: "PID only", text: JSON.stringify({ pid: 1234 }), expected: ["Recorded PID: 1234", "acquired at: unavailable"] },
  {
    name: "time only",
    text: JSON.stringify({ acquiredAt: "2026-10-15T12:34:56.000Z" }),
    expected: ["Recorded PID: unavailable", "acquired at: 2026-10-15T12:34:56.000Z"],
  },
  {
    name: "invalid fields",
    text: JSON.stringify({ pid: -1, acquiredAt: "invalid" }),
    expected: ["Recorded PID: unavailable", "acquired at: unavailable"],
  },
  { name: "partial JSON", text: '{"pid":1234,', expected: ["Recorded PID and acquisition time are unavailable"] },
  { name: "empty lock", text: "", expected: ["Recorded PID and acquisition time are unavailable"] },
  { name: "wrong shape", text: "null", expected: ["Recorded PID and acquisition time are unavailable"] },
])("explains recovery for $name without changing the lock", async ({ text, expected }) => {
  const directory = await mkdtemp(join(tmpdir(), "guidepost-lock-message-"));
  const path = join(directory, "request.lock");
  try {
    await writeFile(path, text);
    const message = await formatLockConflict(path, "shop request");
    expect(message).toContain("Existing shop request lock: " + path);
    for (const fragment of expected) expect(message).toContain(fragment);
    expect(message).toContain("process and command are still active");
    expect(message).toContain("PIDs can be reused");
    expect(message).toContain("Only after confirming this lock is abandoned, delete only this lock file");
    expect(message).toContain("Keep timing and checkpoint files");
    expect(await readFile(path, "utf8")).toBe(text);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("retains actionable conflict guidance when metadata cannot be read", async () => {
  const directory = await mkdtemp(join(tmpdir(), "guidepost-lock-unreadable-"));
  try {
    const path = join(directory, "request.lock");
    await mkdir(path);
    const message = await formatLockConflict(path, "shop request");
    expect(message).toContain("Existing shop request lock: " + path);
    expect(message).toContain("Recorded PID and acquisition time are unavailable");
    expect(message).toContain("Only after confirming this lock is abandoned");
    await mkdir(join(path, "still-present"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
