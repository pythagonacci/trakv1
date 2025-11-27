#!/usr/bin/env bash
set -e

# Navigate to the app directory
cd /app || cd "$(dirname "$0")" || pwd

echo "Current directory: $(pwd)"
echo "Contents of current directory:"
ls -la

# Install production dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "node_modules not found. Installing production dependencies..."
  if command -v npm &> /dev/null; then
    npm ci --only=production
  elif [ -f "/usr/local/bin/npm" ]; then
    /usr/local/bin/npm ci --only=production
  else
    echo "Warning: npm not found, attempting to continue anyway"
  fi
fi

# Check if Next.js binary exists
NEXT_BIN="./node_modules/.bin/next"
if [ ! -f "$NEXT_BIN" ]; then
  echo "Checking alternative locations..."
  # Try to find next binary
  if [ -f "/app/node_modules/.bin/next" ]; then
    NEXT_BIN="/app/node_modules/.bin/next"
  elif [ -f "node_modules/.bin/next" ]; then
    NEXT_BIN="node_modules/.bin/next"
  else
    echo "Error: Next.js binary not found"
    echo "PATH: $PATH"
    echo "Looking for node..."
    which node || echo "node not found"
    echo "Looking for npm..."
    which npm || echo "npm not found"
    exit 1
  fi
fi

echo "Starting Next.js with: $NEXT_BIN"
exec "$NEXT_BIN" start --port ${PORT:-3000}

