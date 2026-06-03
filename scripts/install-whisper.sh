#!/usr/bin/env bash
# Build whisper.cpp into vendor/whisper.cpp if not already present.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$ROOT_DIR/vendor"
REPO_DIR="$VENDOR_DIR/whisper.cpp"
CLI_PATH="$REPO_DIR/build/bin/whisper-cli"

if [[ -f "$CLI_PATH" ]]; then
  echo "whisper-cli already exists at $CLI_PATH"
  exit 0
fi

mkdir -p "$VENDOR_DIR"

if [[ ! -d "$REPO_DIR" ]]; then
  git clone --depth 1 --branch v1.8.6 https://github.com/ggml-org/whisper.cpp.git "$REPO_DIR"
fi

(
  cd "$REPO_DIR"
  cmake -B build -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=OFF
  cmake --build build -j --config Release
)
