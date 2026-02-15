/**
 * PromptPicker - Pick a prompt from the Prompt Library
 *
 * States:
 * - No segment selected: Shows SearchableSelect placeholder
 * - Segment selected: Shows linked prompt with EDIT button to customize
 *
 * The EDIT action copies segment content into systemPrompt and clears the link,
 * enabling the user to edit the content locally.
 */

import { useState, useCallback, useEffect } from 'react';
import { BookOpen, Link2, Edit3 } from 'lucide-react';
import type { PromptSegment } from '@capybara-chat/types';
import { API_PATHS } from '@capybara-chat/types';
import { Button } from './Button';
import { SearchableSelect } from './SearchableSelect';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

export interface PromptPickerProps {
  /** Currently linked segment ID (null = no link) */
  segmentId: string | null;
  /** Called when segment link changes */
  onChange: (segmentId: string | null) => void;
  /** Called when segment content should be loaded into the system prompt */
  onLoadContent: (content: string) => void;
  /** Server URL */
  serverUrl?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

export function PromptPicker({
  segmentId,
  onChange,
  onLoadContent,
  serverUrl = '',
  disabled = false,
}: PromptPickerProps) {
  const [linkedSegment, setLinkedSegment] = useState<PromptSegment | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch linked segment info when segmentId changes
  useEffect(() => {
    if (!segmentId) {
      setLinkedSegment(null);
      return;
    }

    setLoading(true);
    api.get(`${serverUrl}${API_PATHS.PROMPTS}/${segmentId}`)
      .then(async (res) => {
        if (res.ok) {
          setLinkedSegment(await res.json());
        } else {
          setLinkedSegment(null);
        }
      })
      .catch(() => setLinkedSegment(null))
      .finally(() => setLoading(false));
  }, [segmentId, serverUrl]);

  // Fetch prompts for the search dropdown
  const fetchPrompts = useCallback(async (query: string): Promise<PromptSegment[]> => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      const url = `${serverUrl}${API_PATHS.PROMPTS}?${params}`;
      const res = await api.get(url);
      if (!res.ok) return [];
      const data = await res.json();
      const items: PromptSegment[] = Array.isArray(data) ? data : (data.segments || data.data || data.prompts || []);
      // Client-side filter for published only
      return items.filter(p => p.status === 'published');
    } catch {
      return [];
    }
  }, [serverUrl]);

  const handleSelect = useCallback((_id: string | null, segment: PromptSegment | null) => {
    if (segment) {
      onChange(segment.id);
      setLinkedSegment(segment);
      // Load content as preview (segment is live reference)
      onLoadContent(segment.content);
    }
  }, [onChange, onLoadContent]);

  const handleCustomize = useCallback(() => {
    if (linkedSegment) {
      // Copy content to systemPrompt, then clear the link
      onLoadContent(linkedSegment.content);
      onChange(null);
    }
  }, [linkedSegment, onChange, onLoadContent]);

  // Linked state: show linked prompt info with single EDIT button
  if (segmentId && (linkedSegment || loading)) {
    return (
      <div className="space-y-1.5">
        <h4 className="text-terminal-header flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" />
          PROMPT SOURCE
        </h4>

        <div className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-none border bg-card/50 font-mono text-xs',
          'border-success/40',
        )}>
          <Link2 className="w-3 h-3 text-success shrink-0" />
          <span className="flex-1 min-w-0 truncate">
            [{loading ? 'loading...' : linkedSegment?.name || segmentId}]
          </span>
          <span className="text-2xs text-muted-foreground/60">
            SYNCED
          </span>

          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCustomize}
              title="Unlock: copy content for local editing (detaches from library)"
              className="h-5 px-1.5 text-2xs gap-0.5 rounded-none font-mono ml-1"
            >
              <Edit3 className="w-2.5 h-2.5" />
              UNLOCK
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Unlinked state: show picker
  return (
    <div className="space-y-2">
      <h4 className="text-terminal-header flex items-center gap-1.5">
        <BookOpen className="w-3 h-3" />
        PROMPT SOURCE
      </h4>

      <SearchableSelect<PromptSegment>
        fetchOptions={fetchPrompts}
        renderOption={(segment) => (
          <div>
            <div className="font-medium text-sm">{segment.name}</div>
            {segment.summary && (
              <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
                {segment.summary}
              </div>
            )}
          </div>
        )}
        getLabel={(segment) => segment.name}
        getValue={(segment) => segment.id}
        value={null}
        onChange={handleSelect}
        placeholder="Link from Prompt Library..."
        emptyMessage="No published prompts found"
        disabled={disabled}
      />
      <p className="text-2xs text-muted-foreground/40 font-mono">
        Linked prompts stay in sync with library changes. Or write inline below.
      </p>
    </div>
  );
}
