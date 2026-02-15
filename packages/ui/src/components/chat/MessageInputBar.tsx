/**
 * MessageInputBar - Terminal command-prompt style message input
 *
 * Design: Immersive CLI prompt with `>` prefix, integrated activity hints,
 * and polished compose menu. Feels like typing into a real terminal.
 *
 * 168-right-bar-elimination: Replaced "..." context menu with "+" compose button
 * on the left. Send button transforms to Stop when processing.
 *
 * UI Refresh: Redesigned with terminal command-prompt aesthetic:
 * - Prompt prefix `>` with blinking cursor state
 * - Keyboard shortcut hints integrated naturally
 * - Better compose menu with grouped sections
 * - Send/Stop with cleaner visual treatment
 */

import { useState, useRef, useCallback, useMemo, useEffect, KeyboardEvent, ChangeEvent, ReactNode } from 'react';
import { Send, Plus, Square, FileText, MessageSquare, Bot, Zap, CornerDownLeft, Command } from 'lucide-react';
import { EntityAutocomplete } from '../entity/EntityAutocomplete';
import { CommandAutocomplete } from './CommandAutocomplete';
import { useEntitySearch, type EntitySearchResult } from '../../hooks/useEntitySearch';
import {
  parseSlashCommand,
  getCommandSuggestions,
  getCategorizedSuggestions,
  isCommandComplete,
  getEntitySelectionState,
  buildCommandWithEntity,
  type ParsedCommand,
  type CommandSuggestion,
} from '../../lib/slash-command-parser';

/** Context-sensitive action for the "+" compose menu */
export interface InputContextAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface MessageInputBarProps {
  onSend: (message: string) => void;
  onSlashCommand?: (command: ParsedCommand) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Additional context-sensitive actions for the "+" compose menu */
  contextActions?: InputContextAction[];
  /** Handler for new chat creation (opens modal) */
  onNewChat?: () => void;
  /** Handler for new task creation */
  onNewTask?: () => void;
  /** Whether the session is currently processing a response */
  isProcessing?: boolean;
  /** Handler for stopping the current generation */
  onStop?: () => void;
}

export function MessageInputBar({
  onSend,
  onSlashCommand,
  disabled = false,
  placeholder = 'Type your message... (/ for commands)',
  contextActions,
  onNewChat,
  onNewTask,
  isProcessing = false,
  onStop,
}: MessageInputBarProps) {
  const [input, setInput] = useState('');
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [composeMenuOpen, setComposeMenuOpen] = useState(false);
  const composeMenuRef = useRef<HTMLDivElement>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [selectedEntityIndex, setSelectedEntityIndex] = useState(0);
  // Track if user has explicitly navigated suggestions with arrow keys
  const [hasNavigatedSuggestions, setHasNavigatedSuggestions] = useState(false);
  const [hasNavigatedEntities, setHasNavigatedEntities] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get autocomplete suggestions when input starts with /
  const suggestions = useMemo<CommandSuggestion[]>(() => {
    if (!input.startsWith('/')) {
      return [];
    }
    return getCommandSuggestions(input);
  }, [input]);

  // Get categorized suggestions for organized display
  const categorizedSuggestions = useMemo(() => {
    if (!input.startsWith('/')) {
      return [];
    }
    return getCategorizedSuggestions(input);
  }, [input]);

  // Check if we're in entity selection mode
  const entitySelectionState = useMemo(() => {
    return getEntitySelectionState(input);
  }, [input]);

  // Fetch entities when in entity selection mode
  const { results: entityResults, loading: entityLoading, isSearching: entityIsSearching } = useEntitySearch(
    entitySelectionState.entityType,
    entitySelectionState.searchQuery
  );

  // Show command autocomplete when we have suggestions and NOT in entity selection mode
  const shouldShowAutocomplete = autocompleteVisible && input.startsWith('/') && suggestions.length > 0 && !entitySelectionState.active;

  // Show entity autocomplete when in entity selection mode
  const shouldShowEntityAutocomplete = autocompleteVisible && entitySelectionState.active;

  // Auto-resize textarea based on content
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    adjustHeight();

    // Reset selection and navigation state when input changes
    setSelectedSuggestionIndex(0);
    setSelectedEntityIndex(0);
    setHasNavigatedSuggestions(false);
    setHasNavigatedEntities(false);

    // Show/hide autocomplete
    setAutocompleteVisible(value.startsWith('/') && value.length > 0);
  };

  // Handle entity selection from autocomplete
  const handleSelectEntity = useCallback((result: EntitySearchResult) => {
    const command = buildCommandWithEntity(entitySelectionState.commandPrefix, result.id);
    setInput(command);
    setAutocompleteVisible(false);
    textareaRef.current?.focus();
  }, [entitySelectionState.commandPrefix]);

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Check if this is a slash command
    if (trimmedInput.startsWith('/')) {
      const command = parseSlashCommand(trimmedInput);
      if (command && isCommandComplete(command) && onSlashCommand) {
        onSlashCommand(command);
        setInput('');
        setAutocompleteVisible(false);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      }
    }

    // Regular message
    onSend(trimmedInput);
    setInput('');
    setAutocompleteVisible(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSelectSuggestion = useCallback((suggestion: CommandSuggestion) => {
    setInput(suggestion.command);
    setAutocompleteVisible(false);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle entity autocomplete navigation
    if (shouldShowEntityAutocomplete && entityResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHasNavigatedEntities(true);
        setSelectedEntityIndex((prev) =>
          prev < entityResults.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHasNavigatedEntities(true);
        setSelectedEntityIndex((prev) =>
          prev > 0 ? prev - 1 : entityResults.length - 1
        );
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        // Tab always selects current suggestion (explicit completion)
        const clampedIndex = Math.max(0, Math.min(selectedEntityIndex, entityResults.length - 1));
        if (entityResults[clampedIndex]) {
          handleSelectEntity(entityResults[clampedIndex]);
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Enter only selects if user explicitly navigated to a selection
        if (hasNavigatedEntities) {
          const clampedIndex = Math.max(0, Math.min(selectedEntityIndex, entityResults.length - 1));
          if (entityResults[clampedIndex]) {
            handleSelectEntity(entityResults[clampedIndex]);
          }
        }
        // Otherwise Enter does nothing - user should use Tab to complete or keep typing
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteVisible(false);
        return;
      }
      // Continue to regular handling for other keys
    }

    // Handle command autocomplete navigation
    if (shouldShowAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHasNavigatedSuggestions(true);
        setSelectedSuggestionIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHasNavigatedSuggestions(true);
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        // Tab always selects current suggestion (explicit completion)
        if (suggestions[selectedSuggestionIndex]) {
          handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
        }
        return;
      }
      // For Enter: execute if complete, OR if user explicitly navigated to a suggestion
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const currentCommand = parseSlashCommand(input.trim());
        if (currentCommand && isCommandComplete(currentCommand)) {
          // Input is a complete command - execute it
          handleSend();
        } else if (hasNavigatedSuggestions && suggestions[selectedSuggestionIndex]) {
          // User explicitly navigated to a suggestion - select it
          handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
        }
        // Otherwise Enter does nothing - user should use Tab to complete or keep typing
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteVisible(false);
        return;
      }
    }

    // Enter to send, Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Close compose menu on click outside
  useEffect(() => {
    if (!composeMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (composeMenuRef.current && !composeMenuRef.current.contains(e.target as Node)) {
        setComposeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [composeMenuOpen]);

  // Build menu items: built-in actions + context-sensitive extras + entity creation
  // 195-ui-usability-pass: Include onSlashCommand for Create section
  const hasMenuItems = !!(onNewChat || onNewTask || onSlashCommand || (contextActions && contextActions.length > 0));

  const hasInput = input.trim().length > 0;

  return (
    <footer className="flex-shrink-0 relative">
      {/* Command autocomplete dropdown - organized by category */}
      {shouldShowAutocomplete && (
        <CommandAutocomplete
          categorizedSuggestions={categorizedSuggestions}
          selectedIndex={selectedSuggestionIndex}
          onSelectSuggestion={handleSelectSuggestion}
        />
      )}

      {/* Entity autocomplete dropdown */}
      {shouldShowEntityAutocomplete && (
        <EntityAutocomplete
          selectionState={entitySelectionState}
          results={entityResults}
          loading={entityLoading}
          isSearching={entityIsSearching}
          selectedIndex={selectedEntityIndex}
          onSelect={handleSelectEntity}
        />
      )}

      {/* Main input area - terminal prompt style */}
      <div className={`
        border-t-2 transition-colors duration-150
        ${isFocused ? 'border-t-primary' : 'border-t-border'}
        ${isProcessing ? 'border-t-progress' : ''}
        bg-card
      `}>
        <div className="flex items-end gap-0">
          {/* Compose menu button */}
          {hasMenuItems && (
            <div className="relative flex-shrink-0" ref={composeMenuRef}>
              <button
                onClick={() => setComposeMenuOpen(!composeMenuOpen)}
                className={`
                  w-10 h-10 flex items-center justify-center
                  text-muted-foreground transition-all duration-150
                  hover:text-primary hover:bg-primary/5
                  ${composeMenuOpen ? 'text-primary bg-primary/5' : ''}
                `}
                title="New chat, task, or action"
              >
                <Plus className={`w-4 h-4 transition-transform duration-200 ${composeMenuOpen ? 'rotate-45' : ''}`} />
              </button>

              {composeMenuOpen && (
                <div className="absolute left-0 bottom-full mb-0 w-56 bg-card border border-border shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="py-1">
                    {/* Sessions section */}
                    {onNewChat && (
                      <>
                        <div className="px-3 py-1.5 text-2xs text-muted-foreground/40 uppercase tracking-widest border-b border-border/30">
                          Sessions
                        </div>
                        <button
                          onClick={() => { setComposeMenuOpen(false); onNewChat(); }}
                          className="compose-menu-item"
                        >
                          <Plus className="w-3.5 h-3.5 opacity-50" />
                          <span>NEW_CHAT</span>
                        </button>
                      </>
                    )}

                    {/* Tasks section */}
                    {onNewTask && (
                      <>
                        {onNewChat && <div className="border-t border-border/20 my-0.5" />}
                        <div className="px-3 py-1.5 text-2xs text-muted-foreground/40 uppercase tracking-widest border-b border-border/30">
                          Tasks
                        </div>
                        <button
                          onClick={() => { setComposeMenuOpen(false); onNewTask(); }}
                          className="compose-menu-item"
                        >
                          <Zap className="w-3.5 h-3.5 opacity-50" />
                          <span>SPAWN_TASK</span>
                        </button>
                      </>
                    )}

                    {/* Create entities section - 195-ui-usability-pass */}
                    {onSlashCommand && (
                      <>
                        {(onNewChat || onNewTask) && <div className="border-t border-border/20 my-0.5" />}
                        <div className="px-3 py-1.5 text-2xs text-muted-foreground/40 uppercase tracking-widest border-b border-border/30">
                          Create
                        </div>
                        <button
                          onClick={() => { setComposeMenuOpen(false); onSlashCommand({ action: 'new', entityType: 'spec', raw: '/new spec' }); }}
                          className="compose-menu-item"
                        >
                          <FileText className="w-3.5 h-3.5 opacity-50" />
                          <span>NEW_SPEC</span>
                        </button>
                        <button
                          onClick={() => { setComposeMenuOpen(false); onSlashCommand({ action: 'new', entityType: 'prompt', raw: '/new prompt' }); }}
                          className="compose-menu-item"
                        >
                          <MessageSquare className="w-3.5 h-3.5 opacity-50" />
                          <span>NEW_PROMPT</span>
                        </button>
                        <button
                          onClick={() => { setComposeMenuOpen(false); onSlashCommand({ action: 'new', entityType: 'document', raw: '/new document' }); }}
                          className="compose-menu-item"
                        >
                          <FileText className="w-3.5 h-3.5 opacity-50" />
                          <span>NEW_DOCUMENT</span>
                        </button>
                        <button
                          onClick={() => { setComposeMenuOpen(false); onSlashCommand({ action: 'new', entityType: 'agentDefinition', raw: '/new agent' }); }}
                          className="compose-menu-item"
                        >
                          <Bot className="w-3.5 h-3.5 opacity-50" />
                          <span>NEW_AGENT</span>
                        </button>
                      </>
                    )}

                    {/* Context actions section */}
                    {contextActions && contextActions.length > 0 && (
                      <>
                        <div className="border-t border-border/20 my-0.5" />
                        <div className="px-3 py-1.5 text-2xs text-muted-foreground/40 uppercase tracking-widest border-b border-border/30">
                          Context
                        </div>
                        {contextActions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => { setComposeMenuOpen(false); action.onClick(); }}
                            className="compose-menu-item"
                          >
                            {action.icon && <span className="w-3.5 h-3.5 flex items-center justify-center opacity-50">{action.icon}</span>}
                            <span>{action.label}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Terminal prompt prefix */}
          <div className="flex-shrink-0 flex items-end pb-2.5 pl-1 select-none">
            <span className={`
              text-sm font-bold transition-colors duration-150
              ${isProcessing ? 'text-progress animate-pulse' : isFocused ? 'text-primary' : 'text-muted-foreground/40'}
            `}>
              {isProcessing ? '...' : '>'}
            </span>
          </div>

          {/* Textarea */}
          <textarea
            id="chat-input"
            ref={textareaRef}
            tabIndex={0}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setIsFocused(false);
              // Delay hiding to allow click on suggestion
              setTimeout(() => setAutocompleteVisible(false), 200);
            }}
            onFocus={() => {
              setIsFocused(true);
              if (input.startsWith('/') && (suggestions.length > 0 || entitySelectionState.active)) {
                setAutocompleteVisible(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="message-textarea flex-1 min-h-[40px] max-h-[200px] py-2.5 px-2
              bg-transparent border-0 text-sm text-foreground font-mono
              placeholder:text-muted-foreground/30 resize-none overflow-y-auto
              focus:outline-none focus:ring-0
              disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="message-input"
          />

          {/* Send / Stop button area */}
          <div className="flex-shrink-0 flex items-end pb-1.5 pr-2 gap-1">
            {isProcessing && onStop ? (
              <button
                onClick={onStop}
                className="chat-action-btn chat-action-btn-stop"
                title="Stop generation (Esc)"
              >
                <Square className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">STOP</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!hasInput || disabled}
                className={`chat-action-btn ${hasInput ? 'chat-action-btn-send' : 'chat-action-btn-disabled'}`}
                title="Send message"
              >
                <Send className="w-3 h-3" />
                <span className="hidden sm:inline">SEND</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom hint bar */}
        <div className="flex items-center justify-between px-3 pb-1.5 -mt-1">
          <div className="flex items-center gap-3 text-2xs text-muted-foreground/30">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-2.5 h-2.5" />
              send
            </span>
            <span className="flex items-center gap-1">
              <Command className="w-2.5 h-2.5" />
              <CornerDownLeft className="w-2.5 h-2.5" />
              newline
            </span>
            <span>/commands</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
