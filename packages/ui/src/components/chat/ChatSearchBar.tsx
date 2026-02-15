/**
 * ChatSearchBar - In-chat search with match highlighting and navigation
 * 
 * Features:
 * - Ctrl+F to open search
 * - Highlighted matches in messages
 * - Previous/Next navigation
 * - Match counter
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ChevronUp, ChevronDown, X, Search } from 'lucide-react';

export interface SearchMatch {
  messageId: string;
  messageIndex: number;
  matchStart: number;
  matchEnd: number;
  matchText: string;
}

interface ChatSearchBarProps {
  /** All message content to search through */
  messages: Array<{ id: string; content: string }>;
  /** Callback when active match changes - includes query for highlighting */
  onMatchChange?: (activeMatch: SearchMatch | null, allMatches: SearchMatch[], query: string) => void;
  /** Callback when search closes */
  onClose?: () => void;
  /** Whether search is open */
  isOpen: boolean;
  /** Callback to open/close search */
  onOpenChange: (open: boolean) => void;
  /** Container ref - Ctrl+F only activates when focus is within this container */
  containerRef?: React.RefObject<HTMLElement>;
}

/**
 * Find all matches of a search query in messages
 */
function findMatches(
  messages: Array<{ id: string; content: string }>,
  query: string
): SearchMatch[] {
  if (!query || query.length < 2) return [];

  const matches: SearchMatch[] = [];
  const lowerQuery = query.toLowerCase();

  messages.forEach((msg, messageIndex) => {
    const lowerContent = msg.content.toLowerCase();
    let searchIndex = 0;

    while (true) {
      const matchStart = lowerContent.indexOf(lowerQuery, searchIndex);
      if (matchStart === -1) break;

      matches.push({
        messageId: msg.id,
        messageIndex,
        matchStart,
        matchEnd: matchStart + query.length,
        matchText: msg.content.slice(matchStart, matchStart + query.length),
      });

      searchIndex = matchStart + 1;
    }
  });

  return matches;
}

export function ChatSearchBar({
  messages,
  onMatchChange,
  onClose,
  isOpen,
  onOpenChange,
  containerRef,
}: ChatSearchBarProps) {
  const [query, setQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute matches when query or messages change
  const matches = useMemo(() => findMatches(messages, query), [messages, query]);

  // Reset active index when matches change
  useEffect(() => {
    if (matches.length > 0 && activeMatchIndex >= matches.length) {
      setActiveMatchIndex(0);
    }
  }, [matches, activeMatchIndex]);

  // Notify parent of match changes (includes query for highlighting)
  useEffect(() => {
    const activeMatch = matches.length > 0 ? matches[activeMatchIndex] : null;
    onMatchChange?.(activeMatch, matches, query);
  }, [matches, activeMatchIndex, onMatchChange, query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  // Close handler - defined before keyboard effect that uses it
  const handleClose = useCallback(() => {
    setQuery('');
    setActiveMatchIndex(0);
    onOpenChange(false);
    onClose?.();
  }, [onOpenChange, onClose]);

  // Keyboard shortcut to open search (Ctrl+F)
  // Only activates when focus is within container (or no specific input focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F to open search - only if focus is within container
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const activeElement = document.activeElement;

        // If containerRef provided, only trigger when focus is within it
        // (or when focus is on body/document - no specific element focused)
        if (containerRef?.current) {
          const isWithinContainer = containerRef.current.contains(activeElement);
          const isBodyFocused = activeElement === document.body || activeElement === document.documentElement;

          if (!isWithinContainer && !isBodyFocused) {
            // Focus is in another part of the app - don't intercept Ctrl+F
            return;
          }
        }

        e.preventDefault();
        onOpenChange(true);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange, handleClose, containerRef]);

  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const goToPrevious = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
      } else if (e.key === 'Escape') {
        handleClose();
      }
    },
    [goToNext, goToPrevious, handleClose]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
      {/* Search icon */}
      <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />

      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search in chat..."
        className="flex-1 bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted-foreground font-mono"
      />

      {/* Match counter */}
      {query.length >= 2 && (
        <span className="text-2xs text-muted-foreground tabular-nums flex-shrink-0 font-mono">
          {matches.length === 0
            ? 'No matches'
            : `${activeMatchIndex + 1} of ${matches.length}`}
        </span>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={goToPrevious}
          disabled={matches.length === 0}
          className="p-1 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={goToNext}
          disabled={matches.length === 0}
          className="p-1 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next match (Enter)"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={handleClose}
        className="p-1 hover:bg-accent"
        title="Close (Escape)"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Highlight text with search matches
 * 
 * Use this to wrap message content for highlighting.
 */
export function highlightText(
  text: string,
  query: string,
  isActiveMessage: boolean = false
): React.ReactNode {
  if (!query || query.length < 2) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  while (true) {
    const matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
    if (matchIndex === -1) break;

    // Add text before match
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    // Add highlighted match
    const matchEnd = matchIndex + query.length;
    parts.push(
      <mark
        key={matchIndex}
        className={`px-0.5 ${isActiveMessage
          ? 'bg-yellow-400 text-black'
          : 'bg-yellow-200/60 dark:bg-yellow-600/40'
          }`}
      >
        {text.slice(matchIndex, matchEnd)}
      </mark>
    );

    lastIndex = matchEnd;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}
