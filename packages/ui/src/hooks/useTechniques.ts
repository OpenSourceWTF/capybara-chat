/**
 * useTechniques Hook
 *
 * Fetches and caches available techniques from the server.
 */

import { useState, useEffect } from 'react';
import type { Technique } from '@capybara-chat/types';
import { api, assertOk, parseJson } from '../lib/api';

interface UseTechniquesResult {
  techniques: Technique[];
  systemTechniques: Technique[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  getBySlug: (slug: string) => Technique | undefined;
}

export function useTechniques(): UseTechniquesResult {
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTechniques = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/techniques');
      await assertOk(response, 'fetch techniques');
      const data = await parseJson<{ techniques: Technique[] }>(response);
      setTechniques(data.techniques || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTechniques();
  }, []);

  const systemTechniques = techniques.filter(t => t.isSystem);

  const getBySlug = (slug: string) => techniques.find(t => t.slug === slug);

  return {
    techniques,
    systemTechniques,
    isLoading,
    error,
    refetch: fetchTechniques,
    getBySlug,
  };
}
