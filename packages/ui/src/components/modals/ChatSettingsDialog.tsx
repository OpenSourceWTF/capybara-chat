import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../ui/Dialog';
import { ChatPreferences } from '../../hooks/useChatPreferences';
import { cn } from '../../lib/utils';
import type { AgentModel } from '@capybara-chat/types';

interface ChatSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  prefs: ChatPreferences;
  onUpdate: (prefs: ChatPreferences) => void;
  /** 195-ui-usability-pass: Current model for the session */
  model?: AgentModel | null;
  /** 195-ui-usability-pass: Handler for model switch */
  onModelSwitch?: (model: AgentModel) => void;
}

// Model display names and descriptions — derived from MODEL_REGISTRY
import { MODEL_REGISTRY } from '@capybara-chat/types';

const MODEL_OPTIONS: { value: AgentModel; label: string; description: string }[] = (
  Object.entries(MODEL_REGISTRY) as [Exclude<AgentModel, 'inherit'>, typeof MODEL_REGISTRY[keyof typeof MODEL_REGISTRY]][]
).map(([key, entry]) => ({
  value: key as AgentModel,
  label: entry.label.replace('Claude ', ''),
  description: entry.description,
}));

const COZY_COLORS = [
  { label: 'Capy Orange', value: 'text-orange-600 dark:text-orange-400', swatch: 'bg-orange-600 dark:bg-orange-400' },
  { label: 'Forest Moss', value: 'text-emerald-600 dark:text-emerald-400', swatch: 'bg-emerald-600 dark:bg-emerald-400' },
  { label: 'Deep Ocean', value: 'text-sky-600 dark:text-sky-400', swatch: 'bg-sky-600 dark:bg-sky-400' },
  { label: 'Wild Berry', value: 'text-rose-600 dark:text-rose-400', swatch: 'bg-rose-600 dark:bg-rose-400' },
  { label: 'Royal Purple', value: 'text-violet-600 dark:text-violet-400', swatch: 'bg-violet-600 dark:bg-violet-400' },
  { label: 'Earthen Clay', value: 'text-stone-600 dark:text-stone-400', swatch: 'bg-stone-600 dark:bg-stone-400' },
  { label: 'Night Sky', value: 'text-slate-700 dark:text-slate-300', swatch: 'bg-slate-700 dark:bg-slate-300' },
  { label: 'Golden Sand', value: 'text-amber-500 dark:text-amber-400', swatch: 'bg-amber-500 dark:bg-amber-400' },
];

function ColorPicker({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="text-xs font-mono uppercase text-muted-foreground font-bold tracking-wider">{label}</label>
      <div className="grid grid-cols-4 gap-3">
        {COZY_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => onChange(color.value)}
            className={cn(
              "h-12 w-full border-2 transition-all hover:scale-105 active:scale-95 flex items-center justify-center relative shadow-sm",
              color.swatch,
              value === color.value
                ? "border-foreground ring-2 ring-primary ring-offset-2 ring-offset-background z-10"
                : "border-transparent opacity-90 hover:opacity-100 ring-0 hover:border-border"
            )}
            title={color.label}
          >
            {value === color.value && (
              <div className="w-2 h-2 bg-background rounded-none animate-in zoom-in duration-200 shadow-sm" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatSettingsDialog({ open, onClose, prefs, onUpdate, model, onModelSwitch }: ChatSettingsDialogProps) {
  // Local state for edits
  const [localPrefs, setLocalPrefs] = useState<ChatPreferences>(prefs);

  // Sync local state when opening
  React.useEffect(() => {
    if (open) setLocalPrefs(prefs);
  }, [open, prefs]);

  const handleSave = () => {
    onUpdate(localPrefs);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader onClose={onClose}>
          <DialogTitle className="flex items-center gap-2 uppercase tracking-wider text-xl">
            <Settings className="w-5 h-5" />
            TERMINAL_PREFS
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-8 py-6">
          {/* 195-ui-usability-pass: Model selector moved from footer */}
          {onModelSwitch && (
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase text-muted-foreground font-bold tracking-wider">MODEL</label>
              <div className="grid grid-cols-2 gap-3">
                {MODEL_OPTIONS.map((opt) => {
                  // Default to 'sonnet' when model is null/undefined
                  const isSelected = (model || 'sonnet') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onModelSwitch(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 px-4 py-3 border-2 transition-all hover:scale-105 active:scale-95",
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "border-border hover:border-primary/50 bg-muted/30"
                      )}
                      title={opt.description}
                    >
                      <span className="text-sm font-bold uppercase">{opt.label}</span>
                      <span className="text-2xs text-muted-foreground">{opt.description}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-2xs text-muted-foreground/70">
                Switching models restarts the session context
              </p>
            </div>
          )}

          <div className="grid gap-8">
            <ColorPicker
              label="USER_THEME"
              value={localPrefs.userColor}
              onChange={(val) => setLocalPrefs({ ...localPrefs, userColor: val })}
            />

            <ColorPicker
              label="AGENT_THEME"
              value={localPrefs.assistantColor}
              onChange={(val) => setLocalPrefs({ ...localPrefs, assistantColor: val })}
            />

            <ColorPicker
              label="SYSTEM_THEME"
              value={localPrefs.systemColor}
              onChange={(val) => setLocalPrefs({ ...localPrefs, systemColor: val })}
            />
          </div>
        </DialogBody>

        <DialogFooter className="gap-4 pt-6">
          <Button variant="ghost" onClick={onClose} className="h-10 px-6">CANCEL</Button>
          <Button onClick={handleSave} className="h-10 px-8 bg-primary text-primary-foreground hover:bg-primary-hover">SAVE_CHANGES</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
