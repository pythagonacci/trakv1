/**
 * Chart color palette — matches timeline event palette (Tailwind hues).
 * Ordered for maximum adjacent contrast: consecutive indices (0,1,2...) get
 * colors spaced across the hue wheel so bars/slices next to each other are
 * visually distinct (avoids blue/indigo/purple clustering).
 */

// Maximal-contrast order: alternate between hue regions (blue, orange, teal, rose, lime, purple, etc.)
const PALETTE_HEX_LIGHT = [
  "#3b82f6", // blue-500
  "#f97316", // orange-500
  "#14b8a6", // teal-500
  "#f43f5e", // rose-500
  "#84cc16", // lime-500
  "#a855f7", // purple-500
  "#f59e0b", // amber-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#22c55e", // green-500
  "#6366f1", // indigo-500
  "#10b981", // emerald-500
];

const PALETTE_HEX_DARK = [
  "#60a5fa", // blue-400
  "#fb923c", // orange-400
  "#2dd4bf", // teal-400
  "#fb7185", // rose-400
  "#a3e635", // lime-400
  "#c084fc", // purple-400
  "#fbbf24", // amber-400
  "#22d3ee", // cyan-400
  "#f472b6", // pink-400
  "#4ade80", // green-400
  "#818cf8", // indigo-400
  "#34d399", // emerald-400
];

/** Simple djb2-style hash for a string → unsigned 31-bit int */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Get a deterministic hex color for a category label.
 *
 * @param label  The category label string.
 * @param index  Optional 0-based insertion index (overrides hash when provided).
 *               Pass the index when building a palette for an ordered series so
 *               adjacent colors are maximally distinct.
 * @param dark   Pass true when the current theme is dark mode.
 */
export function getCategoryColor(
  label: string,
  index?: number,
  dark = false
): string {
  const palette = dark ? PALETTE_HEX_DARK : PALETTE_HEX_LIGHT;
  const idx =
    index !== undefined
      ? index % palette.length
      : hashString(label) % palette.length;
  return palette[idx]!;
}

/**
 * Build a stable label → color map for a list of category labels.
 * Uses insertion-order index so adjacent bars/slices are visually distinct.
 */
export function buildColorMap(
  labels: string[],
  dark = false
): Record<string, string> {
  const map: Record<string, string> = {};
  labels.forEach((label, i) => {
    map[label] = getCategoryColor(label, i, dark);
  });
  return map;
}

/** Special colors for semantic labels */
const SEMANTIC_COLORS: Record<string, string> = {
  Rest: "#94a3b8",    // slate-400 — neutral remainder slice
  Other: "#94a3b8",
  Unspecified: "#cbd5e1", // slate-300
};

/**
 * Resolve a color for a label, respecting semantic overrides.
 */
export function resolveColor(
  label: string,
  index?: number,
  dark = false
): string {
  return SEMANTIC_COLORS[label] ?? getCategoryColor(label, index, dark);
}
