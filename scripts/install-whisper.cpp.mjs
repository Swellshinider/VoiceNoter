import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = resolve(root, "vendor");
const repoDir = resolve(vendorDir, "whisper.cpp");
const cliPath = resolve(repoDir, "build/bin/whisper-cli");

if (existsSync(cliPath)) {
  console.log(`whisper-cli already exists at ${cliPath}`);
  process.exit(0);
}

await mkdir(vendorDir, { recursive: true });

if (!existsSync(repoDir)) {
  run("git", ["clone", "--depth", "1", "--branch", "v1.8.6", "https://github.com/ggml-org/whisper.cpp.git", repoDir]);
}

run("cmake", ["-B", "build", "-DWHISPER_BUILD_TESTS=OFF", "-DWHISPER_BUILD_EXAMPLES=OFF"], repoDir);
run("cmake", ["--build", "build", "-j", "--config", "Release"], repoDir);

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
