/**
 * useCollapsiblePane - Unified hook for collapsible/pinnable sidebars
 *
 * Provides consistent behavior for collapsible panes:
 * - Collapsed by default
 * - Click to toggle open/closed (persists to localStorage)
 * - 141: Optional hover-to-expand behavior (disabled by default)
 */

import { useState, useEffect, useCallback } from 'react';

interface UseCollapsiblePaneOptions {
  /** localStorage key for persisting pinned state */
  storageKey: string;
  /** Default collapsed state when unpinned */
  defaultCollapsed?: boolean;
  /** Enable hover-to-expand behavior (default: false, requires click) */
  hoverEnabled?: boolean;
}

interface UseCollapsiblePaneReturn {
  /** Whether the pane is effectively collapsed (should show collapsed UI) */
  isCollapsed: boolean;
  /** Whether the pane is pinned open by the user */
  isPinned: boolean;
  /** Toggle pinned state (for click/touch) */
  togglePin: () => void;
  /** Mouse enter handler - only active when hoverEnabled is true */
  onMouseEnter: () => void;
  /** Mouse leave handler - only active when hoverEnabled is true */
  onMouseLeave: () => void;
  /** Props to spread on the collapsible container */
  containerProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

export function useCollapsiblePane({
  storageKey,
  defaultCollapsed = true,
  hoverEnabled = false,
}: UseCollapsiblePaneOptions): UseCollapsiblePaneReturn {
  // Load pinned state from localStorage
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  // Hover state - only used when hoverEnabled is true
  const [isHovered, setIsHovered] = useState(false);

  // Persist pinned state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(isPinned));
    } catch {
      // localStorage unavailable
    }
  }, [isPinned, storageKey]);

  // Toggle pinned state
  const togglePin = useCallback(() => {
    setIsPinned(prev => !prev);
  }, []);

  // Hover handlers - only active when hoverEnabled is true
  const onMouseEnter = useCallback(() => {
    if (hoverEnabled) {
      setIsHovered(true);
    }
  }, [hoverEnabled]);

  const onMouseLeave = useCallback(() => {
    if (hoverEnabled) {
      setIsHovered(false);
    }
  }, [hoverEnabled]);

  // Collapsed = not pinned AND not hovered (when hover is enabled)
  const isCollapsed = defaultCollapsed && !isPinned && !(hoverEnabled && isHovered);

  return {
    isCollapsed,
    isPinned,
    togglePin,
    onMouseEnter,
    onMouseLeave,
    containerProps: {
      onMouseEnter,
      onMouseLeave,
    },
  };
}
