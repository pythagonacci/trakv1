#!/bin/bash
# Clean Next.js build and caches

echo "🧹 Cleaning Next.js build caches..."

# Kill any running Next.js processes
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "node.*next" 2>/dev/null

# Remove build artifacts
rm -rf .next
rm -rf .turbo
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo

echo "✅ All caches cleared!"
echo ""
echo "Now run: npm run dev"


