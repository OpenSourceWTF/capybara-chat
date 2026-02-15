/**
 * TerminalTag - Bracketed [tag] component for terminal aesthetic
 * 
 * Usage:
 *   <TerminalTag>api</TerminalTag>          → [api]
 *   <TerminalTag active>filter</TerminalTag> → [filter] (highlighted)
 *   <TerminalTag count={5}>prompts</TerminalTag> → [prompts] 5
 */

import { cn } from '../../lib/utils';
import { Badge } from './Badge';

interface TerminalTagProps {
  children: React.ReactNode;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  className?: string;
}

export function TerminalTag({
  children,
  active = false,
  count,
  onClick,
  className,
}: TerminalTagProps) {
  return (
    <div
      onClick={onClick}
      className={cn("inline-flex items-center gap-1 cursor-pointer group", className)}
    >
      <Badge
        variant={active ? 'solid' : 'outline'}
        intent={active ? 'primary' : 'neutral'}
        className={cn(
          "hover:bg-primary/20 hover:text-primary transition-all",
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground border-dashed"
        )}
      >
        {children}
      </Badge>
      {count !== undefined && (
        <span className="text-2xs text-muted-foreground font-mono">{count}</span>
      )}
    </div>
  );
}
