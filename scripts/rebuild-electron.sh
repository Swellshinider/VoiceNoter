#!/usr/bin/env bash
# Rebuild better-sqlite3 for Electron only when the version changes.
set -euo pipefail

MODULE_DIR="node_modules/better-sqlite3"
STAMP_FILE="$MODULE_DIR/.electron-rebuild-stamp"

# Get current Electron version (strip leading 'v')
ELECTRON_VERSION=$(npx electron --version | tr -d v)

# Skip rebuild if stamp matches and .node binary exists
if [[ -f "$STAMP_FILE" ]]; then
  CACHED=$(cat "$STAMP_FILE")
  if [[ "$CACHED" == "$ELECTRON_VERSION" ]] && find "$MODULE_DIR/build" -name "*.node" -print -quit 2>/dev/null | grep -q .; then
    echo "better-sqlite3 already built for Electron $ELECTRON_VERSION, skipping."
    exit 0
  fi
fi

PROJ_ROOT="$(pwd)"

echo "Rebuilding better-sqlite3 for Electron $ELECTRON_VERSION (this may take a minute)..."
cd "$MODULE_DIR"
npx node-gyp rebuild --release \
  --target="$ELECTRON_VERSION" \
  --dist-url=https://electronjs.org/headers \
  --build-from-source

# Write stamp on success
echo "$ELECTRON_VERSION" > "$PROJ_ROOT/$STAMP_FILE"
echo "better-sqlite3 rebuilt for Electron $ELECTRON_VERSION."
