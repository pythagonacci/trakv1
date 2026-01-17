#!/bin/bash
# Quick recovery script if npm issues happen again

echo "🧹 Cleaning up corrupted files..."

# Remove node_modules and caches
rm -rf node_modules package-lock.json .next

# Remove any numbered duplicates
find . -type f \( -name "* 2" -o -name "* 3" -o -name "* 4" -o -name "* 5" -o -name "* 6" \) -delete 2>/dev/null || true

# Ensure correct Node version
nvm use 22.12.0

echo "📦 Running fresh npm install..."
npm install

echo "✅ Done! Run 'npm run dev' to start the server."
