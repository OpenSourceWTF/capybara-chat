/**
 * TagList - Reusable component for displaying a list of tags
 * 
 * Features:
 * - Truncation with overflow indicator (+N more)
 * - Configurable max visible tags
 * - Consistent styling across the app
 */

import { Badge } from './Badge';

interface TagListProps {
  tags: string[];
  maxVisible?: number;
  size?: 'sm' | 'md';
  variant?: 'solid' | 'soft' | 'outline' | 'ghost';
  className?: string;
  onTagClick?: (tag: string) => void;
}

export function TagList({
  tags,
  maxVisible = 3,
  size = 'sm',
  variant = 'soft',
  className = '',
  onTagClick,
}: TagListProps) {
  if (!tags || tags.length === 0) {
    return null;
  }

  const visibleTags = maxVisible > 0 ? tags.slice(0, maxVisible) : tags;
  const hiddenCount = tags.length - visibleTags.length;

  return (
    <div className={`flex flex-wrap gap-1 font-mono ${className}`}>
      {visibleTags.map((tag) => (
        <Badge
          key={tag}
          variant={variant}
          className={`${size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5'} ${onTagClick ? 'cursor-pointer hover:bg-primary/20' : ''
            }`}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
        >
          {tag}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Badge
          variant="outline"
          className={`${size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5'} text-muted-foreground`}
        >
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}
