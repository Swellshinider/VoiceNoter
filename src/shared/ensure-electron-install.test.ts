import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { spawn } from "node:child_process";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { repairElectronInstall } = require("../../scripts/ensure-electron-install.js");

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("repairElectronInstall", () => {
  test("extracts the cached Electron zip, writes path.txt, and restores executable permissions", async () => {
    const root = join(tmpdir(), `voicenoter-electron-${randomUUID()}`);
    const electronDir = join(root, "electron");
    const sourceDir = join(root, "source");
    const zipPath = join(root, "electron.zip");
    createdDirs.push(root);

    await mkdir(join(electronDir, "dist"), { recursive: true });
    await mkdir(join(sourceDir, "locales"), { recursive: true });
    await writeFile(join(sourceDir, "electron"), "#!/usr/bin/env bash\necho electron\n", "utf8");
    await chmod(join(sourceDir, "electron"), 0o644);
    await writeFile(join(sourceDir, "version"), "v35.7.5\n", "utf8");
    await writeFile(join(sourceDir, "locales", "en-US.pak"), "locale", "utf8");

    await runPython([
      "-c",
      [
        "import pathlib, zipfile, sys",
        "source = pathlib.Path(sys.argv[1])",
        "target = pathlib.Path(sys.argv[2])",
        "with zipfile.ZipFile(target, 'w') as archive:",
        "    for path in source.rglob('*'):",
        "        if path.is_file():",
        "            archive.write(path, path.relative_to(source).as_posix())",
      ].join("\n"),
      sourceDir,
      zipPath,
    ]);

    const executablePath = await repairElectronInstall({
      electronDir,
      zipPath,
      executableName: "electron",
    });

    expect(executablePath).toBe(join(electronDir, "dist", "electron"));
    await expect(readFile(join(electronDir, "path.txt"), "utf8")).resolves.toBe("electron");
    await expect(readFile(join(electronDir, "dist", "version"), "utf8")).resolves.toContain("35.7.5");
    const stats = await stat(executablePath);
    expect(stats.mode & 0o111).not.toBe(0);
  });
});

function runPython(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`python3 exited with code ${code}`));
    });
  });
}
