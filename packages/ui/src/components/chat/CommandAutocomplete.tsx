/**
 * CommandAutocomplete - Dropdown for slash command suggestions
 *
 * Extracted from MessageInputBar for better separation of concerns.
 * Displays categorized command suggestions with keyboard navigation.
 */

import type { CommandCategory, CommandSuggestion } from '../../lib/slash-command-parser';

export interface CommandAutocompleteProps {
  categorizedSuggestions: CommandCategory[];
  selectedIndex: number;
  onSelectSuggestion: (suggestion: CommandSuggestion) => void;
}

export function CommandAutocomplete({
  categorizedSuggestions,
  selectedIndex,
  onSelectSuggestion,
}: CommandAutocompleteProps) {
  return (
    <div
      className="absolute bottom-full left-2 right-2 mb-1 bg-card border border-border shadow-lg overflow-hidden z-50"
      style={{ backgroundColor: 'var(--card)', backdropFilter: 'none' }}
      data-testid="slash-command-autocomplete"
    >
      <div className="max-h-64 overflow-y-auto">
        {categorizedSuggestions.map((category, catIndex) => {
          // Calculate the starting index for this category's commands in the flat list
          const startIndex = categorizedSuggestions
            .slice(0, catIndex)
            .reduce((acc, cat) => acc + cat.commands.length, 0);

          return (
            <div key={category.id}>
              {/* Category header */}
              <div className="sticky top-0 px-3 py-1.5 bg-muted/80 backdrop-blur-sm border-b border-border/50">
                <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span>{category.icon}</span>
                  {category.label}
                </span>
              </div>
              {/* Commands in this category */}
              {category.commands.map((suggestion, cmdIndex) => {
                const globalIndex = startIndex + cmdIndex;
                return (
                  <button
                    key={suggestion.command}
                    onClick={() => onSelectSuggestion(suggestion)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors ${
                      globalIndex === selectedIndex ? 'bg-muted' : ''
                    }`}
                    data-testid={`suggestion-${globalIndex}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-primary">
                        {suggestion.command}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 pl-0">
                      {suggestion.description}
                    </p>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
