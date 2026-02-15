/**
 * SplitPane - Resizable split pane layout component
 *
 * Supports horizontal split with a draggable divider.
 * Remembers pane size in localStorage.
 */

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface SplitPaneProps {
  /** Left pane content */
  left: ReactNode;
  /** Right pane content */
  right: ReactNode;
  /** Storage key for persisting pane size */
  storageKey?: string;
  /** Default right pane width in pixels */
  defaultRightWidth?: number;
  /** Minimum right pane width in pixels */
  minRightWidth?: number;
  /** Maximum right pane width in pixels */
  maxRightWidth?: number;
  /** Whether the right pane is visible */
  rightVisible?: boolean;
  /** Callback when right pane visibility changes */
  onRightVisibilityChange?: (visible: boolean) => void;
}

const DEFAULT_RIGHT_WIDTH = 400;
const MIN_RIGHT_WIDTH = 300;
const MAX_RIGHT_WIDTH = 800;
const COLLAPSE_THRESHOLD = 200;

export function SplitPane({
  left,
  right,
  storageKey = 'split-pane-width',
  defaultRightWidth = DEFAULT_RIGHT_WIDTH,
  minRightWidth = MIN_RIGHT_WIDTH,
  maxRightWidth = MAX_RIGHT_WIDTH,
  rightVisible = true,
  onRightVisibilityChange,
}: SplitPaneProps) {
  // Load initial width from localStorage
  const getInitialWidth = () => {
    if (typeof window === 'undefined') return defaultRightWidth;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= minRightWidth && parsed <= maxRightWidth) {
        return parsed;
      }
    }
    return defaultRightWidth;
  };

  const [rightWidth, setRightWidth] = useState(getInitialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (rightVisible) {
      localStorage.setItem(storageKey, String(rightWidth));
    }
  }, [rightWidth, rightVisible, storageKey]);

  // Handle mouse down on divider
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = rightWidth;
  }, [rightWidth]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.max(
        minRightWidth,
        Math.min(maxRightWidth, startWidthRef.current + deltaX)
      );

      // Check for collapse threshold
      if (newWidth < COLLAPSE_THRESHOLD && onRightVisibilityChange) {
        onRightVisibilityChange(false);
        setIsDragging(false);
        return;
      }

      setRightWidth(newWidth);
    },
    [isDragging, minRightWidth, maxRightWidth, onRightVisibilityChange]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* Left pane - takes remaining space */}
      <div className="flex-1 min-w-0 overflow-hidden">{left}</div>

      {/* Right pane with divider */}
      {rightVisible && (
        <>
          {/* Divider */}
          <div
            className={`
              flex-shrink-0 w-1 cursor-col-resize
              bg-border hover:bg-primary/50
              transition-colors duration-150
              ${isDragging ? 'bg-primary' : ''}
            `}
            onMouseDown={handleMouseDown}
          >
            {/* Visual grip indicator */}
            <div className="h-full w-full flex items-center justify-center">
              <div className="w-0.5 h-8 bg-muted-foreground/30" />
            </div>
          </div>

          {/* Right pane */}
          <div
            className="flex-shrink-0 overflow-hidden border-l border-border"
            style={{ width: rightWidth }}
          >
            {right}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Hook to manage split pane state
 */
export function useSplitPane(storageKey: string = 'split-pane-visible') {
  const [rightVisible, setRightVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(storageKey);
    return stored === 'true';
  });

  const toggleRight = useCallback(() => {
    setRightVisible((prev) => {
      const newValue = !prev;
      localStorage.setItem(storageKey, String(newValue));
      return newValue;
    });
  }, [storageKey]);

  const showRight = useCallback(() => {
    setRightVisible(true);
    localStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const hideRight = useCallback(() => {
    setRightVisible(false);
    localStorage.setItem(storageKey, 'false');
  }, [storageKey]);

  return {
    rightVisible,
    setRightVisible,
    toggleRight,
    showRight,
    hideRight,
  };
}
