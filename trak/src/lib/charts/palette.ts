/**
 * Deterministic chart color palette using Trak design tokens.
 * Colors are derived from the Sarajevo Arts palette + extended set.
 * A label hash maps to a stable index so the same label always gets the same color.
 */

// Base palette — ordered by visual diversity.
// These are CSS variable references; callers may use raw hex values for
// Recharts which doesn't traverse CSS vars at paint time.
const PALETTE_HEX_LIGHT = [
  "#4A7A78", // dome-teal
  "#C77D63", // tile-orange
  "#52637A", // river-indigo
  "#D4A353", // tram-yellow
  "#7D6B7D", // velvet-purple
  "#5A9EA0", // extended: cadet-blue
  "#B5651D", // extended: sienna
  "#6B8E23", // extended: olive-drab
  "#8B6914", // extended: golden-brown
  "#9370DB", // extended: medium-purple
  "#CD5C5C", // extended: indian-red
  "#2E8B57", // extended: sea-green
];

const PALETTE_HEX_DARK = [
  "#5A8A88", // dome-teal dark
  "#D98E74", // tile-orange dark
  "#6B7C94", // river-indigo dark
  "#E4B363", // tram-yellow dark
  "#8D7B8D", // velvet-purple dark
  "#6EB4B6",
  "#C7763A",
  "#7EA030",
  "#A07824",
  "#A385E8",
  "#DC7070",
  "#3EA067",
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
