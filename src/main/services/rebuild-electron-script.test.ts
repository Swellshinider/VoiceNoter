import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("rebuild-electron.sh", () => {
  test("rebuilds when the stamp matches but Electron cannot load better-sqlite3", async () => {
    const root = await mkdtemp(join(tmpdir(), "voicenoter-rebuild-electron-"));
    const moduleDir = join(root, "better-sqlite3");
    const binDir = join(root, "bin");
    const marker = join(root, "rebuilt");
    await mkdir(join(moduleDir, "build", "Release"), { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(join(moduleDir, ".electron-rebuild-stamp"), "35.7.5\n", "utf8");
    await writeFile(join(moduleDir, "build", "Release", "better_sqlite3.node"), "native module", "utf8");

    const fakeElectron = join(binDir, "electron");
    await writeFile(
      fakeElectron,
      `#!/usr/bin/env bash
if [[ "$1" == "--version" ]]; then
  echo "v35.7.5"
  exit 0
fi
if [[ "$*" != *":memory:"* ]]; then
  exit 1
fi
if [[ -f "$ELECTRON_LOAD_OK_MARKER" ]]; then
  exit 0
fi
exit 1
`,
      "utf8",
    );
    await chmod(fakeElectron, 0o755);

    const fakeNpx = join(binDir, "npx");
    await writeFile(
      fakeNpx,
      `#!/usr/bin/env bash
touch "$REBUILD_MARKER"
exit 0
`,
      "utf8",
    );
    await chmod(fakeNpx, 0o755);

    const result = await execFileAsync("bash", [join(process.cwd(), "scripts", "rebuild-electron.sh")], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        VOICENOTER_BETTER_SQLITE3_DIR: moduleDir,
        VOICENOTER_ELECTRON_PATH: fakeElectron,
        REBUILD_MARKER: marker,
        ELECTRON_LOAD_OK_MARKER: marker,
      },
    });

    expect(result.stdout).toContain("Rebuilding better-sqlite3 for Electron 35.7.5");
    await expect(readFile(marker, "utf8")).resolves.toBe("");
    await expect(readFile(join(moduleDir, ".electron-rebuild-stamp"), "utf8")).resolves.toBe("35.7.5\n");
  });

  test("skips when the stamp matches and Electron can load better-sqlite3", async () => {
    const root = await mkdtemp(join(tmpdir(), "voicenoter-rebuild-electron-"));
    const moduleDir = join(root, "better-sqlite3");
    const binDir = join(root, "bin");
    const marker = join(root, "load-ok");
    await mkdir(join(moduleDir, "build", "Release"), { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(join(moduleDir, ".electron-rebuild-stamp"), "35.7.5\n", "utf8");
    await writeFile(join(moduleDir, "build", "Release", "better_sqlite3.node"), "native module", "utf8");
    await writeFile(marker, "", "utf8");

    const fakeElectron = join(binDir, "electron");
    await writeFile(
      fakeElectron,
      `#!/usr/bin/env bash
if [[ "$1" == "--version" ]]; then
  echo "v35.7.5"
  exit 0
fi
if [[ "$*" != *":memory:"* ]]; then
  exit 1
fi
if [[ -f "$ELECTRON_LOAD_OK_MARKER" ]]; then
  exit 0
fi
exit 1
`,
      "utf8",
    );
    await chmod(fakeElectron, 0o755);

    const fakeNpx = join(binDir, "npx");
    await writeFile(
      fakeNpx,
      `#!/usr/bin/env bash
echo "unexpected rebuild" >&2
exit 1
`,
      "utf8",
    );
    await chmod(fakeNpx, 0o755);

    const result = await execFileAsync("bash", [join(process.cwd(), "scripts", "rebuild-electron.sh")], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        VOICENOTER_BETTER_SQLITE3_DIR: moduleDir,
        VOICENOTER_ELECTRON_PATH: fakeElectron,
        ELECTRON_LOAD_OK_MARKER: marker,
      },
    });

    expect(result.stdout).toContain("better-sqlite3 already built for Electron 35.7.5, skipping.");
  });
});
