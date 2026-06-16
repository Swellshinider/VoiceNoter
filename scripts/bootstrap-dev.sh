#!/usr/bin/env bash
# Bootstrap a fresh VoiceNoter checkout for local development.
set -euo pipefail

require_command() {
  local command_name="$1"
  local guidance="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Error: missing required command '$command_name'. $guidance" >&2
    exit 1
  fi
}

echo "VoiceNoter developer setup"
echo "1/4 Checking required tools..."
require_command git "Install Git and rerun 'pnpm bootstrap'."
require_command pnpm "Install pnpm and rerun 'pnpm bootstrap'."
require_command python3 "Install Python 3 and rerun 'pnpm bootstrap'."
require_command cmake "Install CMake and rerun 'pnpm bootstrap'."
require_command make "Install make and rerun 'pnpm bootstrap'."
require_command gcc "Install GCC and rerun 'pnpm bootstrap'."
require_command g++ "Install G++ and rerun 'pnpm bootstrap'."

echo "2/4 Installing Node dependencies..."
pnpm install

echo "3/4 Building pinned whisper.cpp..."
pnpm prepare:whisper

echo "4/4 Rebuilding better-sqlite3 for Electron..."
pnpm rebuild:electron

echo "VoiceNoter developer setup is complete."
echo "Next: run 'pnpm dev' and follow the README first-run checklist."
