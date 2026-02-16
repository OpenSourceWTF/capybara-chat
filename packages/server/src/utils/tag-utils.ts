/**
 * Tag Utilities
 *
 * Shared utilities for tag cloud generation and tag operations.
 */

export interface TagCount {
  tag: string;
  count: number;
}

export interface HasTags {
  tags: string[];
}

/**
 * Generate a tag cloud from a list of items with tags.
 * Returns tags sorted by count (descending).
 */
export function generateTagCloud<T extends HasTags>(items: T[]): TagCount[] {
  const tagCounts: Record<string, number> = {};

  for (const item of items) {
    for (const tag of item.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get unique tags from a list of items.
 */
export function getUniqueTags<T extends HasTags>(items: T[]): string[] {
  const tags = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}
