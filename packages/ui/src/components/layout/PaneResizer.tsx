/**
 * PaneResizer - Enhanced draggable resize handle for the 3-pane layout
 *
 * Features:
 * - Smooth drag interaction
 * - Visual feedback on hover/drag
 * - Keyboard accessibility
 * - Double-click to reset
 */

import { useCallback, useEffect, useState, useRef } from 'react';

interface PaneResizerProps {
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export function PaneResizer({
  onResize,
  onResizeStart,
  onResizeEnd,
  onDoubleClick,
  direction = 'horizontal',
  className = '',
}: PaneResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastPosRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    lastPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    onResizeStart?.();
  }, [direction, onResizeStart]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDoubleClick?.();
  }, [onDoubleClick]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - lastPosRef.current;
      if (delta !== 0) {
        onResize(delta);
        lastPosRef.current = currentPos;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onResizeEnd?.();
    };

    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, onResize, onResizeEnd]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      tabIndex={0}
      className={`
        pane-resizer
        ${isHorizontal ? 'pane-resizer-horizontal' : 'pane-resizer-vertical'}
        ${isDragging ? 'pane-resizer-active' : ''}
        ${className}
      `}
    >
      {/* Visual grip indicator */}
      <div className="pane-resizer-grip">
        <div className="pane-resizer-grip-line" />
        <div className="pane-resizer-grip-line" />
        <div className="pane-resizer-grip-line" />
      </div>
    </div>
  );
}
