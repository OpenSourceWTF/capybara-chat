/**
 * Library utilities - shared filter and utility functions for library components
 *
 * Consolidates common patterns from PromptsLibrary, DocumentsLibrary,
 * and AgentDefinitionsLibrary.
 */

import type { FilterOption } from '../components/library';

/**
 * Base interface for items with optional tags
 */
interface TaggableItem {
  tags?: string[];
}

/**
 * Creates filter options from tags across a collection of items.
 * Returns tags sorted by count (most common first).
 *
 * @example
 * const options = createTagFilterOptions(prompts);
 * // [{ value: 'api', label: 'api', count: 5 }, ...]
 */
export function createTagFilterOptions<T extends TaggableItem>(
  items: T[]
): FilterOption[] {
  const tagCounts = new Map<string, number>();
  items.forEach(item => {
    item.tags?.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ value: tag, label: tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Checks if an item matches a text query across specified fields.
 *
 * @example
 * const matches = matchesTextQuery(prompt, 'api', ['title', 'content']);
 */
export function matchesTextQuery<T>(
  item: T,
  query: string,
  searchFields: (keyof T)[]
): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  return searchFields.some(field => {
    const value = item[field];
    return typeof value === 'string' && value.toLowerCase().includes(lowerQuery);
  });
}

/**
 * Checks if an item matches all active tag filters (AND logic).
 *
 * @example
 * const matches = matchesTagFilters(prompt, new Set(['api', 'v2']));
 */
export function matchesTagFilters<T extends TaggableItem>(
  item: T,
  activeFilters: Set<string>
): boolean {
  if (activeFilters.size === 0) return true;
  return Array.from(activeFilters).every(tag => item.tags?.includes(tag));
}

/**
 * Creates a combined filter function for library components.
 * Combines text search across specified fields with AND-based tag filtering.
 *
 * @example
 * const filterFn = createLibraryFilter(['title', 'content']);
 * // Use with TerminalLibraryLayout filterFn prop
 */
export function createLibraryFilter<T extends TaggableItem>(
  searchFields: (keyof T)[]
): (item: T, query: string, activeFilters: Set<string>) => boolean {
  return (item: T, query: string, activeFilters: Set<string>): boolean => {
    return (
      matchesTextQuery(item, query, searchFields) &&
      matchesTagFilters(item, activeFilters)
    );
  };
}
