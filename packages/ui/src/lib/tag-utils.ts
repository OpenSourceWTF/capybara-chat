/**
 * Tag Utilities - Pure functions for tag parsing and filtering
 *
 * Extracted from TagInput.tsx for unit testing.
 */

/**
 * Parse comma-separated string into array of trimmed, non-empty tags
 */
export function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Format tags array back to comma-separated string
 */
export function formatTags(tags: string[]): string {
  return tags.join(', ');
}

/**
 * Filter tag cloud: known tags minus already-selected ones
 * Returns up to maxSuggestions tags (default 12)
 */
export function filterTagCloud(
  knownTags: string[],
  currentTags: string[],
  maxSuggestions = 12
): string[] {
  const currentSet = new Set(currentTags.map((t) => t.toLowerCase()));
  return knownTags
    .filter((t) => !currentSet.has(t.toLowerCase()))
    .slice(0, maxSuggestions);
}

/**
 * Normalize a tag: trim and lowercase
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Check if tag is a duplicate (case-insensitive)
 */
export function isDuplicateTag(tag: string, existingTags: string[]): boolean {
  const normalized = normalizeTag(tag);
  if (!normalized) return true; // Empty tags are "duplicates" (invalid)
  return existingTags.some((t) => t.toLowerCase() === normalized);
}
