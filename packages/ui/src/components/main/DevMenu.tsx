/**
 * DevMenu - Development-only reset actions
 *
 * Provides destructive reset buttons for testing:
 * - Reset prompts to seed data
 * - Reset agent definitions to seed data
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Wrench, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

interface ResetAction {
  label: string;
  endpoint: string;
  description: string;
}

const RESET_ACTIONS: ResetAction[] = [
  {
    label: 'Reset System',
    endpoint: '/api/dev/reset-system',
    description: 'Delete all prompts and agents, reseed from source',
  },
];

export function DevMenu({ serverUrl = '' }: { serverUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleReset = useCallback(async (action: ResetAction) => {
    setLoading(action.endpoint);
    setResult(null);
    try {
      const res = await api.post(`${serverUrl}${action.endpoint}`);
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message || (res.ok ? 'Done' : 'Failed') });
    } catch (err) {
      setResult({ ok: false, message: String(err) });
    } finally {
      setLoading(null);
    }
  }, [serverUrl]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setOpen(!open); setResult(null); }}
        className="theme-toggle"
        aria-label="Dev menu"
        title="Dev Tools"
      >
        <Wrench className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border/60 shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-warning" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dev Tools</span>
          </div>

          <div className="p-1.5 space-y-0.5">
            {RESET_ACTIONS.map((action) => (
              <button
                key={action.endpoint}
                onClick={() => handleReset(action)}
                disabled={loading !== null}
                className={cn(
                  'w-full flex items-start gap-2.5 px-2.5 py-2 text-left transition-colors',
                  'hover:bg-destructive/5 hover:text-destructive',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <RotateCcw className={cn(
                  'w-3.5 h-3.5 mt-0.5 shrink-0',
                  loading === action.endpoint && 'animate-spin',
                )} />
                <div className="min-w-0">
                  <div className="text-xs font-medium">{action.label}</div>
                  <div className="text-2xs text-muted-foreground/60 mt-0.5">{action.description}</div>
                </div>
              </button>
            ))}
          </div>

          {result && (
            <div className={cn(
              'px-3 py-2 border-t border-border/40 text-xs',
              result.ok ? 'text-success' : 'text-destructive',
            )}>
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
