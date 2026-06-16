#!/usr/bin/env bash
# Build whisper.cpp into vendor/whisper.cpp if not already present.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$ROOT_DIR/vendor"
REPO_DIR="$VENDOR_DIR/whisper.cpp"
CLI_PATH="$REPO_DIR/build/bin/whisper-cli"
WHISPER_VERSION="v1.8.6"

require_command() {
  local command_name="$1"
  local guidance="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Error: missing required command '$command_name'. $guidance" >&2
    exit 1
  fi
}

require_command git "Install Git before running 'pnpm prepare:whisper' or 'pnpm bootstrap'."
require_command cmake "Install CMake before running 'pnpm prepare:whisper' or 'pnpm bootstrap'."

echo "Preparing pinned whisper.cpp checkout ($WHISPER_VERSION)..."

if [[ -x "$CLI_PATH" ]]; then
  echo "whisper.cpp is already built at $CLI_PATH"
  exit 0
fi

mkdir -p "$VENDOR_DIR"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "Cloning whisper.cpp into $REPO_DIR"
  git clone --depth 1 --branch "$WHISPER_VERSION" https://github.com/ggml-org/whisper.cpp.git "$REPO_DIR"
else
  echo "Reusing existing whisper.cpp checkout at $REPO_DIR"
fi

echo "Building whisper-cli (this may take a few minutes)..."
(
  cd "$REPO_DIR"
  cmake -B build -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON
  cmake --build build -j --config Release --target whisper-cli
)

echo "whisper.cpp is ready at $CLI_PATH"
