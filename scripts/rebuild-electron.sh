#!/usr/bin/env bash
# Rebuild better-sqlite3 for Electron only when the current native binary is loadable.
set -euo pipefail

MODULE_DIR_INPUT="${VOICENOTER_BETTER_SQLITE3_DIR:-node_modules/better-sqlite3}"
MODULE_DIR="$(cd "$MODULE_DIR_INPUT" && pwd -P)"
STAMP_FILE="$MODULE_DIR/.electron-rebuild-stamp"

# Verify Electron binary exists before trying to use it
if [[ -n "${VOICENOTER_ELECTRON_PATH:-}" ]]; then
  ELECTRON_PATH="$VOICENOTER_ELECTRON_PATH"
else
  ELECTRON_PATH=$(node -e "console.log(require('electron'))" 2>/dev/null) || {
    echo "Error: Electron binary not found. Run 'pnpm install' again or download manually." >&2
    exit 1
  }
fi
if [[ ! -x "$ELECTRON_PATH" ]]; then
  echo "Error: Electron binary not executable at $ELECTRON_PATH" >&2
  exit 1
fi

# Get current Electron version (strip leading 'v')
ELECTRON_VERSION=$("$ELECTRON_PATH" --version | tr -d v)

electron_can_load_better_sqlite3() {
  ELECTRON_RUN_AS_NODE=1 VOICENOTER_BETTER_SQLITE3_DIR="$MODULE_DIR" "$ELECTRON_PATH" \
    -e "const Database = require(process.env.VOICENOTER_BETTER_SQLITE3_DIR); const db = new Database(':memory:'); db.close();" >/dev/null 2>&1
}

NATIVE_BINARY=$(find "$MODULE_DIR/build" -name "*.node" -print -quit 2>/dev/null || true)

# Skip rebuild if stamp matches, a native binary exists, and Electron can load it.
if [[ -f "$STAMP_FILE" ]]; then
  CACHED=$(cat "$STAMP_FILE")
  if [[ "$CACHED" == "$ELECTRON_VERSION" ]] && [[ -n "$NATIVE_BINARY" ]] && electron_can_load_better_sqlite3; then
    echo "better-sqlite3 already built for Electron $ELECTRON_VERSION, skipping."
    exit 0
  fi
fi

echo "Rebuilding better-sqlite3 for Electron $ELECTRON_VERSION (this may take a minute)..."
cd "$MODULE_DIR"
npx node-gyp rebuild --release \
  --target="$ELECTRON_VERSION" \
  --dist-url=https://electronjs.org/headers \
  --build-from-source

if ! electron_can_load_better_sqlite3; then
  echo "Error: better-sqlite3 rebuilt but Electron still cannot load it." >&2
  exit 1
fi

# Write stamp on success
echo "$ELECTRON_VERSION" > "$STAMP_FILE"
echo "better-sqlite3 rebuilt for Electron $ELECTRON_VERSION."
