/**
 * TechniqueSelector Component
 *
 * Dropdown to select an execution technique (ralph, raw, etc.)
 */

import { useState, useEffect } from 'react';
import { useTechniques } from '../../hooks/useTechniques';
import type { Technique } from '@capybara-chat/types';

interface TechniqueSelectorProps {
  value?: string;
  onChange: (technique: Technique | null) => void;
  label?: string;
  disabled?: boolean;
  showSystemOnly?: boolean;
}

export function TechniqueSelector({
  value,
  onChange,
  label = 'Technique',
  disabled = false,
  showSystemOnly = true,
}: TechniqueSelectorProps) {
  const { techniques, isLoading, error } = useTechniques();
  const [selectedId, setSelectedId] = useState<string | undefined>(value);

  // Filter to system techniques if requested
  const displayTechniques = showSystemOnly
    ? techniques.filter(t => t.isSystem)
    : techniques;

  useEffect(() => {
    setSelectedId(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedId(id || undefined);

    if (!id) {
      onChange(null);
    } else {
      const technique = techniques.find(t => t.id === id);
      onChange(technique || null);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <p className="text-sm text-destructive">Failed to load techniques</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="technique-select" className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id="technique-select"
        value={selectedId || ''}
        onChange={handleChange}
        disabled={disabled || isLoading}
        className="px-3 py-2 border border-border rounded bg-card text-foreground text-sm cursor-pointer transition-colors hover:border-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <option value="">
          {isLoading ? 'Loading...' : 'Select a technique'}
        </option>
        {displayTechniques.map((technique) => (
          <option key={technique.id} value={technique.id}>
            {technique.name} — {technique.description}
          </option>
        ))}
      </select>
      {selectedId && (
        <div className="text-xs text-muted-foreground">
          {displayTechniques.find(t => t.id === selectedId)?.phases?.length || 0} phases
        </div>
      )}
    </div>
  );
}

export default TechniqueSelector;
