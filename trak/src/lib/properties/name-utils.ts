/**
 * Property name helpers.
 *
 * Intentionally NOT a Server Actions module (no `"use server"`), so these can be
 * synchronous utilities imported by server actions and (optionally) client code.
 */

/**
 * Normalizes a property name for duplicate detection.
 * Converts to lowercase and replaces special characters with a single separator.
 */
export function normalizePropertyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Checks if a property name is similar to existing ones (fuzzy duplicate detection).
 */
export function isSimilarPropertyName(
  name: string,
  existingNames: string[]
): string | null {
  const normalized = normalizePropertyName(name);
  for (const existing of existingNames) {
    if (normalizePropertyName(existing) === normalized) {
      return existing;
    }
  }
  return null;
}

