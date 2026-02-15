/**
 * useEntitySearch - Hook for searching entities by name or ID
 *
 * Provides debounced search functionality for entity autocomplete.
 * Fetches entities and filters client-side by ID or name.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFetch } from './useFetch';
import { API_PATHS, type FormEntityType } from '@capybara-chat/types';

/**
 * Common shape for searchable entities
 */
export interface SearchableEntity {
  id: string;
  name?: string;
  title?: string;
}

/**
 * Search result with display info
 */
export interface EntitySearchResult {
  id: string;
  displayName: string;
  entityType: FormEntityType;
}

/**
 * Options for useEntitySearch
 */
export interface UseEntitySearchOptions {
  /** Debounce delay in ms (default: 200) */
  debounceMs?: number;
  /** Max results to return (default: 10) */
  maxResults?: number;
}

/**
 * API path for each entity type
 */
const ENTITY_API_PATHS: Record<FormEntityType, string> = {
  prompt: API_PATHS.PROMPTS,
  pipeline: API_PATHS.PIPELINES,
  spec: API_PATHS.SPECS,
  document: API_PATHS.DOCUMENTS,
  agentDefinition: API_PATHS.AGENT_DEFINITIONS,
};

/**
 * Response key for each entity type's list endpoint
 */
const ENTITY_RESPONSE_KEYS: Record<FormEntityType, string> = {
  prompt: 'segments',
  pipeline: 'pipelines',
  spec: 'specs',
  document: 'documents',
  agentDefinition: 'agentDefinitions',
};

/**
 * Hook for searching entities by name or ID
 */
export function useEntitySearch(
  entityType: FormEntityType | null,
  searchQuery: string,
  options: UseEntitySearchOptions = {}
) {
  const { debounceMs = 200, maxResults = 10 } = options;

  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce the search query
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, debounceMs]);

  // Fetch entities when we have a type
  const apiPath = entityType ? ENTITY_API_PATHS[entityType] : '';
  const responseKey = entityType ? ENTITY_RESPONSE_KEYS[entityType] : '';

  const { data, loading, error } = useFetch<Record<string, SearchableEntity[]>>(
    apiPath,
    { skip: !entityType }
  );

  // Get entities from response
  const entities = useMemo(() => {
    if (!data || !responseKey) return [];
    return data[responseKey] ?? [];
  }, [data, responseKey]);

  // Filter entities by search query (or show all if no query)
  const results = useMemo((): EntitySearchResult[] => {
    if (!entityType) {
      return [];
    }

    const query = debouncedQuery.toLowerCase().trim();

    // If no query, show all entities (up to maxResults)
    if (!query) {
      return entities
        .slice(0, maxResults)
        .map((entity) => ({
          id: entity.id,
          displayName: entity.name || entity.title || entity.id,
          entityType,
        }));
    }

    // Filter by query
    return entities
      .filter((entity) => {
        const id = entity.id.toLowerCase();
        const name = (entity.name || entity.title || '').toLowerCase();
        return id.includes(query) || name.includes(query);
      })
      .slice(0, maxResults)
      .map((entity) => ({
        id: entity.id,
        displayName: entity.name || entity.title || entity.id,
        entityType,
      }));
  }, [entities, debouncedQuery, entityType, maxResults]);

  // Clear results immediately when query is cleared
  const clearSearch = useCallback(() => {
    setDebouncedQuery('');
  }, []);

  return {
    results,
    loading: loading && !!entityType,
    error,
    clearSearch,
    isSearching: searchQuery !== debouncedQuery,
  };
}
