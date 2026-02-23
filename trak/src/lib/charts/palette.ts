/**
 * Chart color palette — refined, cohesive colors with good adjacent contrast.
 * Order alternates hue regions so consecutive series (bars/slices) stay distinct.
 * Alpha matches timeline event bars (bg-*-500/50) for a consistent transparent feel.
 */

/** Alpha for chart fills (0–1). Matches timeline bars (50% opacity). */
const CHART_ALPHA = 0.5;

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return hex + a;
}

// Light mode: slightly deeper, polished tones that read well on white/light gray
const PALETTE_HEX_LIGHT = [
  "#2563eb", // blue-600
  "#ea580c", // orange-600
  "#0d9488", // teal-600
  "#db2777", // pink-600
  "#65a30d", // lime-600
  "#7c3aed", // violet-600
  "#d97706", // amber-600
  "#0891b2", // cyan-600
  "#be185d", // rose-600
  "#16a34a", // green-600
  "#4f46e5", // indigo-600
  "#059669", // emerald-600
];

// Dark mode: brighter variants for contrast on dark backgrounds
const PALETTE_HEX_DARK = [
  "#60a5fa", // blue-400
  "#fb923c", // orange-400
  "#2dd4bf", // teal-400
  "#f472b6", // pink-400
  "#a3e635", // lime-400
  "#a78bfa", // violet-400
  "#fbbf24", // amber-400
  "#22d3ee", // cyan-400
  "#fb7185", // rose-400
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
  return withAlpha(palette[idx]!, CHART_ALPHA);
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

/** Special colors for semantic labels (neutral, easy to read) */
const SEMANTIC_BASE: Record<string, string> = {
  Rest: "#64748b", // slate-500
  Other: "#64748b",
  Unspecified: "#94a3b8", // slate-400
};

/**
 * Resolve a color for a label, respecting semantic overrides.
 */
export function resolveColor(
  label: string,
  index?: number,
  dark = false
): string {
  const base = SEMANTIC_BASE[label];
  return base
    ? withAlpha(base, CHART_ALPHA)
    : getCategoryColor(label, index, dark);
}
