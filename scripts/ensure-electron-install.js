#!/usr/bin/env node

const { existsSync, chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { spawnSync } = require("node:child_process");

async function ensureElectronInstall(options = {}) {
  const electronDir = options.electronDir ?? dirname(require.resolve("electron/package.json"));
  const packageJsonPath = options.packageJsonPath ?? join(electronDir, "package.json");
  const packageJson = require(packageJsonPath);
  const executableName = options.executableName ?? getExecutableName(process.env.npm_config_platform || process.platform);
  const distPath = join(electronDir, "dist");
  const pathFile = join(electronDir, "path.txt");

  if (isInstallUsable(distPath, pathFile)) {
    return join(distPath, readFileSync(pathFile, "utf8"));
  }

  const zipPath =
    options.zipPath ??
    (await requireElectronDownloader(electronDir)({
      version: packageJson.version,
      artifactName: "electron",
      force: process.env.force_no_cache === "true",
      cacheRoot: process.env.electron_config_cache,
      checksums:
        process.env.electron_use_remote_checksums ?? process.env.npm_config_electron_use_remote_checksums
          ? undefined
          : require(join(electronDir, "checksums.json")),
      platform: process.env.npm_config_platform || process.platform,
      arch: process.env.npm_config_arch || process.arch,
    }));

  return repairElectronInstall({
    electronDir,
    zipPath,
    executableName,
  });
}

async function repairElectronInstall({ electronDir, zipPath, executableName }) {
  const distPath = join(electronDir, "dist");
  const pathFile = join(electronDir, "path.txt");
  const executablePath = join(distPath, executableName);

  rmSync(distPath, { recursive: true, force: true });
  mkdirSync(distPath, { recursive: true });

  const result = spawnSync(
    "python3",
    [
      "-c",
      [
        "import pathlib, sys, zipfile",
        "zip_path = pathlib.Path(sys.argv[1])",
        "dist_path = pathlib.Path(sys.argv[2])",
        "with zipfile.ZipFile(zip_path) as archive:",
        "    archive.extractall(dist_path)",
      ].join("\n"),
      zipPath,
      distPath,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`python3 failed to extract Electron archive (exit ${result.status ?? "unknown"})`);
  }

  if (!existsSync(executablePath)) {
    throw new Error(`Electron archive did not produce ${executablePath}`);
  }

  chmodSync(executablePath, 0o755);
  writeFileSync(pathFile, executableName, "utf8");

  return executablePath;
}

function isInstallUsable(distPath, pathFile) {
  if (!existsSync(pathFile)) {
    return false;
  }

  const executableName = readFileSync(pathFile, "utf8");
  return executableName.length > 0 && existsSync(join(distPath, executableName));
}

function getExecutableName(platform) {
  switch (platform) {
    case "mas":
    case "darwin":
      return "Electron.app/Contents/MacOS/Electron";
    case "win32":
      return "electron.exe";
    default:
      return "electron";
  }
}

if (require.main === module) {
  ensureElectronInstall()
    .then((electronPath) => {
      process.stdout.write(`${electronPath}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}

module.exports = {
  ensureElectronInstall,
  repairElectronInstall,
};

function requireElectronDownloader(electronDir) {
  return require(require.resolve("@electron/get", { paths: [electronDir] })).downloadArtifact;
}
