/**
 * KeyValueEditor - Terminal-styled key-value pair editor
 * 
 * Used for MCP server environment variables and other config maps.
 * Follows "Cozy Terminal" aesthetic: zero radius, monospace, bordered inputs.
 */

import { useState, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface KeyValueEditorProps {
  value: Record<string, string> | undefined;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  className?: string;
}

interface EditableEntry {
  id: string;
  key: string;
  value: string;
}

export function KeyValueEditor({
  value,
  onChange,
  disabled = false,
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
  className,
}: KeyValueEditorProps) {
  // Convert to array for editing (preserves empty keys during editing)
  const [entries, setEntries] = useState<EditableEntry[]>(() => {
    const obj = value || {};
    const arr = Object.entries(obj).map(([k, v], i) => ({
      id: `entry-${i}-${Date.now()}`,
      key: k,
      value: v,
    }));
    return arr.length > 0 ? arr : [];
  });

  const syncToParent = useCallback((newEntries: EditableEntry[]) => {
    const result: Record<string, string> = {};
    for (const entry of newEntries) {
      if (entry.key.trim()) {
        result[entry.key.trim()] = entry.value;
      }
    }
    onChange(result);
  }, [onChange]);

  const handleKeyChange = useCallback((id: string, newKey: string) => {
    const updated = entries.map(e =>
      e.id === id ? { ...e, key: newKey } : e
    );
    setEntries(updated);
    syncToParent(updated);
  }, [entries, syncToParent]);

  const handleValueChange = useCallback((id: string, newValue: string) => {
    const updated = entries.map(e =>
      e.id === id ? { ...e, value: newValue } : e
    );
    setEntries(updated);
    syncToParent(updated);
  }, [entries, syncToParent]);

  const handleAdd = useCallback(() => {
    const newEntry: EditableEntry = {
      id: `entry-${Date.now()}`,
      key: '',
      value: '',
    };
    setEntries([...entries, newEntry]);
  }, [entries]);

  const handleRemove = useCallback((id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    syncToParent(updated);
  }, [entries, syncToParent]);

  return (
    <div className={cn('space-y-1.5', className)}>
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-1.5">
          <input
            type="text"
            value={entry.key}
            onChange={(e) => handleKeyChange(entry.id, e.target.value)}
            placeholder={keyPlaceholder}
            disabled={disabled}
            className="w-[120px] h-7 px-2 bg-transparent border-b border-border font-mono text-xs uppercase tracking-wide placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          />
          <span className="text-muted-foreground/40 font-mono text-xs">=</span>
          <input
            type="text"
            value={entry.value}
            onChange={(e) => handleValueChange(entry.id, e.target.value)}
            placeholder={valuePlaceholder}
            disabled={disabled}
            className="flex-1 h-7 px-2 bg-transparent border-b border-border font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => handleRemove(entry.id)}
              className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAdd}
          className="h-6 text-2xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-2.5 h-2.5" />
          ADD_VAR
        </Button>
      )}

      {entries.length === 0 && disabled && (
        <span className="text-2xs font-mono text-muted-foreground/50 italic">
          No environment variables
        </span>
      )}
    </div>
  );
}
