import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

interface TerminalSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const COMMAND_PREFIXES = [
  'grep',
  'find',
  'cat',
  'ls | grep',
  'awk',
  'sed',
  'locate',
  'ack',
  'ag',
  'rg'
];

export function TerminalSearchBar({
  value,
  onChange,
  placeholder = "search...",
  className,
  autoFocus = false
}: TerminalSearchBarProps) {
  const [prefix, setPrefix] = useState(COMMAND_PREFIXES[0]);

  // Randomize prefix on mount
  useEffect(() => {
    setPrefix(COMMAND_PREFIXES[Math.floor(Math.random() * COMMAND_PREFIXES.length)]);
  }, []);

  return (
    <div className={cn("flex items-center gap-2 flex-1 min-w-0 font-mono text-sm", className)}>
      <span className="text-muted-foreground whitespace-nowrap select-none font-bold">
        {prefix}
      </span>
      <div className="relative flex-1">
        <input
          autoFocus={autoFocus}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-muted/30 border-none h-7 px-2 text-xs font-mono focus:ring-1 focus:ring-primary rounded-none placeholder:text-muted-foreground/50 transition-colors"
          placeholder={placeholder}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-foreground text-muted-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
