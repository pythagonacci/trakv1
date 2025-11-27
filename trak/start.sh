#!/usr/bin/env bash
set -e

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Use the Next.js binary directly from node_modules
# This is more reliable than relying on npm being in PATH
NEXT_BIN="./node_modules/.bin/next"

if [ -f "$NEXT_BIN" ]; then
  exec "$NEXT_BIN" start --port ${PORT:-3000}
else
  echo "Error: Next.js binary not found at $NEXT_BIN"
  echo "Current directory: $(pwd)"
  echo "Checking for node_modules..."
  ls -la node_modules/.bin/ 2>/dev/null || echo "node_modules/.bin not found"
  exit 1
fi

