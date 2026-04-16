#!/bin/bash
# Performance measurement script for tab switching and project loading
# Usage: bash scripts/measure-perf.sh [base_url]

BASE_URL="${1:-http://localhost:3001}"
COOKIE_FILE="/tmp/trak-perf-cookies.txt"

echo "========================================="
echo "  Trak Performance Measurement"
echo "  Base URL: $BASE_URL"
echo "========================================="
echo ""

# Step 1: Discover the session cookie from the browser
# We need auth cookies to test protected routes.
# Check if cookie file exists from a prior run
if [ ! -f "$COOKIE_FILE" ]; then
  echo "❌ No cookie file found at $COOKIE_FILE"
  echo ""
  echo "To measure authenticated routes, export your browser cookies:"
  echo "  1. Open DevTools > Application > Cookies"
  echo "  2. Copy the full Cookie header value"
  echo "  3. Save to: $COOKIE_FILE"
  echo "  4. Re-run this script"
  echo ""
  echo "Falling back to unauthenticated API timing..."
  echo ""
fi

echo "--- Server-side response times (curl TTFB) ---"
echo ""

# Measure raw TCP + TLS + TTFB for various endpoints
measure() {
  local label="$1"
  local url="$2"
  local cookie_flag=""

  if [ -f "$COOKIE_FILE" ]; then
    cookie_flag="-b $COOKIE_FILE"
  fi

  # time_starttransfer = TTFB (time to first byte)
  local result
  result=$(curl -s -o /dev/null -w "%{time_starttransfer} %{time_total} %{http_code}" \
    $cookie_flag \
    -H "Accept: text/html" \
    "$url" 2>/dev/null)

  local ttfb=$(echo "$result" | awk '{print $1}')
  local total=$(echo "$result" | awk '{print $2}')
  local code=$(echo "$result" | awk '{print $3}')

  local ttfb_ms=$(echo "$ttfb * 1000" | bc 2>/dev/null || echo "?")
  local total_ms=$(echo "$total * 1000" | bc 2>/dev/null || echo "?")

  printf "  %-40s TTFB: %6s ms  Total: %6s ms  HTTP %s\n" "$label" "$ttfb_ms" "$total_ms" "$code"
}

measure_api() {
  local label="$1"
  local url="$2"
  local cookie_flag=""

  if [ -f "$COOKIE_FILE" ]; then
    cookie_flag="-b $COOKIE_FILE"
  fi

  local result
  result=$(curl -s -o /dev/null -w "%{time_starttransfer} %{time_total} %{http_code}" \
    $cookie_flag \
    -H "Accept: application/json" \
    "$url" 2>/dev/null)

  local ttfb=$(echo "$result" | awk '{print $1}')
  local total=$(echo "$result" | awk '{print $2}')
  local code=$(echo "$result" | awk '{print $3}')

  local ttfb_ms=$(echo "$ttfb * 1000" | bc 2>/dev/null || echo "?")
  local total_ms=$(echo "$total * 1000" | bc 2>/dev/null || echo "?")

  printf "  %-40s TTFB: %6s ms  Total: %6s ms  HTTP %s\n" "$label" "$ttfb_ms" "$total_ms" "$code"
}

echo "Page loads (full RSC render):"
measure "GET /dashboard" "$BASE_URL/dashboard"
measure "GET /dashboard/projects" "$BASE_URL/dashboard/projects"
echo ""

echo "API routes (client-side tab data fetch):"
measure_api "GET /api/blocks/tab (no tabId)" "$BASE_URL/api/blocks/tab?tabId=test"
echo ""

echo "--- Repeat 3x to measure warm cache ---"
for i in 1 2 3; do
  echo ""
  echo "Run $i:"
  measure "GET /dashboard" "$BASE_URL/dashboard"
  measure "GET /dashboard/projects" "$BASE_URL/dashboard/projects"
done

echo ""
echo "========================================="
echo "  Done"
echo "========================================="
