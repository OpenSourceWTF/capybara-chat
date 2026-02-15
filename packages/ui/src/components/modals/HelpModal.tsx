/**
 * HelpModal - Command Center Reference
 *
 * A visually striking help overlay that showcases available slash commands.
 * Design: Terminal-inspired with glowing accents and staggered animations.
 */

import { Terminal, Sparkles, FileText, BookOpen, HelpCircle } from 'lucide-react';
import { ALL_SUGGESTIONS } from '../../lib/slash-command-parser';
import type { CommandSuggestion } from '../../lib/slash-command-parser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../ui/Dialog';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

// Group commands by action type
const groupedCommands = {
  create: ALL_SUGGESTIONS.filter(s => s.action === 'new'),
  edit: ALL_SUGGESTIONS.filter(s => s.action === 'edit'),
  utility: ALL_SUGGESTIONS.filter(s => s.action === 'help'),
};

// Icon mapping for entity types
const getEntityIcon = (suggestion: CommandSuggestion) => {
  if (suggestion.action === 'help') return HelpCircle;
  switch (suggestion.entityType) {
    case 'prompt': return Sparkles;
    case 'spec': return FileText;
    case 'document': return BookOpen;
    case 'pipeline': return Terminal;
    default: return Terminal;
  }
};

export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader onClose={onClose}>
          <DialogTitle className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 text-primary border border-primary/20">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider">Command Center</h2>
              <p className="text-sm text-muted-foreground font-mono">Slash commands to supercharge your workflow</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6 max-h-[60vh]">
          {/* Create Commands */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 font-mono">
              <span className="text-primary">+</span>
              Create
            </h3>
            <div className="grid gap-2">
              {groupedCommands.create.map((cmd, idx) => (
                <CommandCard key={cmd.command} suggestion={cmd} delay={idx * 50} />
              ))}
            </div>
          </section>

          {/* Edit Commands */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 font-mono">
              <span className="text-primary">✎</span>
              Edit
            </h3>
            <div className="grid gap-2">
              {groupedCommands.edit.map((cmd, idx) => (
                <CommandCard key={cmd.command} suggestion={cmd} delay={(idx + 4) * 50} />
              ))}
            </div>
          </section>

          {/* Utilities */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 font-mono">
              <span className="text-primary">◈</span>
              Utility
            </h3>
            <div className="grid gap-2">
              {groupedCommands.utility.map((cmd, idx) => (
                <CommandCard key={cmd.command} suggestion={cmd} delay={(idx + 8) * 50} />
              ))}
            </div>
          </section>
        </DialogBody>

        <DialogFooter className="justify-center bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <kbd className="px-2 py-1 bg-muted border border-border rounded-none text-xs font-bold">Esc</kbd>
            <span>to close</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono ml-6">
            <kbd className="px-2 py-1 bg-muted border border-border rounded-none text-xs font-bold">/</kbd>
            <span>to start</span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Individual command card component
function CommandCard({ suggestion, delay }: { suggestion: CommandSuggestion; delay: number }) {
  const Icon = getEntityIcon(suggestion);

  return (
    <div
      className="flex items-center gap-3 p-3 bg-muted/50 hover:bg-muted transition-colors animate-slide-in-bottom"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <code className="text-sm font-mono font-medium text-foreground">{suggestion.command}</code>
        <p className="text-xs text-muted-foreground truncate">{suggestion.description}</p>
      </div>
    </div>
  );
}
